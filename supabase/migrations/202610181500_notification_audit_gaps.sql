-- Notification and audit coverage gaps (assessment area I).
--
-- - tournament cancelled -> members of registered teams get a notification
--   (new type tournament_cancelled; there was no trigger on tournaments at all)
-- - admin-deleted registration -> the captain is told (new type
--   registration_removed; the notify trigger was UPDATE-only)
-- - match reschedule/status edits now write an activity_logs row
--   (previously only winner/score changes were logged, so the edit that also
--   wipes check-ins was invisible to the audit trail)
-- - every match_result_submissions status change is audited
--   (submit/confirm/dispute/approve/override/reject -> result.<status>)
-- - nits: completed matches no longer send reschedule/live notifications, the
--   rescheduled message says check-ins were reset, and a confirmed result also
--   tells the captain who submitted it.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Two new notification types
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved', 'registration_rejected', 'registration_removed',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'checkin_open', 'match_forfeit',
  'result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected',
  'tournament_cancelled',
  'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'team_added',  -- no longer sent (players join by invite); kept for older rows
  'member_left', 'member_removed',
  'student_verified', 'student_rejected', 'student_revoked'
));

-- ---------------------------------------------------------------------------
-- 2. Tournament cancelled -> every member of a pending/approved team
-- ---------------------------------------------------------------------------
create or replace function public.notify_tournament()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  members uuid[];
begin
  if new.status <> 'cancelled' or old.status is not distinct from 'cancelled' then
    return null;
  end if;

  select public.team_member_ids(coalesce(array_agg(team_id), '{}')) into members
  from public.tournament_registrations
  where tournament_id = new.id and status in ('pending', 'approved');

  perform public.notify_users(members, 'tournament_cancelled', 'Tournament cancelled',
    format('%s was cancelled.', new.name), '/tournaments/' || new.id);
  return null;
end $$;

create trigger tournaments_notify
  after update on public.tournaments
  for each row execute function public.notify_tournament();

-- ---------------------------------------------------------------------------
-- 3. Registration deleted -> the captain (an organizer deleting one was silent).
--    The captain cancelling their own registration notifies only themselves,
--    which notify_users filters out.
-- ---------------------------------------------------------------------------
create or replace function public.notify_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_name text;
  captain uuid;
  tour_name text;
begin
  if tg_op = 'DELETE' then
    select tm.name, tm.captain_id into team_name, captain from public.teams tm where tm.id = old.team_id;
    select name into tour_name from public.tournaments where id = old.tournament_id;

    perform public.notify_users(
      array[coalesce(captain, old.user_id)],
      'registration_removed',
      'Registration removed',
      format('%s was removed from %s.', coalesce(team_name, old.team_name, 'Your team'), tour_name),
      '/registrations');
    return null;
  end if;

  if new.status is not distinct from old.status or new.status not in ('approved', 'rejected') then
    return null;
  end if;

  select tm.name, tm.captain_id into team_name, captain from public.teams tm where tm.id = new.team_id;
  select name into tour_name from public.tournaments where id = new.tournament_id;

  perform public.notify_users(
    array[coalesce(captain, new.user_id)],
    'registration_' || new.status,
    case when new.status = 'approved' then 'Registration approved' else 'Registration rejected' end,
    format('%s was %s for %s.', coalesce(team_name, new.team_name, 'Your team'), new.status, tour_name),
    '/registrations');
  return null;
end $$;

drop trigger if exists tournament_registrations_notify on public.tournament_registrations;
create trigger tournament_registrations_notify
  after update or delete on public.tournament_registrations
  for each row execute function public.notify_registration();

-- ---------------------------------------------------------------------------
-- 4. Match edits -> activity log (result changes keep the existing entry).
--    scheduled_at/status/score columns are reported; winner moves into the
--    next match, checkin timestamps and forfeit flags stay unlogged.
-- ---------------------------------------------------------------------------
create or replace function public.log_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tour_name text;
  team_count int;
  fields text[];
