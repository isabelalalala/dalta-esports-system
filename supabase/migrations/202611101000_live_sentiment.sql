-- Live sentiment "hype meter" on streams
--
-- 1. get_stream_sentiment_timeline(stream, bucket_seconds, since): admin/staff only. Comment
--    sentiment of one stream per time bucket while it is live (and afterwards), for the panel on
--    /live/[id] and the cards on /analytics/engagement (components/LiveSentimentMeter.tsx).
--    Aggregates only: never comment text, never user ids.
-- 2. report_comments(): redefined from its latest version (202611081700_report_insights) with a
--    `timeline` part: 1-minute buckets for the 5 streams with the most comments in the report
--    period, so a saved report keeps how the chat felt during the match.
--
-- Which comments count (same rules as the comment panel): only visible ones
-- (moderation_status approved / restored / pending; hidden and removed are left out).
-- "Analysed" = sentiment_label is set. "Analyzing" = visible, not analysed yet and fewer than 5
-- failed attempts (MAX_FEEDBACK_ANALYSIS_ATTEMPTS in utils/feedback.ts); "gave_up" = 5 or more.
--
-- The hype score itself is computed in the app (utils/live-sentiment.ts, with tests) from the
-- `recent` counts below, so the formula lives in one place.
--
-- No new personal data and no new group of readers: staff already read every comment (with its
-- sentiment) in the moderation queue. The Privacy Notice doesn't change.
--
-- Run in the Supabase SQL Editor after 202611092000_announcements_feed.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. get_stream_sentiment_timeline
-- ---------------------------------------------------------------------------
create or replace function public.get_stream_sentiment_timeline(
  p_stream_id uuid,
  p_bucket_seconds int default 60,
  p_since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- 30 s to 15 min buckets
  bucket int := greatest(30, least(coalesce(p_bucket_seconds, 60), 900));
  since timestamptz;
  result jsonb;
begin
  -- coalesce: a missing role (no session) must be refused too (null not in (...) is null)
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only organizers can view live sentiment.';
  end if;
  if not exists (select 1 from public.streams where id = p_stream_id) then
    raise exception 'This stream no longer exists.';
  end if;

  -- Default window: the last 2 hours. At most 240 buckets either way.
  since := greatest(
    coalesce(p_since, now() - interval '2 hours'),
    now() - make_interval(secs => bucket * 240)
  );

  with c as (
    select sc.created_at, sc.sentiment_label as sentiment, sc.sentiment_score, sc.topics,
           (sc.is_profane or sc.is_offensive) as flagged,
           sc.sentiment_label is null and sc.analysis_attempts < 5 as analyzing,
           sc.sentiment_label is null and sc.analysis_attempts >= 5 as gave_up,
           -- start of the bucket this comment falls in
           to_timestamp(floor(extract(epoch from sc.created_at) / bucket) * bucket) as bucket_start
    from public.stream_comments sc
    where sc.stream_id = p_stream_id
      and sc.moderation_status in ('approved', 'restored', 'pending')
      and sc.created_at >= since
  )
  select jsonb_build_object(
    'bucket_seconds', bucket,
    'since', since,
    'generated_at', now(),
    'buckets', (
      select coalesce(jsonb_agg(x order by x.bucket_start), '[]'::jsonb)
      from (
        select c.bucket_start,
               count(*) as total,
               count(*) filter (where c.sentiment = 'positive') as positive,
               count(*) filter (where c.sentiment = 'neutral') as neutral,
               count(*) filter (where c.sentiment = 'negative') as negative,
               count(*) filter (where c.analyzing) as analyzing,
               count(*) filter (where c.flagged) as flagged,
               round(avg(c.sentiment_score), 2) as avg_score
        from c group by c.bucket_start
      ) x
    ),
    'totals', (
      select jsonb_build_object(
        'total', count(*),
        'positive', count(*) filter (where c.sentiment = 'positive'),
        'neutral', count(*) filter (where c.sentiment = 'neutral'),
        'negative', count(*) filter (where c.sentiment = 'negative'),
        'flagged', count(*) filter (where c.flagged),
        'avg_score', round(avg(c.sentiment_score), 2)
      )
      from c
    ),
    -- Inputs for the hype score (utils/live-sentiment.ts): the last 5 minutes
    'recent', (
      select jsonb_build_object(
        'minutes', 5,
        'total', count(*),
        'positive', count(*) filter (where c.sentiment = 'positive'),
        'neutral', count(*) filter (where c.sentiment = 'neutral'),
        'negative', count(*) filter (where c.sentiment = 'negative')
      )
      from c where c.created_at >= now() - interval '5 minutes'
    ),
    'top_topics', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb)
      from (
        select tp.topic, count(*) as total
        from c cross join lateral unnest(c.topics) as tp(topic)
        where c.created_at >= now() - interval '10 minutes'
        group by tp.topic
        order by count(*) desc
        limit 6
      ) x
    ),
    'analyzing', (select count(*) from c where c.analyzing),
    'gave_up', (select count(*) from c where c.gave_up)
  ) into result;

  return result;
end $$;

revoke execute on function public.get_stream_sentiment_timeline(uuid, int, timestamptz) from public, anon;
grant execute on function public.get_stream_sentiment_timeline(uuid, int, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. report_comments: latest version (202611081700_report_insights) + `timeline`
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
    ),
    -- NEW (202611101000): sentiment per minute of the 5 busiest streams, visible comments only,
    -- so a saved report keeps how the chat felt during each match. Counts only, no text.
    'timeline', (
      select coalesce(jsonb_agg(st order by st.total desc), '[]'::jsonb)
      from (
        select top.stream_id, top.title, top.tournament_name, top.total,
               (
                 select coalesce(jsonb_agg(m order by m.minute), '[]'::jsonb)
                 from (
                   select date_trunc('minute', v.created_at) as minute,
                          count(*) as total,
                          count(*) filter (where v.sentiment = 'positive') as positive,
                          count(*) filter (where v.sentiment = 'neutral') as neutral,
                          count(*) filter (where v.sentiment = 'negative') as negative
                   from c v
                   where v.stream_id = top.stream_id
                     and v.moderation_status in ('approved', 'restored', 'pending')
                   group by 1
                 ) m
               ) as minutes
        from (
          select c.stream_id, c.stream_title as title, c.tournament_name, count(*) as total
          from c
          where c.moderation_status in ('approved', 'restored', 'pending')
          group by c.stream_id, c.stream_title, c.tournament_name
          order by count(*) desc
          limit 5
        ) top
      ) st
    )
  ) into result;

  return result;
end $$;

revoke execute on function public.report_comments(uuid, text, date, date) from public, anon;
grant execute on function public.report_comments(uuid, text, date, date) to authenticated;

commit;
