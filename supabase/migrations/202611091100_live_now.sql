-- "Live now" strip on the homepage (components/site/LiveNowStrip.tsx)
--
-- Logged-out visitors can read matches but not teams or streams, so like get_public_tournament()
-- this returns only what the strip shows: live matches and the next few scheduled ones, with
-- team NAMES and the tournament's name (no rosters, captains or emails; the Privacy Notice already
-- says team names, brackets and results are public). No new table, so no new RLS policies.
-- Run in the Supabase SQL Editor.

create or replace function public.get_live_now()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select m.id, m.tournament_id, t.name as tournament_name, t.game, t.game_id, m.round,
           m.status, m.scheduled_at, m.score_a, m.score_b,
           ta.name as team_a, tb.name as team_b,
           -- a live Facebook stream for this match or its tournament
           exists (
             select 1 from public.streams s
             where s.status = 'live' and (s.match_id = m.id or (s.match_id is null and s.tournament_id = t.id))
           ) as has_stream
    from public.matches m
    join public.tournaments t on t.id = m.tournament_id
    left join public.teams ta on ta.id = m.team_a_id
    left join public.teams tb on tb.id = m.team_b_id
    where t.status <> 'cancelled'
      and m.team_a_id is not null and m.team_b_id is not null
  )
  select jsonb_build_object(
    'live', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.scheduled_at nulls last), '[]'::jsonb)
      from (select * from visible where status = 'live' order by scheduled_at nulls last limit 6) v
    ),
    'next', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.scheduled_at), '[]'::jsonb)
      from (
        select * from visible
        where status = 'scheduled' and scheduled_at > now()
        order by scheduled_at limit 3
      ) v
    )
  )
$$;

revoke execute on function public.get_live_now() from public;
grant execute on function public.get_live_now() to anon, authenticated;
