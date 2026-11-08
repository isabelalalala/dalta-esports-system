-- Phase 2.4.2: live updates for teams, rosters, invites and join requests.
--
-- Adds these tables to the supabase_realtime publication, so team pages update without a manual
-- refresh when a player joins or leaves, a join request arrives or is answered, an invite is sent,
-- or recruiting is switched (utils/use-realtime-refresh.ts). matches, match_checkins,
-- match_result_submissions and notifications are already in the publication.
--
-- Realtime still applies each table's SELECT policy: people only receive rows they may read
-- (team_members and teams: logged-in users; team_invites: the invited player and the captain;
-- team_join_requests: the player, the captain and organizers). DELETE events carry only the
-- row id, which the pages use only as a signal to reload.
--
-- Run in the Supabase SQL Editor after 202611081100_stream_video_id.sql.

begin;

do $$
declare
  t text;
begin
  foreach t in array array['teams', 'team_members', 'team_invites', 'team_join_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