begin
  if pg_trigger_depth() > 1 then return null; end if;

  select name into tour_name from public.tournaments where id = new.tournament_id;

  if tg_op = 'INSERT' then
    if new.next_match_id is not null then return null; end if;
    select count(*) into team_count
    from public.tournament_registrations
    where tournament_id = new.tournament_id and status = 'approved';

    perform public.log_activity('bracket.generated', 'tournament', new.tournament_id,
      jsonb_build_object('tournament_name', tour_name, 'tournament_id', new.tournament_id,
                         'rounds', new.round, 'teams', team_count));
    return null;
  end if;

  if new.winner_team_id is not distinct from old.winner_team_id
     and new.score_a is not distinct from old.score_a
     and new.score_b is not distinct from old.score_b then

    -- Non-result edit: a reschedule also wipes check-ins, so log what changed.
    select coalesce(array_agg(f order by f), '{}') into fields
    from unnest(public.changed_columns(to_jsonb(old), to_jsonb(new))) f
    where f <> all (array['checkin_notified_at', 'next_match_id', 'team_a_id', 'team_b_id', 'is_forfeit']);
    if cardinality(fields) = 0 then return null; end if;

    perform public.log_activity('match.edited', 'match', new.id,
      jsonb_build_object(
        'tournament_name', tour_name,
        'tournament_id', new.tournament_id,
        'round', new.round,
        'round_count', (select max(round) from public.matches where tournament_id = new.tournament_id),
        'match_number', new.match_number,
        'team_a', (select name from public.teams where id = new.team_a_id),
        'team_b', (select name from public.teams where id = new.team_b_id),
        'fields', to_jsonb(fields)));
    return null;
  end if;

  perform public.log_activity('match.result', 'match', new.id,
    jsonb_build_object(
      'tournament_name', tour_name,
      'tournament_id', new.tournament_id,
      'round', new.round,
      'round_count', (select max(round) from public.matches where tournament_id = new.tournament_id),
      'match_number', new.match_number,
      'team_a', (select name from public.teams where id = new.team_a_id),
      'team_b', (select name from public.teams where id = new.team_b_id),
      'score_a', new.score_a,
      'score_b', new.score_b,
      'winner', (select name from public.teams where id = new.winner_team_id),
      'forfeit', new.is_forfeit));
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Result submissions -> activity log. Covers the reject path (which touched
--    only the submissions table) plus submits, confirms, disputes, approvals
--    and overrides — including the auto-rejects declare_forfeit performs.
-- ---------------------------------------------------------------------------
create or replace function public.log_match_result_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;

  select mt.round, mt.match_number, mt.tournament_id,
         t.name as tournament_name,
         ta.name as team_a, tb.name as team_b, st.name as team_name
  into m
  from public.matches mt
  join public.tournaments t on t.id = mt.tournament_id
  left join public.teams ta on ta.id = mt.team_a_id
  left join public.teams tb on tb.id = mt.team_b_id
  left join public.teams st on st.id = new.team_id
  where mt.id = new.match_id;

  perform public.log_activity(
    case when tg_op = 'INSERT' then 'result.submitted' else 'result.' || new.status end,
    'match', new.match_id,
    jsonb_build_object(
      'tournament_name', m.tournament_name,
      'tournament_id', m.tournament_id,
      'round', m.round,
      'round_count', (select max(round) from public.matches where tournament_id = m.tournament_id),
      'match_number', m.match_number,
      'team_a', m.team_a,
      'team_b', m.team_b,
      'team_name', m.team_name,
      'score_a', new.score_a,
      'score_b', new.score_b,
      'note', left(coalesce(new.dispute_reason, new.review_note), 200)));
  return null;
end $$;

create trigger match_result_submissions_log
  after insert or update on public.match_result_submissions
  for each row execute function public.log_match_result_submission();

-- ---------------------------------------------------------------------------
-- 6. notify_match: finished matches send nothing, and a reschedule tells teams
--    their check-ins were reset (scheduled_at changes wipe match_checkins).
-- ---------------------------------------------------------------------------
create or replace function public.notify_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  members uuid[];
  tour_name text;
  round_count int;
  round_name text;
  team_a text;
  team_b text;
  stream_id uuid;
  label text;
