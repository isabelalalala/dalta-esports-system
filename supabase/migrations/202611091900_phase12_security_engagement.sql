-- Phase 12: 2FA for organizers, notification preferences, scheduled announcements, comment reports
--
-- 1. get_my_role() (latest: 202610161200_role_security): an admin/staff account that has set up
--    two-factor authentication (a verified TOTP factor in auth.mfa_factors) but whose current
--    session hasn't passed the code step (JWT claim aal <> 'aal2') is treated as a spectator by every
--    RLS policy and function that uses get_my_role(). So a stolen password alone gives no organizer
--    powers. proxy.ts sends such sessions to /auth/mfa. Accounts without 2FA work as before.
-- 2. notification_preferences: which notification types a user turned off (own row only, RLS).
--    notify_users() (latest: 202610171200_notifications) skips muted types. Moderation, account and
--    removal notices can't be muted (CHECK below).
-- 3. announcements.publish_at / notified_at: admins can schedule an announcement. Until publish_at it
--    is visible to admins and staff only (RLS); its notification is sent at publish time by the
--    pg_cron job dalta-publish-announcements (every 5 minutes). notify_announcement() (latest:
--    202610171200_notifications) now uses send_announcement_notification().
-- 4. comment_reports: logged-in users report a visible chat comment the AI missed (one report per
--    person per comment, at most 10 per hour, not your own comment). Admin/staff read them on
--    /admin/moderation ("Reported" tab) and dismiss them with dismiss_comment_reports() or remove the
--    comment with moderate_comment(). The first report of a comment notifies admins/staff.
-- 5. Notification type 'comment_reported' (full list copied from 202611091800_team_cards_registrations).
--
-- Every new table enables RLS with its policies here. The Privacy Notice doesn't change: reports
-- are seen by the moderators who already see all comments, and preferences are private.
-- Run in the Supabase SQL Editor after 202611091800_team_cards_registrations.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Organizer powers need the 2FA step when 2FA is set up
-- ---------------------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.role in ('admin', 'staff')
         and exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
         and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
      then 'spectator'
    else p.role
  end
  from public.profiles p
  where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 2. Notification preferences
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  muted_types text[] not null default '{}',
  updated_at timestamptz not null default now(),
  -- Only these kinds can be turned off (moderation, account and removal notices always arrive)
  constraint notification_preferences_muted_check check (muted_types <@ array[
    'registration_approved', 'registration_rejected', 'registration_removed',
    'registration_submitted', 'registration_withdrawn',
    'match_scheduled', 'match_rescheduled', 'match_live',
    'checkin_open', 'match_forfeit',
    'result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected',
    'tournament_cancelled', 'announcement',
    'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
    'member_left', 'member_removed',
    'join_request', 'join_request_accepted', 'join_request_declined',
    'student_verified', 'student_rejected', 'student_revoked', 'verification_submitted',
    'prediction_result', 'comment_reported'
  ]::text[])
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users read their own notification preferences" on public.notification_preferences;
create policy "Users read their own notification preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users create their own notification preferences" on public.notification_preferences;
create policy "Users create their own notification preferences"
  on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users change their own notification preferences" on public.notification_preferences;
create policy "Users change their own notification preferences"
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.touch_notification_preferences()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function public.touch_notification_preferences();

-- Latest version (202610171200_notifications) + skip people who muted this type
create or replace function public.notify_users(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_message text,
  p_link text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, message, link)
  select distinct p.id, p_type, p_title, coalesce(p_message, ''), p_link
  from unnest(p_user_ids) as u(id)
  join public.profiles p on p.id = u.id
  where p.id is distinct from auth.uid()
    and not exists (
      select 1 from public.notification_preferences np
      where np.user_id = p.id and p_type = any (np.muted_types)
    )
$$;

