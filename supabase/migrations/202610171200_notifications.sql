-- In-app notifications
-- - notifications: one row per person per notification. Users read their own and can only
--   change is_read. Rows are created only by the triggers below (notify_users()).
-- - Realtime: the bell in the header gets new notifications without refreshing.
-- - Old read notifications: run `select public.purge_old_notifications();` in the SQL Editor
--   (deletes read notifications older than 90 days). The app can't.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'registration_approved', 'registration_rejected',
    'match_scheduled', 'match_rescheduled', 'match_live',
    'announcement',
    'team_invite',      -- used by team invites (next step)
    'team_added',       -- a captain added you to their team
    'student_verified', 'student_rejected', 'student_revoked'
  )),
  title text not null,
  message text not null default '',
  -- A page inside the app (never another site)
  link text check (link is null or (link like '/%' and link not like '//%')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not is_read;

alter table public.notifications enable row level security;

create policy "Users read their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users mark their own notifications as read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users may only change is_read (not the title, link, etc.), and can't add or delete rows.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Realtime: the bell receives new rows as they are created (RLS still decides who gets what)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. notify_users(): sends one notification to several people. Only the triggers below
--    use it; the app can't. The person who caused it doesn't notify themselves.
-- ---------------------------------------------------------------------------
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
$$;

revoke execute on function public.notify_users(uuid[], text, text, text, text) from public, anon, authenticated;

-- Everyone on the given teams (empty teams are ignored)
create or replace function public.team_member_ids(p_team_ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct tm.user_id), '{}')
  from public.team_members tm
  where tm.team_id = any (p_team_ids)
$$;

revoke execute on function public.team_member_ids(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Registration approved / rejected -> the team captain
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

create trigger tournament_registrations_notify
  after update on public.tournament_registrations
  for each row execute function public.notify_registration();

-- ---------------------------------------------------------------------------
-- 4. Matches -> every member of both teams
--    - scheduled_at set (scheduled) or changed (rescheduled)
--    - status changed to live (links to the match's stream when there is one)
--    New brackets have no times yet, so generating one sends nothing.
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
      format('%s: %s (PH time).', label,
             to_char(new.scheduled_at at time zone 'Asia/Manila', 'Mon FMDD, YYYY FMHH12:MI AM')),
      '/tournaments/' || new.tournament_id);
  end if;

  return null;
end $$;

create trigger matches_notify
  after update on public.matches
  for each row execute function public.notify_match();

-- ---------------------------------------------------------------------------
-- 5. New announcement
--    General -> everyone. For a tournament -> members of teams registered for it
--    (pending or approved), so people aren't notified about tournaments they're not in.
-- ---------------------------------------------------------------------------
create or replace function public.notify_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipients uuid[];
  tour_name text;
begin
  if new.tournament_id is null then
    select array_agg(id) into recipients from public.profiles;
  else
    select name into tour_name from public.tournaments where id = new.tournament_id;
    select public.team_member_ids(coalesce(array_agg(r.team_id), '{}')) into recipients
    from public.tournament_registrations r
    where r.tournament_id = new.tournament_id
      and r.status in ('pending', 'approved')
      and r.team_id is not null;
  end if;

  perform public.notify_users(coalesce(recipients, '{}'), 'announcement',
    case when tour_name is null then 'New announcement' else 'New announcement: ' || tour_name end,
    new.title, '/announcements');
  return null;
end $$;

create trigger announcements_notify
  after insert on public.announcements
  for each row execute function public.notify_announcement();

-- ---------------------------------------------------------------------------
-- 6. Added to a team -> that player (not the captain, who is added when creating the team)
-- ---------------------------------------------------------------------------
create or replace function public.notify_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_name text;
  game_name text;
begin
  if new.role <> 'player' then return null; end if;

  select t.name, g.name into team_name, game_name
  from public.teams t join public.games g on g.id = t.game_id
  where t.id = new.team_id;

  perform public.notify_users(array[new.user_id], 'team_added', 'Added to a team',
    format('You were added to %s (%s).', team_name, game_name), '/teams/' || new.team_id);
  return null;
end $$;

create trigger team_members_notify
  after insert on public.team_members
  for each row execute function public.notify_team_member();

-- ---------------------------------------------------------------------------
-- 7. Student verification reviewed -> the player
-- ---------------------------------------------------------------------------
create or replace function public.notify_student_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status is not distinct from old.verification_status
     or new.verification_status not in ('verified', 'rejected') then
    return null;
  end if;

  if new.verification_status = 'verified' then
    perform public.notify_users(array[new.id], 'student_verified', 'You are verified',
      'Your student details were verified. You can now join school tournaments.', '/profile');
  elsif old.verification_status = 'verified' then
    perform public.notify_users(array[new.id], 'student_revoked', 'Verification removed',
      'Your student verification was removed: ' || coalesce(new.verification_note, 'no reason given') ||
      ' Update your details on your profile.', '/profile');
  else
    perform public.notify_users(array[new.id], 'student_rejected', 'Student details not accepted',
      coalesce(new.verification_note, 'No reason given.') || ' Fix your details on your profile.', '/profile');
  end if;
  return null;
end $$;

create trigger profiles_notify
  after update on public.profiles
  for each row execute function public.notify_student_review();

-- ---------------------------------------------------------------------------
-- 8. Cleanup: read notifications older than 90 days. SQL Editor only.
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_notifications()
returns int  -- number of notifications deleted
language plpgsql
set search_path = ''
as $$
declare
  deleted int;
begin
  delete from public.notifications where is_read and created_at < now() - interval '90 days';
  get diagnostics deleted = row_count;
  return deleted;
end $$;

revoke execute on function public.purge_old_notifications() from public, anon, authenticated;

commit;
