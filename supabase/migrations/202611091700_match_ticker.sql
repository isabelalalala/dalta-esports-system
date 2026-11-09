-- Results ticker on the homepage (components/site/MatchTicker.tsx)
--
-- Like get_live_now() (202611091100_live_now), logged-out visitors can't read teams, so this
-- returns only what the ticker shows: live matches, the latest results and the next scheduled
-- matches, with team NAMES and the tournament's name (no rosters, captains or emails). The
-- Privacy Notice already says team names, brackets and results are public. Byes (one team) and
-- cancelled tournaments are left out. No new table, so no new RLS policies.
-- Run in the Supabase SQL Editor.

create or replace function public.get_match_ticker()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select m.id, m.tournament_id, t.name as tournament_name, t.game, m.status, m.scheduled_at,
           m.updated_at, m.score_a, m.score_b, m.is_forfeit,
           ta.name as team_a, tb.name as team_b,
           case
             when m.winner_team_id is null then null
             when m.winner_team_id = m.team_a_id then 'a'
             else 'b'
           end as winner
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
    'results', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.updated_at desc), '[]'::jsonb)
      from (select * from visible where status = 'completed' order by updated_at desc limit 8) v
    ),
    'next', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.scheduled_at), '[]'::jsonb)
      from (
        select * from visible
        where status = 'scheduled' and scheduled_at > now()
        order by scheduled_at limit 6
      ) v
    )
  )
$$;

revoke execute on function public.get_match_ticker() from public;
grant execute on function public.get_match_ticker() to anon, authenticated;
