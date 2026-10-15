-- Team registration (Module 2)
-- Adds games, teams, team_members and team join codes, and makes tournament
-- registrations point at a team (team_id) instead of a typed team name.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 0. Safety check: teams / team_members may already exist from earlier work.
--    If they are empty we recreate them with the correct columns.
--    If they contain data we stop, so nothing is lost.
-- ---------------------------------------------------------------------------
do $$
declare
  row_count bigint;
begin
  if to_regclass('public.team_members') is not null then
    execute 'select count(*) from public.team_members' into row_count;
    if row_count > 0 then
      raise exception 'public.team_members already has % rows. Stopped so no data is lost.', row_count;
    end if;
  end if;

  if to_regclass('public.teams') is not null then
    execute 'select count(*) from public.teams' into row_count;
    if row_count > 0 then
      raise exception 'public.teams already has % rows. Stopped so no data is lost.', row_count;
    end if;
  end if;
end $$;

-- Both are empty (or missing) at this point. cascade also removes any
-- foreign keys from other tables that pointed at them (not their data).
drop table if exists public.team_members cascade;
drop table if exists public.team_join_codes cascade;
drop table if exists public.teams cascade;

-- ---------------------------------------------------------------------------
-- 1. Helper: role of the logged-in user.
--    security definer lets policies read profiles without running into
--    profiles' own RLS (which can cause infinite recursion).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 2. games: one row per supported game, with its roster size.
--    min_players = members needed before the team can register for a tournament.
--    max_players = full roster size, including the captain.
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id text primary key,
  name text not null unique,
  min_players int not null check (min_players >= 1),
  max_players int not null,
  check (max_players >= min_players)
);

insert into public.games (id, name, min_players, max_players) values
  ('mlbb',     'MLBB',              5, 6),
  ('valorant', 'Valorant',          5, 6),
  ('lol',      'League of Legends', 5, 6),
  ('codm',     'CODM',              5, 6),
  ('tekken8',  'Tekken 8',          1, 1)
on conflict (id) do nothing;

alter table public.games enable row level security;

drop policy if exists "Logged-in users can view games" on public.games;
create policy "Logged-in users can view games"
  on public.games for select
  to authenticated
  using (true);
-- No insert/update/delete policies: games are edited in the SQL Editor.

-- ---------------------------------------------------------------------------
-- 3. tournaments.game_id: link each tournament to a game.
--    The old text column "game" stays so existing pages keep working.
-- ---------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists game_id text references public.games (id);

-- Fill game_id from the free-text game name. Unmatched tournaments stay null;
-- an admin can pick the game on the Edit Tournament page.
update public.tournaments
set game_id = case
  when lower(trim(game)) in ('mlbb', 'ml', 'mobile legends', 'mobile legends: bang bang', 'mobile legends bang bang') then 'mlbb'
  when lower(trim(game)) in ('valorant', 'val') then 'valorant'
  when lower(trim(game)) in ('league of legends', 'lol', 'league') then 'lol'
  when lower(trim(game)) in ('codm', 'cod mobile', 'cod: mobile', 'call of duty mobile', 'call of duty: mobile') then 'codm'
  when lower(trim(game)) in ('tekken 8', 'tekken8', 'tekken') then 'tekken8'
end
where game_id is null;

-- ---------------------------------------------------------------------------
-- 4. teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  game_id text not null references public.games (id),
  captain_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (name, game_id)
);

alter table public.teams enable row level security;

create policy "Logged-in users can view teams"
  on public.teams for select
  to authenticated
  using (true);

create policy "Players can create a team they captain"
  on public.teams for insert
  to authenticated
  with check (captain_id = auth.uid() and public.current_user_role() = 'player');

create policy "Captain or admin/staff can delete a team"
  on public.teams for delete
  to authenticated
  using (captain_id = auth.uid() or public.current_user_role() in ('admin', 'staff'));
-- No update policy: changing a team's game or captain would break roster rules.

-- ---------------------------------------------------------------------------
-- 5. team_join_codes: kept in a separate table so only the captain can read
--    the code (teams itself is readable by everyone).
-- ---------------------------------------------------------------------------
create table public.team_join_codes (
  team_id uuid primary key references public.teams (id) on delete cascade,
  join_code text not null unique
    default upper(substr(md5(gen_random_uuid()::text), 1, 8))
);

alter table public.team_join_codes enable row level security;

create policy "Captain can view their team's join code"
  on public.team_join_codes for select
  to authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = team_id and t.captain_id = auth.uid()
  ));
-- Rows are created by the trigger in section 7 only.

-- ---------------------------------------------------------------------------
-- 6. team_members
-- ---------------------------------------------------------------------------
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player' check (role in ('captain', 'player')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.team_members enable row level security;

create policy "Logged-in users can view team members"
  on public.team_members for select
  to authenticated
  using (true);

-- Leave a team yourself, captain removes a player, or admin/staff removes anyone.
-- The captain row is never deleted here; the captain deletes the team instead.
create policy "Members leave, captains remove players, admin/staff remove anyone"
  on public.team_members for delete
  to authenticated
  using (
    public.current_user_role() in ('admin', 'staff')
    or (
      role <> 'captain'
      and (
        user_id = auth.uid()
        or exists (
          select 1 from public.teams t
          where t.id = team_id and t.captain_id = auth.uid()
        )
      )
    )
  );