revoke execute on function public.notify_users(uuid[], text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Scheduled announcements
-- ---------------------------------------------------------------------------
alter table public.announcements
  add column if not exists publish_at timestamptz not null default now(),
  add column if not exists notified_at timestamptz;

create index if not exists announcements_publish_idx on public.announcements (publish_at);

drop policy if exists "Logged-in users can read announcements" on public.announcements;
drop policy if exists "Logged-in users read published announcements" on public.announcements;
create policy "Logged-in users read published announcements"
  on public.announcements for select to authenticated
  using (publish_at <= now() or public.get_my_role() in ('admin', 'staff'));

-- Sends one announcement's notification (everyone, or the teams registered for its tournament)
create or replace function public.send_announcement_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements;
  recipients uuid[];
  tour_name text;
begin
  select * into a from public.announcements where id = p_id;
  if not found then return; end if;

  if a.tournament_id is null then
    select array_agg(id) into recipients from public.profiles;
  else
    select name into tour_name from public.tournaments where id = a.tournament_id;
    select public.team_member_ids(coalesce(array_agg(r.team_id), '{}')) into recipients
    from public.tournament_registrations r
    where r.tournament_id = a.tournament_id
      and r.status in ('pending', 'approved')
      and r.team_id is not null;
  end if;

  perform public.notify_users(coalesce(recipients, '{}'), 'announcement',
    case when tour_name is null then 'New announcement' else 'New announcement: ' || tour_name end,
    a.title, '/announcements');
end $$;

revoke execute on function public.send_announcement_notification(uuid) from public, anon, authenticated;

-- Published now: mark it sent before the row is written; the AFTER trigger then notifies
create or replace function public.prepare_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.publish_at is null then new.publish_at := now(); end if;
  if new.publish_at <= now() then
    new.notified_at := now();
  else
    new.notified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists announcements_prepare on public.announcements;
create trigger announcements_prepare
  before insert on public.announcements
  for each row execute function public.prepare_announcement();

create or replace function public.notify_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.notified_at is not null then
    perform public.send_announcement_notification(new.id);
  end if;
  return null;
end $$;

-- pg_cron: send the notifications of announcements whose time has come. The flag
-- app.publishing_announcement keeps that bookkeeping update from counting as an edit
-- (touch_announcement / log_announcement below).
create or replace function public.publish_scheduled_announcements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  due uuid;
begin
  perform set_config('app.publishing_announcement', 'on', true);
  for due in
    select id from public.announcements
    where notified_at is null and publish_at <= now()
    order by publish_at
    for update skip locked
  loop
    update public.announcements set notified_at = now() where id = due;
    perform public.send_announcement_notification(due);
  end loop;
  perform set_config('app.publishing_announcement', 'off', true);
end $$;

-- Latest version (202610162000_announcements) + leave updated_at alone when only publishing
create or replace function public.touch_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.publishing_announcement', true), '') = 'on' then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  -- The author and post date stay as they were
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  -- Moving the publish time back into the future (re)schedules the notification
  if new.publish_at is distinct from old.publish_at and new.publish_at > now() then
    new.notified_at := null;
  end if;
  return new;
end $$;

-- Latest version (202610171100_activity_log) + publishing isn't logged as an edit
create or replace function public.log_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ann record;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if coalesce(current_setting('app.publishing_announcement', true), '') = 'on' then return null; end if;
  if tg_op = 'UPDATE' and cardinality(public.changed_columns(to_jsonb(old), to_jsonb(new))) = 0 then
    return null;
  end if;

  if tg_op = 'DELETE' then ann := old; else ann := new; end if;
  perform public.log_activity(
    case tg_op when 'INSERT' then 'announcement.posted'
               when 'UPDATE' then 'announcement.edited'
               else 'announcement.deleted' end,
    'announcement', ann.id,
    jsonb_build_object('title', ann.title,
                       'tournament_id', ann.tournament_id,
                       'tournament_name', (select name from public.tournaments where id = ann.tournament_id)));
  return null;
end $$;

revoke execute on function public.publish_scheduled_announcements() from public, anon, authenticated;

-- Existing announcements were already sent (the flag: not an edit, not logged)
select set_config('app.publishing_announcement', 'on', true);
update public.announcements set notified_at = coalesce(notified_at, created_at) where notified_at is null;
select set_config('app.publishing_announcement', 'off', true);

select cron.schedule(
  'dalta-publish-announcements',
  '*/5 * * * *',
  'select public.publish_scheduled_announcements()'
);

-- ---------------------------------------------------------------------------
-- 4. Comment reports
-- ---------------------------------------------------------------------------
create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.stream_comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('bullying', 'harassment', 'hate_speech', 'threat', 'sexual', 'spam', 'other')),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  unique (comment_id, reporter_id)
);

