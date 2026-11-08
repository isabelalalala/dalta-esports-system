-- Phase 5: reports with written interpretations.
--
-- 1. report_activity(): adds registrations_by_day (registrations over time). Copied from its latest
--    version (202610181600_report_consistency); nothing else changes.
-- 2. report_comments(): stream comment sentiment in the SAME shape as report_sentiment() (totals,
--    by_week, by_tournament, topics, negative_examples) plus by_stream, so the report can show
--    feedback, comments, or both combined (the "data source" filter). Admin only.
--    negative_examples only include visible comments (approved/restored), never author names.
-- 3. report_moderation(): warnings, hidden/removed/restored comments and feedback, offense types,
--    accounts flagged/banned (from the activity log). Admin only.
-- 4. analytics_reports: generating and deleting a saved report are written to the activity log
--    (report.generated, report.deleted).
--
-- All report functions take (p_tournament_id, p_game_id, p_from, p_to); null = all; dates are
-- inclusive in Manila time. General feedback is left out when a tournament or game is chosen.
--
-- Run in the Supabase SQL Editor after 202611081600_fix_refuse_removed_team.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. report_activity + registrations_by_day
-- ---------------------------------------------------------------------------
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
    -- Registrations over time (Phase 5): one row per Manila day with registrations
    'registrations_by_day', (
      select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb)
      from (select (r.registered_at at time zone 'Asia/Manila')::date as day,
                   count(*) as total,
                   count(*) filter (where r.status = 'approved') as approved
            from r group by 1) x
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

-- ---------------------------------------------------------------------------
-- 2. report_comments: comment sentiment shaped like report_sentiment()
-- ---------------------------------------------------------------------------
create or replace function public.report_comments(
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
    raise exception 'Only admins can view the comment report.';
  end if;

  with c as (
    select sc.id, sc.stream_id, sc.content, sc.created_at, sc.sentiment_label as sentiment,
           sc.sentiment_score, sc.topics, sc.moderation_status,
           s.title as stream_title, s.tournament_id, tr.name as tournament_name,
           (sc.created_at at time zone 'Asia/Manila')::date as local_day
    from public.stream_comments sc
    join public.streams s on s.id = sc.stream_id
    join public.tournaments tr on tr.id = s.tournament_id
    where (p_tournament_id is null or s.tournament_id = p_tournament_id)
      and (p_game_id is null or tr.game_id = p_game_id)
      and (p_from is null or (sc.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (sc.created_at at time zone 'Asia/Manila')::date <= p_to)
  )
  select jsonb_build_object(
    -- Comments have no star rating: avg_rating is always null
    'totals', (
      select jsonb_build_object(
        'total', count(*),
        'positive', count(*) filter (where c.sentiment = 'positive'),
        'neutral', count(*) filter (where c.sentiment = 'neutral'),
        'negative', count(*) filter (where c.sentiment = 'negative'),
        'pending', count(*) filter (where c.sentiment is null),
        'avg_rating', null,
        'avg_score', round(avg(c.sentiment_score), 2)
      )
      from c
    ),
    'by_week', (
      select coalesce(jsonb_agg(x order by x.week), '[]'::jsonb)
      from (
        select date_trunc('week', c.local_day::timestamp)::date as week,
               count(*) as total,
               count(*) filter (where c.sentiment = 'positive') as positive,
               count(*) filter (where c.sentiment = 'neutral') as neutral,
               count(*) filter (where c.sentiment = 'negative') as negative,
               count(*) filter (where c.sentiment is null) as pending,
               null::numeric as avg_rating
        from c group by 1
      ) x
    ),
    'by_tournament', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb)
      from (
        select c.tournament_id, c.tournament_name,
               count(*) as total,
               count(*) filter (where c.sentiment = 'positive') as positive,
               count(*) filter (where c.sentiment = 'neutral') as neutral,
               count(*) filter (where c.sentiment = 'negative') as negative,
               count(*) filter (where c.sentiment is null) as pending,
               null::numeric as avg_rating,
               round(avg(c.sentiment_score), 2) as avg_score
        from c group by c.tournament_id, c.tournament_name
      ) x
    ),
    'topics', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb)
      from (
        select tp.topic,
               count(*) as total,
               count(*) filter (where c.sentiment = 'positive') as positive,
               count(*) filter (where c.sentiment = 'neutral') as neutral,
               count(*) filter (where c.sentiment = 'negative') as negative
        from c cross join lateral unnest(c.topics) as tp(topic)
        group by tp.topic
        order by count(*) desc
        limit 20
      ) x
    ),
    -- Only comments everyone can still see; no author
    'negative_examples', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
      from (
        select c.content as comment, null::int as rating, c.sentiment_score, c.topics,
               c.tournament_name, c.created_at
        from c
        where c.sentiment = 'negative' and c.moderation_status in ('approved', 'restored')
        order by c.sentiment_score asc nulls last, c.created_at desc
        limit 5
      ) x
    ),
    -- Comments per stream (engagement per stream)
    'by_stream', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb)
      from (
        select c.stream_id, c.stream_title as title, c.tournament_name, count(*) as total
        from c group by c.stream_id, c.stream_title, c.tournament_name
      ) x
    )
  ) into result;

  return result;