-- No insert policy: players join with public.join_team(code) (section 8),
-- and the captain is added by the trigger in section 7.

-- Roster rules, checked on every new member (with readable error messages).
create or replace function public.check_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_game text;
  game_name text;
  roster_max int;
  current_count int;
begin
  -- Lock the team row so two people joining at the same moment can't
  -- both take the last spot.
  select t.game_id, g.name, g.max_players
    into team_game, game_name, roster_max
  from public.teams t
  join public.games g on g.id = t.game_id
  where t.id = new.team_id
  for update of t;

  select count(*) into current_count
  from public.team_members
  where team_id = new.team_id;

  if current_count >= roster_max then
    raise exception 'This team is full (%/% players).', current_count, roster_max;
  end if;

  -- One team per game per player.
  if exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = new.user_id and t.game_id = team_game
  ) then
    raise exception 'You are already on a % team. Leave it first.', game_name;
  end if;

  return new;
end $$;

create trigger team_members_check
  before insert on public.team_members
  for each row execute function public.check_team_member();

-- ---------------------------------------------------------------------------
-- 7. When a team is created: add the captain as a member and make a join code.
--    Runs in the same transaction as the insert, so if the captain can't be
--    added (e.g. already on a team for this game) the team isn't created either.
-- ---------------------------------------------------------------------------
create or replace function public.setup_new_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.captain_id, 'captain');

  insert into public.team_join_codes (team_id) values (new.id);

  return new;
end $$;

create trigger teams_setup
  after insert on public.teams
  for each row execute function public.setup_new_team();

-- ---------------------------------------------------------------------------
-- 8. join_team(code): the only way for a player to join a team.
-- ---------------------------------------------------------------------------
create or replace function public.join_team(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_team uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  if public.current_user_role() is distinct from 'player' then
    raise exception 'Only players can join teams.';
  end if;

  select team_id into found_team
  from public.team_join_codes
  where join_code = upper(trim(code));

  if found_team is null then
    raise exception 'Invalid team code.';
  end if;

  if exists (
    select 1 from public.team_members
    where team_id = found_team and user_id = auth.uid()
  ) then
    raise exception 'You are already on this team.';
  end if;

  -- Roster size and one-team-per-game are checked by the team_members trigger.
  insert into public.team_members (team_id, user_id, role)
  values (found_team, auth.uid(), 'player');

  return found_team;
end $$;

revoke execute on function public.join_team(text) from public, anon;
grant execute on function public.join_team(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. get_team_roster(team): member names and emails, only for people on the
--    team and admin/staff. (profiles stays private otherwise.)
-- ---------------------------------------------------------------------------
create or replace function public.get_team_roster(p_team_id uuid)
returns table (user_id uuid, full_name text, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select tm.user_id, p.full_name, p.email, tm.role, tm.joined_at
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
  where tm.team_id = p_team_id
    and (
      public.current_user_role() in ('admin', 'staff')
      or exists (
        select 1 from public.team_members me
        where me.team_id = p_team_id and me.user_id = auth.uid()
      )
    )
  order by tm.role = 'captain' desc, tm.joined_at
$$;

revoke execute on function public.get_team_roster(uuid) from public, anon;
grant execute on function public.get_team_roster(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. tournament_registrations: register a team (team_id) instead of a name.
--     Existing rows keep their team_name; team_id stays empty for them.
--     New registrations must have a team_id (enforced by the trigger below).
-- ---------------------------------------------------------------------------
alter table public.tournament_registrations
  add column if not exists team_id uuid;

alter table public.tournament_registrations
  drop constraint if exists tournament_registrations_team_id_fkey;
alter table public.tournament_registrations
  add constraint tournament_registrations_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete cascade;

alter table public.tournament_registrations
  alter column team_name drop not null;

alter table public.tournament_registrations
  drop constraint if exists tournament_registrations_tournament_team_key;
alter table public.tournament_registrations
  add constraint tournament_registrations_tournament_team_key
  unique (tournament_id, team_id);

-- Remove all old policies on this table so only the ones below apply
-- (policies are combined with OR, so a leftover permissive one would win).
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

create policy "Logged-in users can view registrations"
  on public.tournament_registrations for select
  to authenticated
  using (true);

create policy "Captains register their own team"
  on public.tournament_registrations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
  );

create policy "Admin/staff update registration status"
  on public.tournament_registrations for update
  to authenticated
  using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

create policy "Captain withdraws, admin/staff remove"
  on public.tournament_registrations for delete
  to authenticated
  using (
    public.current_user_role() in ('admin', 'staff')
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
  );

-- Registration rules, with readable error messages.
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
  registered_count int;
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

  if tour.max_participants is not null then
    select count(*) into registered_count
    from public.tournament_registrations
    where tournament_id = new.tournament_id;

    if registered_count >= tour.max_participants then
      raise exception 'This tournament is full.';
    end if;
  end if;

  if exists (
    select 1 from public.tournament_registrations
    where tournament_id = new.tournament_id and team_id = new.team_id
  ) then
    raise exception 'Your team is already registered for this tournament.';
  end if;

  return new;
end $$;

drop trigger if exists tournament_registrations_check on public.tournament_registrations;
create trigger tournament_registrations_check
  before insert on public.tournament_registrations
  for each row execute function public.check_tournament_registration();

commit;
