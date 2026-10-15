-- Matches for single-elimination brackets (Module 2, part 1 of brackets)
-- - matches table with RLS: anyone reads, admin/staff write.
-- - Rules checked by a trigger with readable errors (winner, status, scores).
-- - The winner of a match is moved into the next match automatically.
--
-- Bracket layout: match k of round r feeds match ceil(k/2) of round r+1,
-- as team A when k is odd and team B when k is even.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round int not null check (round >= 1),
  match_number int not null check (match_number >= 1),
  -- Empty team = not decided yet (TBD), or a bye in round 1
  team_a_id uuid references public.teams (id),
  team_b_id uuid references public.teams (id),
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed')),
  score_a int check (score_a >= 0),
  score_b int check (score_b >= 0),
  winner_team_id uuid references public.teams (id),
  -- set null so deleting a whole bracket doesn't depend on the delete order
  next_match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round, match_number),
  check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id),
  check (winner_team_id is null or winner_team_id = team_a_id or winner_team_id = team_b_id)
);

-- Used by "My Matches" to find a team's matches
create index matches_team_a_idx on public.matches (team_a_id);
create index matches_team_b_idx on public.matches (team_b_id);

alter table public.matches enable row level security;

create policy "Anyone can view matches"
  on public.matches for select
  to anon, authenticated
  using (true);

create policy "Admin/staff can create matches"
  on public.matches for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'staff'));

create policy "Admin/staff can update matches"
  on public.matches for update
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'))
  with check (public.get_my_role() in ('admin', 'staff'));

create policy "Admin/staff can delete matches"
  on public.matches for delete
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'));

-- ---------------------------------------------------------------------------
-- 2. Match rules, checked before every insert and update.
-- ---------------------------------------------------------------------------
create or replace function public.check_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  -- A completed match always has a winner, and only completed matches have one.
  -- (Elimination matches can't end in a tie.)
  if new.status = 'completed' and new.winner_team_id is null then
    raise exception 'Choose a winner before marking the match as completed.';
  end if;
  if new.winner_team_id is not null and new.status <> 'completed' then
    raise exception 'A match with a winner must be marked as completed.';
  end if;

  -- Both teams must be known before a match is played.
  -- The only exception is a bye in round 1: one team, completed, and that team wins.
  if new.status in ('live', 'completed')
     and (new.team_a_id is null or new.team_b_id is null) then
    if not (new.round = 1 and new.status = 'completed') then
      raise exception 'Both teams must be known before this match can start.';
    end if;
  end if;

  -- If both scores are entered, the winner must have the higher score.
  if new.winner_team_id is not null and new.score_a is not null and new.score_b is not null then
    if (new.winner_team_id = new.team_a_id and new.score_a <= new.score_b)
       or (new.winner_team_id = new.team_b_id and new.score_b <= new.score_a) then
      raise exception 'The winner must have the higher score.';
    end if;
  end if;

  return new;
end $$;

create trigger matches_check
  before insert or update on public.matches
  for each row execute function public.check_match();

-- ---------------------------------------------------------------------------
-- 3. Move the winner into the next match.
--    Runs after a winner is set, changed or cleared (and after inserting a
--    bye, which is created with its winner already set).
-- ---------------------------------------------------------------------------
create or replace function public.advance_match_winner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_status text;
begin
  if new.next_match_id is null then
    return null;  -- the final: nothing to advance into
  end if;

  if tg_op = 'UPDATE' and new.winner_team_id is not distinct from old.winner_team_id then
    return null;  -- winner didn't change
  end if;

  select status into next_status
  from public.matches
  where id = new.next_match_id
  for update;

  -- Changing a result is only allowed until the next match starts,
  -- because everything after it depends on who advanced.
  if next_status <> 'scheduled' then
    raise exception 'The next match has already started, so this result can''t be changed.';
  end if;

  -- Odd match numbers fill team A of the next match, even ones fill team B.
  -- A cleared winner (null) empties the slot again.
  if new.match_number % 2 = 1 then
    update public.matches set team_a_id = new.winner_team_id where id = new.next_match_id;
  else
    update public.matches set team_b_id = new.winner_team_id where id = new.next_match_id;
  end if;

  return null;
end $$;

create trigger matches_advance_winner
  after insert or update on public.matches
  for each row execute function public.advance_match_winner();

-- ---------------------------------------------------------------------------
-- 4. A team that is in a bracket can't be deleted (it would break the bracket).
--    Without this, the delete would fail with a technical foreign key error.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_team_delete_in_bracket()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.matches
    where team_a_id = old.id or team_b_id = old.id or winner_team_id = old.id
  ) then
    raise exception 'This team is in a tournament bracket, so it can''t be deleted. Ask an organizer.';
  end if;
  return old;
end $$;

create trigger teams_prevent_delete_in_bracket
  before delete on public.teams
  for each row execute function public.prevent_team_delete_in_bracket();

commit;
