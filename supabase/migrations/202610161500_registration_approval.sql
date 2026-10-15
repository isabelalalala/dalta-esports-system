-- Registration approval and tournament permissions (Module 2)
-- - Registrations have a status: pending / approved / rejected / cancelled.
-- - Admin/staff approve or reject; captains can cancel or delete only while pending.
-- - Only pending + approved registrations count towards max_participants.
-- - Tournaments: admin/staff create and edit, only admin deletes.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Registration status values.
-- ---------------------------------------------------------------------------
update public.tournament_registrations set status = 'pending' where status is null;

do $$
declare
  bad_statuses text;
begin
  select string_agg(distinct status, ', ') into bad_statuses
  from public.tournament_registrations
  where status not in ('pending', 'approved', 'rejected', 'cancelled');

  if bad_statuses is not null then
    raise exception 'Unknown registration status values: %. Change them to pending/approved/rejected/cancelled, then run this again.', bad_statuses;
  end if;
end $$;

alter table public.tournament_registrations drop constraint if exists tournament_registrations_status_check;
alter table public.tournament_registrations
  add constraint tournament_registrations_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

alter table public.tournament_registrations alter column status set default 'pending';
alter table public.tournament_registrations alter column status set not null;

-- ---------------------------------------------------------------------------
-- 2. Deleting a tournament deletes its registrations.
--    The link was created outside the migrations, so it is looked up and recreated.
-- ---------------------------------------------------------------------------
do $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and con.conrelid = 'public.tournament_registrations'::regclass
      and att.attname = 'tournament_id'
  loop
    execute format('alter table public.tournament_registrations drop constraint %I', fk.conname);
  end loop;
end $$;

alter table public.tournament_registrations
  add constraint tournament_registrations_tournament_id_fkey
  foreign key (tournament_id) references public.tournaments (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Registration policies (all old ones are replaced).
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'tournament_registrations'
  loop
    execute format('drop policy %I on public.tournament_registrations', pol.policyname);
  end loop;
end $$;

alter table public.tournament_registrations enable row level security;

-- Team lists are public within a tournament.
create policy "Logged-in users can view registrations"
  on public.tournament_registrations for select
  to authenticated
  using (true);

-- Captains register their own team, always as pending.
create policy "Captains register their own team"
  on public.tournament_registrations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
  );

create policy "Admin/staff can update registrations"
  on public.tournament_registrations for update
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'))
  with check (public.get_my_role() in ('admin', 'staff'));

-- Captain: pending -> cancelled only (other columns are guarded by the trigger below).
create policy "Captain can cancel their pending registration"
  on public.tournament_registrations for update
  to authenticated
  using (
    status = 'pending'
    and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  )
  with check (
    status = 'cancelled'
    and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );

create policy "Admin can delete registrations"
  on public.tournament_registrations for delete
  to authenticated
  using (public.get_my_role() = 'admin');

create policy "Captain can delete their pending registration"
  on public.tournament_registrations for delete
  to authenticated
  using (
    status = 'pending'
    and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Registration rules on insert. Same as before, except only pending and
--    approved registrations count towards max_participants.
-- ---------------------------------------------------------------------------
create or replace function public.check_tournament_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tour record;
  team_game text;
  game_min int;
  game_name text;
  member_count int;
  active_count int;
begin
  if new.team_id is null then
    raise exception 'Please choose a team to register.';
  end if;

  -- Lock the tournament row so two teams can't take the last slot at once.
  select status, game_id, registration_deadline, max_participants
    into tour
  from public.tournaments
  where id = new.tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found.';
  end if;

  if tour.status is distinct from 'upcoming' then
    raise exception 'Registration is closed for this tournament.';
  end if;

  -- Dates are compared in the database time zone (UTC on Supabase).
  if tour.registration_deadline is not null
     and current_date > tour.registration_deadline::date then
    raise exception 'The registration deadline has passed.';
  end if;

  if tour.game_id is null then
    raise exception 'This tournament has no game set yet. Ask an admin to edit it.';
  end if;

  select t.game_id, g.min_players, g.name
    into team_game, game_min, game_name
  from public.teams t
  join public.games g on g.id = t.game_id
  where t.id = new.team_id;

  if team_game is distinct from tour.game_id then
    raise exception 'Your team plays %, but this tournament is for a different game.', game_name;
  end if;

  select count(*) into member_count
  from public.team_members where team_id = new.team_id;

  if member_count < game_min then
    raise exception 'Your team needs at least % players to register (it has %).', game_min, member_count;
  end if;

  if exists (
    select 1 from public.tournament_registrations
    where tournament_id = new.tournament_id and team_id = new.team_id
  ) then
    raise exception 'Your team is already registered for this tournament.';
  end if;

  if tour.max_participants is not null then
    select count(*) into active_count
    from public.tournament_registrations
    where tournament_id = new.tournament_id
      and status in ('pending', 'approved');

    if active_count >= tour.max_participants then
      raise exception 'This tournament is full.';
    end if;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Rules on update:
--    - captains may only change the status (the policy allows only pending -> cancelled)
--    - moving a rejected/cancelled team back to pending/approved must not overfill the tournament
-- ---------------------------------------------------------------------------
create or replace function public.check_registration_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_teams int;
  active_count int;
begin
  -- auth.uid() is null in the SQL Editor, which may change anything.
  if auth.uid() is not null and coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    if new.tournament_id is distinct from old.tournament_id
       or new.team_id is distinct from old.team_id
       or new.user_id is distinct from old.user_id
       or new.team_name is distinct from old.team_name
       or new.registered_at is distinct from old.registered_at then
      raise exception 'You can only cancel your registration.';
    end if;
  end if;

  if old.status in ('rejected', 'cancelled') and new.status in ('pending', 'approved') then
    select max_participants into max_teams
    from public.tournaments
    where id = new.tournament_id
    for update;

    if max_teams is not null then
      select count(*) into active_count
      from public.tournament_registrations
      where tournament_id = new.tournament_id
        and status in ('pending', 'approved')
        and id <> new.id;

      if active_count >= max_teams then
        raise exception 'This tournament is full (% teams).', max_teams;
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists tournament_registrations_update_check on public.tournament_registrations;
create trigger tournament_registrations_update_check
  before update on public.tournament_registrations
  for each row execute function public.check_registration_update();

-- ---------------------------------------------------------------------------
-- 6. Tournament policies (all old ones are replaced).
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'tournaments'
  loop
    execute format('drop policy %I on public.tournaments', pol.policyname);
  end loop;
end $$;

alter table public.tournaments enable row level security;

create policy "Anyone can view tournaments"
  on public.tournaments for select
  to anon, authenticated
  using (true);

create policy "Admin/staff can create tournaments"
  on public.tournaments for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'staff') and created_by = auth.uid());

create policy "Admin/staff can edit tournaments"
  on public.tournaments for update
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'))
  with check (public.get_my_role() in ('admin', 'staff'));

create policy "Admin can delete tournaments"
  on public.tournaments for delete
  to authenticated
  using (public.get_my_role() = 'admin');

commit;