begin
  -- Winners moving into the next match (advance trigger) aren't news
  if pg_trigger_depth() > 1 then return null; end if;

  -- A completed match is over: editing its time afterwards is bookkeeping,
  -- not something to tell the teams about.
  if new.status = 'completed' then return null; end if;

  if not (
    (new.scheduled_at is not null and new.scheduled_at is distinct from old.scheduled_at)
    or (new.status = 'live' and old.status <> 'live')
  ) then
    return null;
  end if;

  members := public.team_member_ids(array[new.team_a_id, new.team_b_id]);
  if cardinality(members) = 0 then return null; end if;

  select name into tour_name from public.tournaments where id = new.tournament_id;
  select max(round) into round_count from public.matches where tournament_id = new.tournament_id;
  -- Same labels as roundLabel() in utils/tournaments.ts
  round_name := case round_count - new.round
                  when 0 then 'Final'
                  when 1 then 'Semifinals'
                  when 2 then 'Quarterfinals'
                  else 'Round ' || new.round end;
  select name into team_a from public.teams where id = new.team_a_id;
  select name into team_b from public.teams where id = new.team_b_id;
  label := format('%s vs %s (%s, %s)', coalesce(team_a, 'TBD'), coalesce(team_b, 'TBD'), round_name, tour_name);

  if new.status = 'live' and old.status <> 'live' then
    select id into stream_id from public.streams
    where match_id = new.id order by created_at desc limit 1;

    perform public.notify_users(members, 'match_live', 'Your match is live',
      label || ' has started.',
      case when stream_id is not null then '/live/' || stream_id else '/tournaments/' || new.tournament_id end);
  end if;

  if new.scheduled_at is not null and new.scheduled_at is distinct from old.scheduled_at then
    perform public.notify_users(members,
      case when old.scheduled_at is null then 'match_scheduled' else 'match_rescheduled' end,
      case when old.scheduled_at is null then 'Match scheduled' else 'Match rescheduled' end,
      -- Philippine time, since this text is saved and can't follow the reader's time zone
      format('%s: %s (PH time).%s', label,
             to_char(new.scheduled_at at time zone 'Asia/Manila', 'Mon FMDD, YYYY FMHH12:MI AM'),
             -- Rescheduling clears check-ins; teams that checked in must do it again.
             case when old.scheduled_at is not null then ' Check-ins were reset — check in again.' else '' end),
      '/tournaments/' || new.tournament_id);
  end if;

  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 7. respond_to_match_result: a confirm also tells the captain who submitted
--    (the disputed branch already did).
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_match_result(
  p_submission_id uuid,
  p_confirm boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  m record;
  label text;
begin
  select * into s from public.match_result_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Result not found.';
  end if;
  select * into m from public.matches where id = s.match_id;

  if not exists (
    select 1 from public.teams t
    where t.id in (m.team_a_id, m.team_b_id) and t.id <> s.team_id and t.captain_id = auth.uid()
  ) then
    raise exception 'Only the other team''s captain can confirm or dispute this result.';
  end if;
  if s.status <> 'pending' then
    raise exception 'This result has already been answered.';
  end if;
  if p_confirm is null then
    raise exception 'Please confirm or dispute the result.';
  end if;
  if not p_confirm and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Please explain what is wrong with the result.';
  end if;

  update public.match_result_submissions
  set status = case when p_confirm then 'confirmed' else 'disputed' end,
      dispute_reason = case when p_confirm then null else left(trim(p_reason), 500) end,
      responded_by = auth.uid(),
      responded_at = now()
  where id = p_submission_id;

  label := public.match_result_label(s.match_id, s.score_a, s.score_b);
  if p_confirm then
    perform public.notify_users(public.staff_ids() || s.submitted_by, 'result_confirmed', 'Result ready to approve',
      'Both captains agree: ' || label || '.', '/matches/' || s.match_id);
  else
    perform public.notify_users(public.staff_ids() || s.submitted_by, 'result_disputed', 'Result disputed',
      label || ' was disputed: ' || left(trim(p_reason), 200), '/matches/' || s.match_id);
  end if;
end $$;

commit;