end $$;

revoke execute on function public.report_comments(uuid, text, date, date) from public, anon;
grant execute on function public.report_comments(uuid, text, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. report_moderation: warnings, hidden content, offense types, bans
-- ---------------------------------------------------------------------------
create or replace function public.report_moderation(
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
    raise exception 'Only admins can view the moderation report.';
  end if;

  with
  -- Comments posted in the range, on streams of matching tournaments
  c as (
    select sc.id, sc.is_profane, sc.is_offensive, sc.offense_type, sc.moderation_status
    from public.stream_comments sc
    join public.streams s on s.id = sc.stream_id
    join public.tournaments tr on tr.id = s.tournament_id
    where (p_tournament_id is null or s.tournament_id = p_tournament_id)
      and (p_game_id is null or tr.game_id = p_game_id)
      and (p_from is null or (sc.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (sc.created_at at time zone 'Asia/Manila')::date <= p_to)
  ),
  -- Feedback sent in the range (general feedback only when no tournament/game is chosen)
  f as (
    select fb.id, fb.is_profane, fb.is_offensive, fb.offense_type, fb.moderation_status
    from public.feedback fb
    left join public.tournaments tr on tr.id = fb.tournament_id
    where (p_tournament_id is null or fb.tournament_id = p_tournament_id)
      and (p_game_id is null or tr.game_id = p_game_id)
      and (p_from is null or (fb.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (fb.created_at at time zone 'Asia/Manila')::date <= p_to)
  ),
  -- Warnings issued in the range. With a tournament/game filter: only warnings whose comment or
  -- feedback belongs to a matching tournament.
  w as (
    select uw.*, (uw.created_at at time zone 'Asia/Manila')::date as local_day
    from public.user_warnings uw
    where (p_from is null or (uw.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (uw.created_at at time zone 'Asia/Manila')::date <= p_to)
      and (
        (p_tournament_id is null and p_game_id is null)
        or (uw.source = 'comment' and exists (
              select 1 from public.stream_comments sc
              join public.streams s on s.id = sc.stream_id
              join public.tournaments tr on tr.id = s.tournament_id
              where sc.id = uw.source_id
                and (p_tournament_id is null or s.tournament_id = p_tournament_id)
                and (p_game_id is null or tr.game_id = p_game_id)))
        or (uw.source = 'feedback' and exists (
              select 1 from public.feedback fb
              join public.tournaments tr on tr.id = fb.tournament_id
              where fb.id = uw.source_id
                and (p_tournament_id is null or fb.tournament_id = p_tournament_id)
                and (p_game_id is null or tr.game_id = p_game_id)))
      )
  ),
  -- Ban decisions in the range, from the activity log (tournament/game filters don't apply:
  -- an account is flagged for all its warnings together)
  l as (
    select a.action
    from public.activity_logs a
    where a.action in ('user.ban_flagged', 'user.ban_confirmed', 'user.banned', 'user.ban_dismissed', 'user.unbanned')
      and (p_from is null or (a.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (a.created_at at time zone 'Asia/Manila')::date <= p_to)
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'warnings', (select count(*) from w),
      'active_warnings', (select count(*) from w where w.removed_at is null),
      'removed_warnings', (select count(*) from w where w.removed_at is not null),
      'ai_warnings', (select count(*) from w where w.issued_by is null),
      'moderator_warnings', (select count(*) from w where w.issued_by is not null),
      'profanity_warnings', (select count(*) from w where w.type = 'profanity'),
      'offensive_warnings', (select count(*) from w where w.type = 'offensive'),
      'comments', (select count(*) from c),
      'comments_profane', (select count(*) from c where c.is_profane),
      'comments_offensive', (select count(*) from c where c.is_offensive),
      'comments_hidden', (select count(*) from c where c.moderation_status = 'hidden'),
      'comments_removed', (select count(*) from c where c.moderation_status = 'removed'),
      'comments_restored', (select count(*) from c where c.moderation_status = 'restored'),
      'feedback', (select count(*) from f),
      'feedback_profane', (select count(*) from f where f.is_profane),
      'feedback_offensive', (select count(*) from f where f.is_offensive),
      'feedback_hidden', (select count(*) from f where f.moderation_status = 'hidden'),
      'feedback_removed', (select count(*) from f where f.moderation_status = 'removed'),
      'feedback_restored', (select count(*) from f where f.moderation_status = 'restored'),
      'accounts_flagged', (select count(*) from l where l.action = 'user.ban_flagged'),
      'accounts_banned', (select count(*) from l where l.action in ('user.ban_confirmed', 'user.banned')),
      'bans_dismissed', (select count(*) from l where l.action = 'user.ban_dismissed'),
      'accounts_unbanned', (select count(*) from l where l.action = 'user.unbanned'),
      -- Right now, whatever the filters
      'pending_bans_now', (select count(*) from public.profiles p where p.ban_status = 'pending'),
      'banned_now', (select count(*) from public.profiles p where p.ban_status = 'banned')
    ),
    'warnings_by_week', (
      select coalesce(jsonb_agg(x order by x.week), '[]'::jsonb)
      from (
        select date_trunc('week', w.local_day::timestamp)::date as week,
               count(*) filter (where w.type = 'profanity') as profanity,
               count(*) filter (where w.type = 'offensive') as offensive
        from w group by 1
      ) x
    ),
    'offense_types', (
      select coalesce(jsonb_agg(x order by x.count desc), '[]'::jsonb)
      from (
        select o.offense_type, count(*) as count
        from (select c.offense_type from c where c.is_offensive
              union all
              select f.offense_type from f where f.is_offensive) o
        where o.offense_type <> 'none'
        group by o.offense_type
      ) x
    )
  ) into result;

  return result;
end $$;

revoke execute on function public.report_moderation(uuid, text, date, date) from public, anon;
grant execute on function public.report_moderation(uuid, text, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Activity log for saved reports
-- ---------------------------------------------------------------------------
create or replace function public.log_analytics_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Changes made by other triggers or cascades aren't logged
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_activity('report.generated', 'analytics_report', new.id,
      jsonb_build_object('filters', new.filters));
  else
    perform public.log_activity('report.deleted', 'analytics_report', old.id,
      jsonb_build_object('filters', old.filters, 'generated_at', old.generated_at));
  end if;
  return null;
end $$;

drop trigger if exists analytics_reports_log on public.analytics_reports;
create trigger analytics_reports_log
  after insert or delete on public.analytics_reports
  for each row execute function public.log_analytics_report();

commit;
