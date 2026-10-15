-- Administrative Reports (Module 6)  [DFD: 6.0 Generate Administrative Report]
-- - report_activity / report_sentiment (admin) and report_engagement (admin + staff):
--   the reports are calculated in the database from D1-D4, so nothing is cut off by the
--   API's 1000-row limit. Each returns one JSON object that the app turns into charts.
-- - analytics_reports: reports an admin generated and saved.  [DFD: D5 Analytics & Engagement DB]
-- - Feedback becomes admin-only (staff only get feedback counts through report_engagement).
-- - stream_views.viewed_on now uses the Philippine date instead of the UTC date.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Feedback is for the Organizing Committee only.
--    Staff could read and classify all feedback before; now only admins can.
-- ---------------------------------------------------------------------------
drop policy if exists "Admin/staff read all feedback" on public.feedback;
drop policy if exists "Admin/staff save sentiment results" on public.feedback;

create policy "Admins read all feedback"
  on public.feedback for select
  to authenticated
  using (public.get_my_role() = 'admin');

create policy "Admins save sentiment results"
  on public.feedback for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 2. Views are counted per Philippine day (UTC+8), not per UTC day, so a visit at
--    7 AM in Manila counts on the right date. Older rows keep their UTC date.
-- ---------------------------------------------------------------------------
alter table public.stream_views
  alter column viewed_on set default (now() at time zone 'Asia/Manila')::date;

drop policy if exists "Users record their own views" on public.stream_views;

create policy "Users record their own views"
  on public.stream_views for insert
  to authenticated
  with check (user_id = auth.uid() and viewed_on = (now() at time zone 'Asia/Manila')::date);

-- ---------------------------------------------------------------------------
-- 3. analytics_reports: saved copies of generated reports (D5).
--    data holds the three report objects exactly as the functions below return them,
--    so a saved report always shows the numbers from the moment it was generated.
-- ---------------------------------------------------------------------------
create table public.analytics_reports (
  id uuid primary key default gen_random_uuid(),
  -- The filters used, with readable names, e.g. {"tournament": "SLEC MLBB", "from": "2026-10-01"}
  filters jsonb not null default '{}',
  -- {"activity": {...}, "sentiment": {...}, "engagement": {...}}
  data jsonb not null,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now()
);

alter table public.analytics_reports enable row level security;

create policy "Admins read saved reports"
  on public.analytics_reports for select
  to authenticated
  using (public.get_my_role() = 'admin');

create policy "Admins save reports"
  on public.analytics_reports for insert
  to authenticated
  with check (public.get_my_role() = 'admin' and generated_by = auth.uid());

create policy "Admins delete saved reports"
  on public.analytics_reports for delete
  to authenticated
  using (public.get_my_role() = 'admin');
-- No update policy: a saved report never changes.

-- ---------------------------------------------------------------------------
-- 4. Report functions. All take the same filters; null means "all":
--      p_tournament_id, p_game_id, p_from and p_to (dates, inclusive, Philippine time).
--    security definer so staff can get feedback COUNTS without being able to read the
--    feedback itself; each function checks the caller's role first.
-- ---------------------------------------------------------------------------

-- Overall Tournament Activity & System Report (admin)
create or replace function public.report_activity(
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
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Only admins can view the activity report.';
  end if;

  with
  -- Users who joined in the date range (tournament and game filters don't apply to users)
  u as (
    select p.role, (p.created_at at time zone 'Asia/Manila')::date as joined_on
    from public.profiles p
    where (p_from is null or (p.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (p.created_at at time zone 'Asia/Manila')::date <= p_to)
  ),
  -- Tournaments that match the filters and overlap the date range
  t as (
    select tr.*
    from public.tournaments tr
    where (p_tournament_id is null or tr.id = p_tournament_id)
      and (p_game_id is null or tr.game_id = p_game_id)
      and (p_from is null or tr.end_date::date >= p_from)
      and (p_to is null or tr.start_date::date <= p_to)
  ),
  -- Registrations for those tournaments, made in the date range
  r as (
    select reg.*
    from public.tournament_registrations reg
    join t on t.id = reg.tournament_id
    where (p_from is null or (reg.registered_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (reg.registered_at at time zone 'Asia/Manila')::date <= p_to)
  ),
  -- Matches of those tournaments, without byes (a bye isn't really played).
  -- A match without a time counts on the day it was last updated.
  m as (
    select mt.*
    from public.matches mt
    join t on t.id = mt.tournament_id
    where not (mt.round = 1 and (mt.team_a_id is null or mt.team_b_id is null))
      and (p_from is null or (coalesce(mt.scheduled_at, mt.updated_at) at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (coalesce(mt.scheduled_at, mt.updated_at) at time zone 'Asia/Manila')::date <= p_to)
  ),
  -- Teams for the game, created in the date range; with a tournament filter, only
  -- teams with an active (pending/approved) registration for that tournament
  tm as (
    select te.*
    from public.teams te
    where (p_game_id is null or te.game_id = p_game_id)
      and (p_tournament_id is null or exists (
        select 1 from public.tournament_registrations reg
        where reg.team_id = te.id and reg.tournament_id = p_tournament_id
          and reg.status in ('pending', 'approved')))
      and (p_from is null or (te.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (te.created_at at time zone 'Asia/Manila')::date <= p_to)
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from u),
      'tournaments', (select count(*) from t),
      'registrations', (select count(*) from r),
      'teams', (select count(*) from tm),
      'players_in_teams', (select count(distinct mem.user_id)
                           from public.team_members mem join tm on tm.id = mem.team_id),
      'matches_played', (select count(*) from m where m.status = 'completed'),
      'matches_total', (select count(*) from m)
    ),
    'users_by_role', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb)
      from (select u.role, count(*) as count from u group by u.role) x
    ),
    'signups_by_month', (
      select coalesce(jsonb_agg(x order by x.month), '[]'::jsonb)
      from (select date_trunc('month', u.joined_on::timestamp)::date as month, count(*) as count
            from u group by 1) x
    ),
    'registrations_by_status', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb)
      from (select r.status, count(*) as count from r group by r.status) x
    ),
    'matches_by_status', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb)
      from (select m.status, count(*) as count from m group by m.status) x
    ),
    'teams_by_game', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb)
      from (select g.name as game, count(*) as count
            from tm join public.games g on g.id = tm.game_id
            group by g.name) x
    ),
    -- One row per tournament. The app works out the shown status from the dates
    -- with getTournamentStatus(), the same as on every other page.
    'tournaments', (
      select coalesce(jsonb_agg(x order by x.start_date desc), '[]'::jsonb)
      from (
        select t.id, t.name, t.game, t.status, t.start_date, t.end_date, t.registration_deadline,
               t.max_participants,
               (select count(*) from public.tournament_registrations reg
                where reg.tournament_id = t.id and reg.status = 'approved') as approved_teams,
               (select count(*) from public.tournament_registrations reg
                where reg.tournament_id = t.id and reg.status = 'pending') as pending_teams,
               (select count(*) from m where m.tournament_id = t.id and m.status = 'completed') as matches_played,
               (select count(*) from m where m.tournament_id = t.id) as matches_total
        from t
      ) x
    )
  ) into result;

  return result;
