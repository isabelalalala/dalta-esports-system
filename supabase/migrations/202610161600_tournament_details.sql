-- Tournament details (Module 2)
-- - Rules text.
-- - Game limited to the 5 supported games, and game_id required.
-- - Date order: registration deadline <= start date <= end date.
-- - Stored status is only 'upcoming' (follow the dates) or 'cancelled'.
--   The status shown in the app (registration closed, ongoing, completed) is
--   calculated from the dates.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Rules.
-- ---------------------------------------------------------------------------
alter table public.tournaments add column if not exists rules text;

-- ---------------------------------------------------------------------------
-- 2. Game: one of the 5 supported games.
--    Stops (without changing anything) if an old row has another game,
--    e.g. a "DOTA 2" test tournament, so you can decide what to do with it.
-- ---------------------------------------------------------------------------
do $$
declare
  bad_rows text;
begin
  select string_agg(format('"%s" (game: %s)', name, coalesce(game, 'empty')), ', ') into bad_rows
  from public.tournaments
  where game is null
     or game not in ('MLBB', 'Valorant', 'Tekken 8', 'League of Legends', 'CODM')
     or game_id is null;

  if bad_rows is not null then
    raise exception 'These tournaments have an unsupported or missing game: %. Delete them or change their game, then run this again.', bad_rows;
  end if;
end $$;

alter table public.tournaments drop constraint if exists tournaments_game_check;
alter table public.tournaments
  add constraint tournaments_game_check
  check (game in ('MLBB', 'Valorant', 'Tekken 8', 'League of Legends', 'CODM'));

alter table public.tournaments alter column game_id set not null;

-- ---------------------------------------------------------------------------
-- 3. Date order. NOT VALID = applies to new and edited tournaments only,
--    so an old row with odd dates can't make this migration fail.
-- ---------------------------------------------------------------------------
alter table public.tournaments drop constraint if exists tournaments_deadline_before_start;
alter table public.tournaments
  add constraint tournaments_deadline_before_start
  check (registration_deadline <= start_date) not valid;

alter table public.tournaments drop constraint if exists tournaments_end_after_start;
alter table public.tournaments
  add constraint tournaments_end_after_start
  check (end_date >= start_date) not valid;

-- ---------------------------------------------------------------------------
-- 4. Status: only 'upcoming' or 'cancelled' is stored now.
--    'active' / 'completed' are worked out from the dates instead.
-- ---------------------------------------------------------------------------
update public.tournaments set status = 'upcoming' where status is null or status <> 'cancelled';

alter table public.tournaments drop constraint if exists tournaments_status_check;
alter table public.tournaments
  add constraint tournaments_status_check
  check (status in ('upcoming', 'cancelled'));

alter table public.tournaments alter column status set default 'upcoming';

-- ---------------------------------------------------------------------------
-- 5. Registration rules: same as before, plus refuse once the tournament has started.
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
  select status, game_id, start_date, registration_deadline, max_participants
    into tour
  from public.tournaments
  where id = new.tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found.';
  end if;

  if tour.status = 'cancelled' then
    raise exception 'This tournament has been cancelled.';
  end if;

  -- Dates are compared in the database time zone (UTC on Supabase).
  if tour.registration_deadline is not null
     and current_date > tour.registration_deadline::date then
    raise exception 'The registration deadline has passed.';
  end if;

  if tour.start_date is not null and current_date > tour.start_date::date then
    raise exception 'This tournament has already started.';
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

commit;
