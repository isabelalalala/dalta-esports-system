-- Export logging: every download from /api/exports is recorded in activity_logs.
-- log_activity() stays closed to the app; this function lets organizers log their own
-- exports only (it checks the role, and the action is always 'export.<type>').
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

create or replace function public.log_export(p_type text, p_details jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_role text := coalesce(public.get_my_role(), '');
begin
  if p_type not in ('registrations', 'rosters', 'matches', 'feedback', 'users') then
    raise exception 'Unknown export.';
  end if;
  -- Same rules as the export route: feedback and the user list are admin only
  if my_role not in ('admin', 'staff')
     or (p_type in ('feedback', 'users') and my_role <> 'admin') then
    raise exception 'You are not allowed to export this.';
  end if;

  perform public.log_activity('export.' || p_type, 'export', null,
    -- Only the keys the activity log page shows (no other data from the caller)
    jsonb_build_object(
      'export_format', p_details ->> 'format',
      'rows', (p_details ->> 'rows')::int,
      'tournament_name', p_details ->> 'tournament_name',
      'tournament_id', p_details ->> 'tournament_id',
      'filter', p_details ->> 'filter'));
end $$;

revoke execute on function public.log_export(text, jsonb) from public, anon;
grant execute on function public.log_export(text, jsonb) to authenticated;

commit;