end $$;

-- Sentiment Analysis Report & viewer feedback insights (admin)
create or replace function public.report_sentiment(
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
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Only admins can view the sentiment report.';
  end if;

  with f as (
    -- General feedback (no tournament) is left out once a tournament or game is chosen
    select fb.*, tr.name as tournament_name,
           (fb.created_at at time zone 'Asia/Manila')::date as local_day
    from public.feedback fb
    left join public.tournaments tr on tr.id = fb.tournament_id
    where (p_tournament_id is null or fb.tournament_id = p_tournament_id)
      and (p_game_id is null or tr.game_id = p_game_id)
      and (p_from is null or (fb.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (fb.created_at at time zone 'Asia/Manila')::date <= p_to)
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'total', count(*),
        'positive', count(*) filter (where f.sentiment = 'positive'),
        'neutral', count(*) filter (where f.sentiment = 'neutral'),
        'negative', count(*) filter (where f.sentiment = 'negative'),
        'pending', count(*) filter (where f.sentiment is null),
        'avg_rating', round(avg(f.rating), 2),
        'avg_score', round(avg(f.sentiment_score), 2)
      )
      from f
    ),
    -- Trend: one row per week (weeks start on Monday)
    'by_week', (
      select coalesce(jsonb_agg(x order by x.week), '[]'::jsonb)
      from (
        select date_trunc('week', f.local_day::timestamp)::date as week,
               count(*) as total,
               count(*) filter (where f.sentiment = 'positive') as positive,
               count(*) filter (where f.sentiment = 'neutral') as neutral,
               count(*) filter (where f.sentiment = 'negative') as negative,
               count(*) filter (where f.sentiment is null) as pending,
               round(avg(f.rating), 2) as avg_rating
        from f group by 1
      ) x
    ),
    -- Per tournament; tournament_name is null for general feedback
    'by_tournament', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb)
      from (
        select f.tournament_id, f.tournament_name,
               count(*) as total,
               count(*) filter (where f.sentiment = 'positive') as positive,
               count(*) filter (where f.sentiment = 'neutral') as neutral,
               count(*) filter (where f.sentiment = 'negative') as negative,
               count(*) filter (where f.sentiment is null) as pending,
               round(avg(f.rating), 2) as avg_rating,
               round(avg(f.sentiment_score), 2) as avg_score
        from f group by f.tournament_id, f.tournament_name
      ) x
    ),
    -- Topics split by sentiment. "Common concerns" = topics sorted by negative count.
    'topics', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb)
      from (
        select tp.topic,
               count(*) as total,
               count(*) filter (where f.sentiment = 'positive') as positive,
               count(*) filter (where f.sentiment = 'neutral') as neutral,
               count(*) filter (where f.sentiment = 'negative') as negative
        from f cross join lateral unnest(f.topics) as tp(topic)
        group by tp.topic
        order by count(*) desc
        limit 20
      ) x
    ),
    -- A few of the most negative comments, as examples for the committee
    'negative_examples', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
      from (
        select f.comment, f.rating, f.sentiment_score, f.topics, f.tournament_name, f.created_at
        from f
        where f.sentiment = 'negative'
        order by f.sentiment_score asc nulls last, f.created_at desc
        limit 5
      ) x
    )
  ) into result;

  return result;
end $$;

-- Viewership & Audience Engagement Stats (admin and staff)
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
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'streams', (select count(*) from s),
      'live_streams', (select count(*) from s where s.status = 'live'),
      'views', (select count(*) from v),
      'unique_viewers', (select count(distinct v.user_id) from v),
      'feedback', (select count(*) from f),
      'avg_rating', (select round(avg(f.rating), 2) from f)
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
    )
  ) into result;

  return result;
end $$;

revoke execute on function public.report_activity(uuid, text, date, date) from public, anon;
revoke execute on function public.report_sentiment(uuid, text, date, date) from public, anon;
revoke execute on function public.report_engagement(uuid, text, date, date) from public, anon;
grant execute on function public.report_activity(uuid, text, date, date) to authenticated;
grant execute on function public.report_sentiment(uuid, text, date, date) to authenticated;
grant execute on function public.report_engagement(uuid, text, date, date) to authenticated;

commit;
