-- More notifications, mostly for organizers (admins and staff got almost none before):
-- - registration_submitted: a team registered (or re-registered) and waits for approval -> admins/staff
-- - registration_withdrawn: a captain withdrew a pending/approved registration -> admins/staff
-- - verification_submitted: a student sent verification details -> admins/staff
-- - role_changed: an admin changed your role -> you
-- - prediction_result: your Pick'em pick was right or wrong (match got a winner) -> you
--
-- Like all notifications, they are created only here, by AFTER triggers through notify_users()
-- (which skips the person who caused the change). No existing function is redefined.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Full list of notification types (latest before this: 202610181500) + 5 new ones
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved', 'registration_rejected', 'registration_removed',
  'registration_submitted', 'registration_withdrawn',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'checkin_open', 'match_forfeit',
  'result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected',
  'tournament_cancelled',
  'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'team_added',  -- no longer sent (players join by invite); kept for older rows
  'member_left', 'member_removed',
  'student_verified', 'student_rejected', 'student_revoked',
  'verification_submitted', 'role_changed',
  'prediction_result'
));

-- ---------------------------------------------------------------------------
-- 2. Registrations -> admins/staff
--    - new registration (insert), or a rejected/cancelled one sent again (back to pending)
--    - withdrawn by the captain: deleted while pending/approved (what My Registrations does)
--      or set to cancelled. Organizers removing or cancelling one don't notify the others.
-- ---------------------------------------------------------------------------
create or replace function public.notify_registration_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reg record;
  team_name text;
  tour_name text;
  actor_role text;
begin
  -- Cascades (e.g. a deleted tournament) aren't news
  if pg_trigger_depth() > 1 then return null; end if;

  if tg_op = 'DELETE' then reg := old; else reg := new; end if;
  select t.name into team_name from public.teams t where t.id = reg.team_id;
  select t.name into tour_name from public.tournaments t where t.id = reg.tournament_id;
  team_name := coalesce(team_name, reg.team_name, 'A team');

  if (tg_op = 'INSERT' and new.status = 'pending')
     or (tg_op = 'UPDATE' and new.status = 'pending' and old.status in ('rejected', 'cancelled')) then
    perform public.notify_users(public.staff_ids(), 'registration_submitted',
      'New registration to review',
      format('%s registered for %s and is waiting for approval.', team_name, tour_name),
      '/tournaments/' || reg.tournament_id || '/registrations');
    return null;
  end if;

  -- Withdrawals: only when the captain/player did it (SQL Editor and organizers are skipped)
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role is null or actor_role in ('admin', 'staff') then return null; end if;

  if (tg_op = 'DELETE' and old.status in ('pending', 'approved'))
     or (tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('pending', 'approved')) then
    perform public.notify_users(public.staff_ids(), 'registration_withdrawn',
      'Registration withdrawn',
      format('%s withdrew from %s. A slot is free again.', team_name, tour_name),
      '/tournaments/' || reg.tournament_id || '/registrations');
  end if;
  return null;
end $$;

create trigger tournament_registrations_notify_staff
  after insert or update or delete on public.tournament_registrations
  for each row execute function public.notify_registration_staff();

-- ---------------------------------------------------------------------------
-- 3. Profiles
--    - student details sent for review (status becomes pending) -> admins/staff
--      (name and school only; never the student ID)
--    - role changed by an admin -> that person
-- ---------------------------------------------------------------------------
create or replace function public.notify_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status = 'pending' and old.verification_status is distinct from 'pending' then
    perform public.notify_users(public.staff_ids(), 'verification_submitted',
      'Student verification to review',
      format('%s sent student details%s.',
             coalesce(nullif(trim(new.full_name), ''), 'A player'),
             coalesce(' (' || nullif(trim(new.school), '') || ')', '')),
      '/admin/verification');
  end if;

  if new.role is distinct from old.role then
    perform public.notify_users(array[new.id], 'role_changed', 'Your role changed',
      format('Your account is now: %s.',
             case new.role
               when 'admin' then 'Administrator'
               when 'staff' then 'Tournament Staff'
               when 'player' then 'Player'
               when 'spectator' then 'Spectator'
               else new.role end),
      '/dashboard');
  end if;
  return null;
end $$;

create trigger profiles_notify_change
  after update on public.profiles
  for each row execute function public.notify_profile_change();

-- ---------------------------------------------------------------------------
-- 4. Pick'em: mark_predictions() sets is_correct when a match gets (or changes) its winner.
--    One notification per pick; a cleared result (back to null) sends nothing.
--    No pg_trigger_depth() check: this always runs inside the matches trigger.
-- ---------------------------------------------------------------------------
create or replace function public.notify_prediction_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  team_a text;
  team_b text;
  picked text;
  tour_name text;
begin
  if new.is_correct is null or new.is_correct is not distinct from old.is_correct then
    return null;
  end if;

  select * into m from public.matches where id = new.match_id;
  select name into team_a from public.teams where id = m.team_a_id;
  select name into team_b from public.teams where id = m.team_b_id;
  select name into picked from public.teams where id = new.predicted_winner_team_id;
  select name into tour_name from public.tournaments where id = m.tournament_id;

  perform public.notify_users(array[new.user_id], 'prediction_result',
    case when new.is_correct then 'Pick''em: you called it!' else 'Pick''em: not this time' end,
    format('You picked %s in %s vs %s (%s).',
           coalesce(picked, 'a team'), coalesce(team_a, 'TBD'), coalesce(team_b, 'TBD'), tour_name),
    '/tournaments/' || m.tournament_id || '/predictions');
  return null;
end $$;

create trigger predictions_notify_result
  after update of is_correct on public.predictions
  for each row execute function public.notify_prediction_result();

-- Trigger functions aren't meant to be called directly
revoke execute on function public.notify_registration_staff() from public, anon, authenticated;
revoke execute on function public.notify_profile_change() from public, anon, authenticated;
revoke execute on function public.notify_prediction_result() from public, anon, authenticated;

commit;
