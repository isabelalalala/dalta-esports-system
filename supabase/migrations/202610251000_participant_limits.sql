-- Realistic participant range per game.
-- - games.min_participants / max_participants: how many teams (or players, for
--   solo games like Tekken 8) a tournament of that game may allow.
-- - check_tournament_participants(): BEFORE INSERT/UPDATE trigger on tournaments that
--   refuses a max_participants outside the game's range, and refuses lowering it
--   below the teams already registered (pending + approved, like the registration check).
--   It only runs when the row is created or when game_id / max_participants change,
--   so existing tournaments outside the range keep working until they are edited.
-- The same ranges are shown on the create/edit forms (utils/tournaments.ts reads them
-- from the games table, so this migration is the only place they are written).

begin;

alter table public.games add column if not exists min_participants int;
alter table public.games add column if not exists max_participants int;

update public.games set min_participants = 4, max_participants = 64  where id in ('mlbb', 'codm');
update public.games set min_participants = 4, max_participants = 32  where id in ('valorant', 'lol');
update public.games set min_participants = 8, max_participants = 128 where id = 'tekken8';
-- Any other game added later in the SQL Editor gets a safe default until it's set by hand
update public.games set min_participants = 2, max_participants = 64 where min_participants is null;

alter table public.games alter column min_participants set not null;
alter table public.games alter column max_participants set not null;
alter table public.games alter column min_participants set default 2;
alter table public.games alter column max_participants set default 64;

alter table public.games drop constraint if exists games_participants_check;
alter table public.games
  add constraint games_participants_check
  check (min_participants >= 2 and max_participants >= min_participants);

create or replace function public.check_tournament_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  unit text;
  active_count int;
begin
  -- Nothing relevant changed: leave older tournaments alone
  if tg_op = 'UPDATE'
     and new.max_participants is not distinct from old.max_participants
     and new.game_id is not distinct from old.game_id then
    return new;
  end if;

  -- The SQL Editor (no logged-in user) may leave the limit empty; the app may not
  if new.max_participants is null then
    if auth.uid() is null then
      return new;
    end if;
    raise exception 'Enter the maximum number of participants.';
  end if;

  select name, min_players, max_players, min_participants, max_participants
    into g
    from public.games
   where id = new.game_id;
  if not found then
    return new; -- the foreign key reports a missing game
  end if;

  -- Solo games (1 player per "team") count players, the rest count teams
  unit := case when g.max_players = 1 then 'players' else 'teams' end;

  if new.max_participants < g.min_participants or new.max_participants > g.max_participants then
    raise exception '% tournaments must allow between % and % %.',
      g.name, g.min_participants, g.max_participants, unit;
  end if;

  if tg_op = 'UPDATE' then
    select count(*) into active_count
      from public.tournament_registrations
     where tournament_id = new.id
       and status in ('pending', 'approved');
    if new.max_participants < active_count then
      raise exception '% % are already registered, so the limit can''t be lower than that.',
        active_count, unit;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tournaments_check_participants on public.tournaments;
create trigger tournaments_check_participants
  before insert or update on public.tournaments
  for each row execute function public.check_tournament_participants();

commit;
