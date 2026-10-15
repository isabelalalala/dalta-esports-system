-- Player game profiles (Module 2) and "Delete my account" (Module 1)
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. player_game_profiles: a player's in-game details, one row per game.
--    game_id points at the games table (same list as team registration).
-- ---------------------------------------------------------------------------
create table public.player_game_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id),
  ign text not null check (length(trim(ign)) > 0),
  in_game_role text,
  rank text,
  created_at timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table public.player_game_profiles enable row level security;

create policy "Logged-in users can view game profiles"
  on public.player_game_profiles for select
  to authenticated
  using (true);

create policy "Players can add their own game profiles"
  on public.player_game_profiles for insert
  to authenticated
  with check (user_id = auth.uid() and public.get_my_role() = 'player');

create policy "Users can edit their own game profiles"
  on public.player_game_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can remove their own game profiles"
  on public.player_game_profiles for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Make deleting a user possible.
--    Deleting a row in auth.users fails if another table still points at it
--    without an ON DELETE rule. These foreign keys were created outside the
--    migrations, so we look them up by column and recreate them with the rule we want.
-- ---------------------------------------------------------------------------

-- Temporary helper (only exists during this run): drops every foreign key on
-- tbl(col) and adds one new foreign key to ref_tbl(id) with the given ON DELETE rule.
create function pg_temp.replace_fk(tbl regclass, col text, ref_tbl regclass, on_delete text)
returns void
language plpgsql
as $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.contype = 'f' and con.conrelid = tbl and att.attname = col
  loop
    execute format('alter table %s drop constraint %I', tbl, fk.conname);
  end loop;

  execute format(
    'alter table %s add constraint %I foreign key (%I) references %s (id) on delete %s',
    tbl, replace(tbl::text, 'public.', '') || '_' || col || '_fkey', col, ref_tbl, on_delete
  );
end $$;

-- Stop with a clear message if old rows point at users that no longer exist
-- (the new foreign keys could not be added otherwise).
do $$
begin
  if exists (select 1 from public.profiles p left join auth.users u on u.id = p.id where u.id is null) then
    raise exception 'Some profiles have no matching auth user. Delete those profiles first.';
  end if;
  if exists (select 1 from public.tournament_registrations r left join public.profiles p on p.id = r.user_id where r.user_id is not null and p.id is null) then
    raise exception 'Some tournament registrations point at users that no longer exist. Delete those rows first.';
  end if;
end $$;

-- Deleting the auth user deletes the profile...
select pg_temp.replace_fk('public.profiles', 'id', 'auth.users', 'cascade');
-- ...which deletes the registrations that user made (team registrations
-- already go away when the team is deleted)...
select pg_temp.replace_fk('public.tournament_registrations', 'user_id', 'public.profiles', 'cascade');
-- ...and tournaments they created stay, without a creator.
alter table public.tournaments alter column created_by drop not null;
select pg_temp.replace_fk('public.tournaments', 'created_by', 'public.profiles', 'set null');

-- ---------------------------------------------------------------------------
-- 3. delete_own_account(): the logged-in user deletes their own account.
--    security definer so it can delete from auth.users without the service role key.
--    Everything linked to the user is removed by the ON DELETE rules above
--    (profile, game profiles, team memberships, teams they captain alone).
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  team_with_players text;
begin
  if me is null then
    raise exception 'You must be logged in.';
  end if;

  -- Deleting a captain deletes their team, so don't do that to teammates.
  select t.name into team_with_players
  from public.teams t
  where t.captain_id = me
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = t.id and tm.user_id <> me
    )
  limit 1;

  if team_with_players is not null then
    raise exception 'You''re the captain of %, which has other players. Remove them or delete the team first.', team_with_players;
  end if;

  -- Keep at least one administrator in the system.
  if public.get_my_role() = 'admin'
     and (select count(*) from public.profiles where role = 'admin') = 1 then
    raise exception 'You''re the only administrator. Make someone else an admin first.';
  end if;

  delete from auth.users where id = me;
end $$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

commit;
