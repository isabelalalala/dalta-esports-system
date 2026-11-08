-- Animated counters on the homepage and About page (components/site/SiteStats.tsx)
--
-- Logged-out visitors can't read profiles or teams, so this returns only four totals (no names,
-- no rows). No new table, so no new RLS policies. Run in the Supabase SQL Editor.

create or replace function public.get_site_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'players', (select count(*) from public.profiles where role = 'player'),
    'teams', (select count(*) from public.teams where not is_removed),
    'tournaments', (select count(*) from public.tournaments where status <> 'cancelled'),
    -- finished matches between two real teams (byes don't count, same rule as the reports)
    'matches', (
      select count(*) from public.matches
      where status = 'completed' and team_a_id is not null and team_b_id is not null
    )
  )
$$;

revoke execute on function public.get_site_stats() from public;
grant execute on function public.get_site_stats() to anon, authenticated;
