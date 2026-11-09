-- Game account IDs stay private (follows 202611091400_game_profile_schemas)
--
-- player_game_profiles.details now holds game account IDs (Riot ID, MLBB User/Zone ID, CODM UID,
-- Tekken ID) and platform/server. Every logged-in user may still read the profile itself (IGN,
-- in-game role, rank: rosters and invites need them), but NOT the details column:
--   - the column grant below leaves `details` out for logged-in users (anon never had access);
--   - the player reads their own details, and organizers (admin/staff) anyone's, through
--     get_game_profile_details() (security definer, checks who is asking).
-- Writes are unchanged: players insert/update their own rows (RLS) and the trigger
-- check_game_profile() validates them. Privacy Notice 2026-11-09 describes this.
-- No new table, so no new RLS policies. Run in the Supabase SQL Editor.

begin;

revoke select on public.player_game_profiles from anon, authenticated;
grant select (id, user_id, game_id, ign, in_game_role, rank, created_at)
  on public.player_game_profiles to authenticated;

-- The game-specific details of one user's profiles: the user themself, or an organizer
create or replace function public.get_game_profile_details(p_user_id uuid default null)
returns table (game_id text, details jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is null then
    raise exception 'Please log in.';
  end if;
  if target <> auth.uid() and public.get_my_role() not in ('admin', 'staff') then
    raise exception 'You can only see your own game account details.';
  end if;
  return query
    select gp.game_id, gp.details from public.player_game_profiles gp where gp.user_id = target;
end $$;

revoke execute on function public.get_game_profile_details(uuid) from public, anon;
grant execute on function public.get_game_profile_details(uuid) to authenticated;

commit;
