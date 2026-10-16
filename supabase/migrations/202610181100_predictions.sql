-- Pick'em predictions for the audience
-- - Logged-in spectators and players pick the winner of a match (one pick per match, changeable).
-- - Picks lock when the match goes live OR its scheduled time passes, whichever comes first.
-- - Players can't pick matches their own team plays; organizers (admin/staff) can't pick at all.
-- - Everyone (also logged out) sees only the community split (percentages), never who picked what.
-- - When a match gets a winner (staff approve/override, forfeit, or a direct edit), the picks are
--   marked correct or incorrect automatically.
-- - A leaderboard per tournament shows "first name + initial" (logged-in users only).
-- - report_engagement() gains prediction counts and participation (Module 6).
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Regenerating a bracket deletes its matches, and with them their picks
  match_id uuid not null references public.matches (id) on delete cascade,
  predicted_winner_team_id uuid not null references public.teams (id) on delete cascade,
  -- Empty until the match has a winner; set only by mark_predictions() (trigger on matches)
  is_correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index predictions_match_idx on public.predictions (match_id);

alter table public.predictions enable row level security;

-- Users see and manage only their own picks. The community split comes from
-- get_prediction_split(), which returns totals only.
create policy "Users read their own predictions"
  on public.predictions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users make their own predictions"
  on public.predictions for insert
  to authenticated
  with check (user_id = auth.uid() and is_correct is null);

create policy "Users change their own predictions"
  on public.predictions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own predictions"
  on public.predictions for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Rules for making, changing and removing a pick
-- ---------------------------------------------------------------------------
create or replace function public.check_prediction()
returns trigger
language plpgsql
security definer   -- reads matches and team_members for the checks
set search_path = ''
as $$
declare
  m public.matches%rowtype;
  my_role text;
begin
  -- SQL Editor: no checks
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  -- The match or the account was deleted (cascade): always allowed
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  -- mark_predictions() may only set is_correct
  if tg_op = 'UPDATE' and current_setting('app.marking_predictions', true) = 'on' then
    if new.user_id is distinct from old.user_id or new.match_id is distinct from old.match_id
       or new.predicted_winner_team_id is distinct from old.predicted_winner_team_id then
      raise exception 'Only the result of a pick can be marked.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.match_id is distinct from old.match_id then
      raise exception 'A pick can''t be moved to another match or person.';
    end if;
    new.is_correct := old.is_correct;  -- users never set the result
    new.updated_at := now();
  elsif tg_op = 'INSERT' then
    new.is_correct := null;
  end if;

  my_role := public.get_my_role();
  if my_role in ('admin', 'staff') then
    raise exception 'Organizers can''t make picks, because they decide the results.';
  end if;

  select * into m from public.matches where id = coalesce(new.match_id, old.match_id);
  if not found then
    raise exception 'That match doesn''t exist anymore.';
  end if;

  -- Locked once the match is live/completed or its time has passed
  if m.status <> 'scheduled' or (m.scheduled_at is not null and m.scheduled_at <= now()) then
    raise exception 'Picks for this match are closed.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if m.team_a_id is null or m.team_b_id is null then
    raise exception 'Picks open once both teams of this match are known.';
  end if;
  if new.predicted_winner_team_id not in (m.team_a_id, m.team_b_id) then
    raise exception 'Pick one of the two teams playing this match.';
  end if;
  if exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid() and tm.team_id in (m.team_a_id, m.team_b_id)
  ) then
    raise exception 'You can''t pick a match your own team is playing.';
  end if;

  return new;
end $$;

create trigger predictions_check
  before insert or update or delete on public.predictions
  for each row execute function public.check_prediction();

-- ---------------------------------------------------------------------------
-- 3. Mark picks when a match gets (or loses) its winner.
--    Covers every way a result is set: staff approve/override (review_match_result),
--    forfeits (declare_forfeit) and direct edits on Manage Matches.
-- ---------------------------------------------------------------------------
create or replace function public.mark_predictions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.winner_team_id is not distinct from old.winner_team_id then
    return null;
  end if;

  perform set_config('app.marking_predictions', 'on', true);
  update public.predictions
  set is_correct = case
        when new.winner_team_id is null then null   -- result cleared: undecided again
        else predicted_winner_team_id = new.winner_team_id
      end
  where match_id = new.id;
  perform set_config('app.marking_predictions', 'off', true);

  return null;