create index if not exists comment_reports_open_idx on public.comment_reports (comment_id) where resolved_at is null;

alter table public.comment_reports enable row level security;

drop policy if exists "Users report comments" on public.comment_reports;
create policy "Users report comments"
  on public.comment_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.can_post());

drop policy if exists "Reporters and moderators read reports" on public.comment_reports;
create policy "Reporters and moderators read reports"
  on public.comment_reports for select to authenticated
  using (reporter_id = auth.uid() or public.get_my_role() in ('admin', 'staff'));
-- No update/delete policies: reports are resolved only through dismiss_comment_reports()

create or replace function public.check_comment_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.stream_comments;
begin
  select * into c from public.stream_comments where id = new.comment_id;
  if not found or c.moderation_status not in ('pending', 'approved', 'restored') then
    raise exception 'This comment can''t be reported (it was already hidden or removed).';
  end if;
  if c.user_id = auth.uid() then
    raise exception 'You can''t report your own comment.';
  end if;
  if (select count(*) from public.comment_reports
      where reporter_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You have sent many reports in the last hour. Please try again later.';
  end if;
  -- Users never resolve reports
  new.resolved_at := null;
  new.resolved_by := null;
  new.note := nullif(trim(coalesce(new.note, '')), '');
  return new;
end $$;

drop trigger if exists comment_reports_check on public.comment_reports;
create trigger comment_reports_check
  before insert on public.comment_reports
  for each row execute function public.check_comment_report();

-- The first open report of a comment tells the moderators
create or replace function public.notify_comment_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  moderators uuid[];
begin
  if (select count(*) from public.comment_reports where comment_id = new.comment_id and resolved_at is null) > 1 then
    return null;
  end if;
  select array_agg(id) into moderators from public.profiles where role in ('admin', 'staff');
  perform public.notify_users(coalesce(moderators, '{}'), 'comment_reported', 'A comment was reported',
    'Someone reported a chat comment (' || replace(new.reason, '_', ' ') || '). Review it in Moderation.',
    '/admin/moderation?tab=reported');
  return null;
end $$;

drop trigger if exists comment_reports_notify on public.comment_reports;
create trigger comment_reports_notify
  after insert on public.comment_reports
  for each row execute function public.notify_comment_report();

-- Moderators: "keep the comment" closes its open reports (logged)
create or replace function public.dismiss_comment_reports(p_comment_id uuid, p_note text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed int;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only organizers can review reports.';
  end if;
  update public.comment_reports
  set resolved_at = now(), resolved_by = auth.uid()
  where comment_id = p_comment_id and resolved_at is null;
  get diagnostics closed = row_count;
  if closed > 0 then
    perform public.log_activity('comment.reports_dismissed', 'stream_comment', p_comment_id,
      jsonb_build_object('reports', closed, 'note', left(trim(coalesce(p_note, '')), 300)));
  end if;
  return closed;
end $$;

revoke execute on function public.dismiss_comment_reports(uuid, text) from public, anon;
grant execute on function public.dismiss_comment_reports(uuid, text) to authenticated;

-- A comment removed or hidden by a moderator closes its open reports too
create or replace function public.resolve_reports_on_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.moderation_status in ('hidden', 'removed') and old.moderation_status is distinct from new.moderation_status then
    update public.comment_reports
    set resolved_at = now(), resolved_by = coalesce(auth.uid(), resolved_by)
    where comment_id = new.id and resolved_at is null;
  end if;
  return null;
end $$;

drop trigger if exists stream_comments_resolve_reports on public.stream_comments;
create trigger stream_comments_resolve_reports
  after update of moderation_status on public.stream_comments
  for each row execute function public.resolve_reports_on_moderation();

-- ---------------------------------------------------------------------------
-- 5. Notification types: latest list (202611091800) + comment_reported
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
  'join_request', 'join_request_accepted', 'join_request_declined',
  'student_verified', 'student_rejected', 'student_revoked',
  'verification_submitted', 'role_changed',
  'prediction_result',
  'team_removed', 'team_restored',
  'avatar_removed',
  'warning_issued', 'warning_removed', 'content_restored',
  'account_flagged', 'ban_review', 'ban_dismissed', 'account_unbanned',
  'team_logo_removed',
  'comment_reported'
));

commit;
