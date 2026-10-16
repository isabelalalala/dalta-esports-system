-- Report consistency fixes (assessment area H).
--
-- - report_activity: approved_teams/pending_teams counted all-time registrations
--   while the rest of the row used the date-filtered CTEs, so a date-ranged
--   report showed lifetime team counts next to in-range match counts. They now
--   count from r (same filtered set as registrations_by_status).
-- - report_engagement: prediction_participation divided date-filtered predictors
--   by ALL player/spectator accounts. The denominator is now accounts that
--   existed by the end of the range (coalesce p_to, today in Manila).
-- - stream_views(viewed_on) index: report_engagement's v CTE range-scans it.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

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
    -- approved_teams/pending_teams count the same date-filtered registrations (r)
    -- as registrations_by_status, so the row stays internally consistent.
    'tournaments', (
      select coalesce(jsonb_agg(x order by x.start_date desc), '[]'::jsonb)
      from (
        select t.id, t.name, t.game, t.status, t.start_date, t.end_date, t.registration_deadline,
               t.max_participants,
               (select count(*) from r where r.tournament_id = t.id and r.status = 'approved') as approved_teams,
               (select count(*) from r where r.tournament_id = t.id and r.status = 'pending') as pending_teams,
               (select count(*) from m where m.tournament_id = t.id and m.status = 'completed') as matches_played,
               (select count(*) from m where m.tournament_id = t.id) as matches_total
        from t
      ) x
    )
  ) into result;

  return result;
end $$;

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
  -- Accounts that existed by the end of the range: the denominator for
  -- prediction_participation. Without an end date that is simply "today".
  audience as (
    select count(*) as accounts
    from public.profiles
    where role in ('player', 'spectator')
      and (created_at at time zone 'Asia/Manila')::date
          <= coalesce(p_to, (now() at time zone 'Asia/Manila')::date)
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
      -- % of player/spectator accounts (that existed by the range end) with a pick
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

-- report_engagement's v CTE range-scans viewed_on; the unique key leads with stream_id
create index if not exists stream_views_viewed_on_idx on public.stream_views (viewed_on);

commit;
