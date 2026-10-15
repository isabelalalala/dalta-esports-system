-- Team management by the captain (Module 2)
-- - Teams get a description, and the captain can edit name and description.
-- - The captain adds members by searching players who have a game profile
--   for the team's game. This replaces join codes.
-- - Rosters show each member's IGN and in-game role, and anyone logged in can see them.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Description, and let the captain edit their team.
-- ---------------------------------------------------------------------------
alter table public.teams add column if not exists description text;

drop policy if exists "Captain can edit their team" on public.teams;
create policy "Captain can edit their team"
  on public.teams for update
  to authenticated
  using (captain_id = auth.uid())
  with check (captain_id = auth.uid());

-- The game and captain can't change: the roster rules depend on them.
create or replace function public.protect_team_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.game_id is distinct from old.game_id then
    raise exception 'A team''s game can''t be changed. Create a new team instead.';
  end if;
  if new.captain_id is distinct from old.captain_id then
    raise exception 'A team''s captain can''t be changed.';
  end if;
  return new;
end $$;

drop trigger if exists teams_protect_fields on public.teams;
create trigger teams_protect_fields
  before update on public.teams
  for each row execute function public.protect_team_fields();

-- ---------------------------------------------------------------------------
-- 2. Remove join codes (replaced by the captain adding members).
--    setup_new_team() is redefined first because it used to create the code.
-- ---------------------------------------------------------------------------
create or replace function public.setup_new_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The creator becomes the team's captain member automatically.
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.captain_id, 'captain');
  return new;
end $$;

drop function if exists public.join_team(text);
drop table if exists public.team_join_codes;

-- ---------------------------------------------------------------------------
-- 3. Captain adds members.
--    RLS: only the team's captain, and only as 'player' (not a second captain).
--    The trigger below checks the rest with readable error messages.
-- ---------------------------------------------------------------------------
drop policy if exists "Captain can add players" on public.team_members;
create policy "Captain can add players"
  on public.team_members for insert
  to authenticated
  with check (
    role = 'player'
    and exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
  );

-- Roster rules for every new member. Same as before, plus: added players
-- must be a 'player' and have a game profile for the team's game.
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
  -- Lock the team row so two members added at the same moment can't
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

  -- The captain is added by setup_new_team(); these checks are for added players.
  if new.role = 'player' then
    if not exists (
      select 1 from public.profiles where id = new.user_id and role = 'player'
    ) then
      raise exception 'Only player accounts can be added to a team.';
    end if;

    if not exists (
      select 1 from public.player_game_profiles
      where user_id = new.user_id and game_id = team_game
    ) then
      raise exception 'This player has no % game profile yet.', game_name;
    end if;
  end if;

  -- One team per game per player.
  if exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = new.user_id and t.game_id = team_game
  ) then
    raise exception 'That player is already on a % team.', game_name;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4. search_players(game, text): players the captain can add.
--    security definer because players can't read other people's profiles.
--    Returns name and in-game details only (never email), and only answers
--    for someone who captains a team in that game.
-- ---------------------------------------------------------------------------
create or replace function public.search_players(p_game_id text, p_search text)
returns table (user_id uuid, full_name text, ign text, in_game_role text, rank text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, gp.ign, gp.in_game_role, gp.rank
  from public.player_game_profiles gp
  join public.profiles p on p.id = gp.user_id
  where gp.game_id = p_game_id
    and p.role = 'player'
    -- caller must captain a team in this game
    and exists (
      select 1 from public.teams t
      where t.captain_id = auth.uid() and t.game_id = p_game_id
    )
    -- skip players already on a team for this game
    and not exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = p.id and t.game_id = p_game_id
    )
    -- match IGN or name (strpos avoids treating % and _ as wildcards)
    and (
      strpos(lower(gp.ign), lower(trim(p_search))) > 0
      or strpos(lower(coalesce(p.full_name, '')), lower(trim(p_search))) > 0
    )
  order by gp.ign
  limit 20
$$;

revoke execute on function public.search_players(text, text) from public, anon;
grant execute on function public.search_players(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_team_roster(team): now includes IGN and in-game role for the team's
--    game, and anyone logged in can see it. Email is no longer returned.
--    (Dropped first because the returned columns changed.)
-- ---------------------------------------------------------------------------
drop function if exists public.get_team_roster(uuid);

create function public.get_team_roster(p_team_id uuid)
returns table (
  user_id uuid,
  full_name text,
  ign text,
  in_game_role text,
  role text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select tm.user_id, p.full_name, gp.ign, gp.in_game_role, tm.role, tm.joined_at
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.profiles p on p.id = tm.user_id
  left join public.player_game_profiles gp
    on gp.user_id = tm.user_id and gp.game_id = t.game_id
  where tm.team_id = p_team_id
  order by tm.role = 'captain' desc, tm.joined_at
$$;

revoke execute on function public.get_team_roster(uuid) from public, anon;
grant execute on function public.get_team_roster(uuid) to authenticated;

commit;
