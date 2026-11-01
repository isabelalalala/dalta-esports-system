-- Every rostered player has a game profile (IGN) for the team's game, captains included.
-- Before, only invited players were checked (check_team_invite); a captain could create a team
-- for a game they had no profile for, and anyone could delete their game profile while on a team.
-- That left "No IGN" on rosters (worst for Tekken 8, where the captain is the only player).
--
-- 1. teams: the captain must have a game profile for the team's game, when the team is created
--    and when the captaincy changes (transfer_team_captaincy).
-- 2. player_game_profiles: a profile can't be deleted (or moved to another game) while its owner
--    is on a team for that game. Editing the IGN, role or rank stays allowed.
--
-- Existing teams are not touched. The SQL Editor (auth.uid() is null) and cascades from deleting
-- an account (pg_trigger_depth() > 1) are not blocked.
--
-- Run in the Supabase SQL Editor after 202611011000_roster_captain_guard.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Captain needs a game profile for the team's game
-- ---------------------------------------------------------------------------
create or replace function public.check_team_captain_profile()
returns trigger
language plpgsql
security definer   -- reads the captain's game profiles
set search_path = ''
as $$
declare
  game_name text;
begin
  if auth.uid() is null then
    return new;
  end if;
  -- On update, only a captain change needs the check
  if tg_op = 'UPDATE' and new.captain_id is not distinct from old.captain_id then
    return new;
  end if;

  if not exists (
    select 1 from public.player_game_profiles gp
    where gp.user_id = new.captain_id and gp.game_id = new.game_id
  ) then
    select name into game_name from public.games where id = new.game_id;
    if tg_op = 'INSERT' then
      raise exception 'Add your % game profile (IGN) on your Profile page before creating a % team.',
        coalesce(game_name, new.game_id), coalesce(game_name, new.game_id);
    else
      raise exception 'The new captain needs a % game profile (IGN) first.', coalesce(game_name, new.game_id);
    end if;
  end if;

  return new;
end $$;

drop trigger if exists teams_check_captain_profile on public.teams;
create trigger teams_check_captain_profile
  before insert or update of captain_id on public.teams
  for each row execute function public.check_team_captain_profile();

-- ---------------------------------------------------------------------------
-- 2. Keep the game profile while on a team for that game
-- ---------------------------------------------------------------------------
create or replace function public.protect_rostered_game_profile()
returns trigger
language plpgsql
security definer   -- reads team_members and teams
set search_path = ''
as $$
declare
  team_name text;
  game_name text;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return coalesce(new, old);
  end if;
  -- On update, only moving the profile to another game or user matters
  if tg_op = 'UPDATE' and new.game_id = old.game_id and new.user_id = old.user_id then
    return new;
  end if;

  select t.name, g.name into team_name, game_name
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.games g on g.id = t.game_id
  where tm.user_id = old.user_id and t.game_id = old.game_id
  limit 1;

  if team_name is not null then
    raise exception 'You are on the % team %. Leave the team first, or just edit your IGN instead of removing the % profile.',
      game_name, team_name, game_name;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists player_game_profiles_protect_rostered on public.player_game_profiles;
create trigger player_game_profiles_protect_rostered
  before delete or update of game_id, user_id on public.player_game_profiles
  for each row execute function public.protect_rostered_game_profile();

commit;