end $$;

create trigger matches_mark_predictions
  after update of winner_team_id on public.matches
  for each row execute function public.mark_predictions();

-- ---------------------------------------------------------------------------
-- 4. Community split: totals per match and team, never who picked what.
--    Anyone may call it (the public /t pages show it too).
-- ---------------------------------------------------------------------------
create or replace function public.get_prediction_split(p_match_ids uuid[])
returns table (match_id uuid, team_id uuid, picks bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.match_id, p.predicted_winner_team_id, count(*)
  from public.predictions p
  where p.match_id = any(p_match_ids[1:200])   -- one bracket at most
  group by p.match_id, p.predicted_winner_team_id;
$$;

revoke execute on function public.get_prediction_split(uuid[]) from public;
grant execute on function public.get_prediction_split(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Leaderboard of one tournament (logged-in users only).
--    Names are "first name + initial" (e.g. "Juan D."). Ranked by correct picks, then by
--    fewer decided picks (= better accuracy). Returns the top 20 plus the caller's own row.
-- ---------------------------------------------------------------------------
create or replace function public.get_prediction_leaderboard(p_tournament_id uuid)
returns table (
  rank bigint,
  display_name text,
  correct bigint,
  decided bigint,
  total bigint,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select p.user_id,
           count(*) filter (where p.is_correct) as correct,
           count(*) filter (where p.is_correct is not null) as decided,
           count(*) as total
    from public.predictions p
    join public.matches m on m.id = p.match_id
    where m.tournament_id = p_tournament_id
    group by p.user_id
  ),
  ranked as (
    select s.*, rank() over (order by s.correct desc, s.decided asc) as rank
    from scores s
  )
  select r.rank,
         -- First word of the name + first letter of the last word: "Juan Dela Cruz" -> "Juan C."
         case
           when coalesce(trim(pr.full_name), '') = '' then 'Player'
           when position(' ' in trim(pr.full_name)) = 0 then trim(pr.full_name)
           else split_part(trim(pr.full_name), ' ', 1) || ' '
                || upper(left(regexp_replace(trim(pr.full_name), '^.*\s', ''), 1)) || '.'
         end,
         r.correct, r.decided, r.total,
         r.user_id = auth.uid()
  from ranked r
  join public.profiles pr on pr.id = r.user_id
  where auth.uid() is not null
    and (r.rank <= 20 or r.user_id = auth.uid())
  order by r.rank, 2;
$$;

revoke execute on function public.get_prediction_leaderboard(uuid) from public, anon;
grant execute on function public.get_prediction_leaderboard(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Engagement report with predictions (latest version of report_engagement, from
--    202610162300_admin_reports, plus the "pr" part). Organizers' picks aren't counted
--    (they can't pick anyway). Dates filter by the day the pick was made (PH time).
--    participation = people who picked at least once ÷ all player and spectator accounts.
-- ---------------------------------------------------------------------------
create or replace function public.report_engagement(
  p_tournament_id uuid default null,
  p_game_id text default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only organizers can view engagement stats.';
  end if;

  with
  t as (
    select tr.id, tr.name, tr.game
    from public.tournaments tr
    where (p_tournament_id is null or tr.id = p_tournament_id)
      and (p_game_id is null or tr.game_id = p_game_id)
  ),
  s as (
    select st.*, t.name as tournament_name, t.game
    from public.streams st
    join t on t.id = st.tournament_id
  ),
  -- Views in the date range. Organizers' own visits (testing a stream) don't count.
  v as (
    select sv.*
    from public.stream_views sv
    join s on s.id = sv.stream_id
    join public.profiles p on p.id = sv.user_id
    where p.role not in ('admin', 'staff')
      and (p_from is null or sv.viewed_on >= p_from)
      and (p_to is null or sv.viewed_on <= p_to)
  ),
  -- Feedback counts only (no comments or sentiment: staff may see these numbers)
  f as (
    select fb.tournament_id, tr.name as tournament_name, fb.rating
    from public.feedback fb
    left join public.tournaments tr on tr.id = fb.tournament_id
    where (p_tournament_id is null or fb.tournament_id = p_tournament_id)
      and (p_game_id is null or tr.game_id = p_game_id)
      and (p_from is null or (fb.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (fb.created_at at time zone 'Asia/Manila')::date <= p_to)
  ),
  -- Pick'em predictions in the filters
  pr as (
    select pd.user_id, pd.is_correct, t.id as tournament_id, t.name as tournament_name
    from public.predictions pd
    join public.matches m on m.id = pd.match_id
    join t on t.id = m.tournament_id
    join public.profiles p on p.id = pd.user_id
    where p.role not in ('admin', 'staff')
      and (p_from is null or (pd.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (pd.created_at at time zone 'Asia/Manila')::date <= p_to)
  ),
  audience as (
    select count(*) as accounts from public.profiles where role in ('player', 'spectator')
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'streams', (select count(*) from s),
      'live_streams', (select count(*) from s where s.status = 'live'),
      'views', (select count(*) from v),
      'unique_viewers', (select count(distinct v.user_id) from v),
      'feedback', (select count(*) from f),
      'avg_rating', (select round(avg(f.rating), 2) from f),
      'predictions', (select count(*) from pr),
      'predictors', (select count(distinct pr.user_id) from pr),
      -- % of decided picks that were right (null = no decided picks yet)
      'prediction_accuracy', (
        select round(100.0 * count(*) filter (where pr.is_correct) / nullif(count(*) filter (where pr.is_correct is not null), 0), 1)
        from pr
      ),
      'audience_accounts', (select accounts from audience),
      -- % of player/spectator accounts that made at least one pick
      'prediction_participation', (
        select round(100.0 * (select count(distinct pr.user_id) from pr) / nullif(accounts, 0), 1) from audience
      )
    ),
    -- Every stream, also those without views. round/round_count/match_number are
    -- filled only when the stream is linked to one match (used for "Final", "Semifinals"...).
    'streams', (
      select coalesce(jsonb_agg(x order by x.views desc, x.title), '[]'::jsonb)
      from (
        select s.id, s.title, s.status, s.tournament_name, s.game,
               mt.round, mt.match_number,
               (select max(m2.round) from public.matches m2 where m2.tournament_id = s.tournament_id) as round_count,
               (select count(*) from v where v.stream_id = s.id) as views,
               (select count(distinct v.user_id) from v where v.stream_id = s.id) as unique_viewers
        from s
        left join public.matches mt on mt.id = s.match_id
      ) x
    ),
    'views_by_day', (
      select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb)
      from (
        select v.viewed_on as day, count(*) as views, count(distinct v.user_id) as unique_viewers
        from v group by v.viewed_on
      ) x
    ),
    'feedback_by_tournament', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb)
      from (
        select f.tournament_name, count(*) as count, round(avg(f.rating), 2) as avg_rating
        from f group by f.tournament_id, f.tournament_name
      ) x
    ),
    'predictions_by_tournament', (
      select coalesce(jsonb_agg(x order by x.predictions desc, x.tournament_name), '[]'::jsonb)
      from (
        select pr.tournament_name,
               count(*) as predictions,
               count(distinct pr.user_id) as predictors,
               count(*) filter (where pr.is_correct is not null) as decided,
               round(100.0 * count(*) filter (where pr.is_correct) / nullif(count(*) filter (where pr.is_correct is not null), 0), 1) as accuracy
        from pr group by pr.tournament_id, pr.tournament_name
      ) x
    )
  ) into result;

  return result;
end $$;

revoke execute on function public.report_engagement(uuid, text, date, date) from public, anon;
grant execute on function public.report_engagement(uuid, text, date, date) to authenticated;

commit;
