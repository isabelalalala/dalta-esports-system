-- Two small database fixes left open by the assessment (docs/assessment/assessment-summary.md):
-- 1. Nobody can remove a team's captain row from team_members, not even admin/staff.
--    Before, admin/staff could (the delete policy lets them remove anyone), which left a team
--    whose captain_id points at someone who is no longer a member. To change the captain,
--    use transfer_team_captaincy(); to get rid of the captain, delete the team.
--    Deleting the team or the captain's account still removes the row (that runs through
--    FK cascades, pg_trigger_depth() > 1), and so does the SQL Editor (auth.uid() is null).
-- 2. Index for the per-user Gemini limit in claim_gemini_call() (user_id + last 10 minutes).
--
-- Run in the Supabase SQL Editor after 202610251000_participant_limits.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. check_team_member_leave(): latest version from 202610171300_team_invites,
--    plus the captain-row check at the top.
-- ---------------------------------------------------------------------------
create or replace function public.check_team_member_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tour_name text;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return old;
  end if;

  -- Applies to everyone, admin/staff included
  if old.role = 'captain' then
    raise exception 'The captain can''t be removed from the team. Transfer the captaincy first, or delete the team.';
  end if;

  -- Organizers may change a locked roster
  if coalesce(public.get_my_role(), '') in ('admin', 'staff') then
    return old;
  end if;

  select tr.name into tour_name
  from public.tournament_registrations r
  join public.tournaments tr on tr.id = r.tournament_id
  where r.team_id = old.team_id
    and r.status in ('pending', 'approved')
    and tr.end_date::date >= current_date
  limit 1;

  if tour_name is not null then
    raise exception 'The roster is locked while the team is registered for %. Ask an organizer if a player must leave.', tour_name;
  end if;

  return old;
end $$;

-- ---------------------------------------------------------------------------
-- 2. gemini_calls: per-user lookups
-- ---------------------------------------------------------------------------
create index if not exists gemini_calls_user_called_at_idx
  on public.gemini_calls (user_id, called_at);

commit;
