-- Activity (audit) log
-- - activity_logs: who did what and when. Only admins read it; nobody can change or delete
--   entries from the app. Entries are written only by the triggers below (log_activity()).
-- - details keeps the names as they were (actor, team, tournament, user), so the log stays
--   readable after something is renamed or deleted. Names only: never emails or student IDs.
-- - Kept for 1 year: run `select public.purge_old_activity_logs();` in the SQL Editor
--   (e.g. once a year). The app can't run it.
-- - Rows removed as a side effect (e.g. a tournament's matches when the tournament is
--   deleted) are not logged: only the action someone actually did. pg_trigger_depth() > 1
--   means "this change was made by another trigger or a foreign key cascade".
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  -- Empty when the user was later deleted, or for changes made in the SQL Editor.
  -- details.actor_name still has their name.
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,          -- e.g. 'registration.approved' (labels in utils/activity.ts)
  entity_type text not null,     -- 'tournament', 'registration', 'match', 'user', 'announcement', 'stream'
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_actor_idx on public.activity_logs (actor_id);
create index activity_logs_action_idx on public.activity_logs (action);

alter table public.activity_logs enable row level security;

create policy "Admins read the activity log"
  on public.activity_logs for select
  to authenticated
  using (public.get_my_role() = 'admin');
-- No insert, update or delete policies: the app can't write to the log.

-- ---------------------------------------------------------------------------
-- 2. log_activity(): adds one entry. Only the trigger functions below use it
--    (they run as the database owner); the app can't call it.
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_name text;
begin
  select coalesce(nullif(trim(full_name), ''), 'Unnamed user') into my_name
  from public.profiles where id = me;

  -- No profile: the SQL Editor (no user), or a user who just deleted their own account
  -- (their name is already in p_details as user_name).
  if not found then
    me := null;
    my_name := case when auth.uid() is null then 'System (SQL Editor)' else p_details ->> 'user_name' end;
  end if;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, details)
  values (me, p_action, p_entity_type, p_entity_id,
          coalesce(p_details, '{}') || jsonb_build_object('actor_name', my_name));
end $$;

revoke execute on function public.log_activity(text, text, uuid, jsonb) from public, anon, authenticated;

-- Names of the columns that changed between two versions of a row (ignoring updated_at)
create or replace function public.changed_columns(p_old jsonb, p_new jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(n.key order by n.key), '{}')
  from jsonb_each(p_new) n
  where n.key <> 'updated_at' and n.value is distinct from p_old -> n.key
$$;

-- A person's name for the log (never the email)
create or replace function public.log_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(full_name), ''), 'Unnamed user') from public.profiles where id = p_user_id
$$;

revoke execute on function public.log_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tournaments: created, edited (which fields), cancelled, deleted
-- ---------------------------------------------------------------------------
create or replace function public.log_tournament()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields text[];
begin
  if pg_trigger_depth() > 1 then return null; end if;

  if tg_op = 'INSERT' then
    perform public.log_activity('tournament.created', 'tournament', new.id,
      jsonb_build_object('tournament_name', new.name, 'game', new.game));
  elsif tg_op = 'UPDATE' then
    -- 'game' is a copy of game_id's name, so it isn't listed separately
    fields := array_remove(public.changed_columns(to_jsonb(old), to_jsonb(new)), 'game');
    if cardinality(fields) = 0 then return null; end if;

    perform public.log_activity(
      case when new.status = 'cancelled' and old.status <> 'cancelled' then 'tournament.cancelled'
           else 'tournament.edited' end,
      'tournament', new.id,
      jsonb_build_object('tournament_name', new.name, 'game', new.game, 'fields', to_jsonb(fields)));
  else
    perform public.log_activity('tournament.deleted', 'tournament', old.id,
      jsonb_build_object('tournament_name', old.name, 'game', old.game));
  end if;
  return null;
end $$;

create trigger tournaments_log
  after insert or update or delete on public.tournaments
  for each row execute function public.log_tournament();

-- ---------------------------------------------------------------------------
-- 4. Registrations: approved, rejected, cancelled, back to pending, removed
-- ---------------------------------------------------------------------------
create or replace function public.log_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reg record;
  info jsonb;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;

  if tg_op = 'DELETE' then reg := old; else reg := new; end if;

  select jsonb_build_object(
           'team_name', coalesce(tm.name, reg.team_name, 'Unnamed team'),
           'tournament_name', t.name,
           'tournament_id', t.id,
           'game', t.game,
           'old_status', case when tg_op = 'UPDATE' then old.status end)
    into info
  from public.tournaments t
  left join public.teams tm on tm.id = reg.team_id
  where t.id = reg.tournament_id;

  perform public.log_activity(
    case when tg_op = 'DELETE' then 'registration.removed' else 'registration.' || new.status end,
    'registration', reg.id, coalesce(info, '{}'));
  return null;
end $$;

create trigger tournament_registrations_log
  after update or delete on public.tournament_registrations
  for each row execute function public.log_registration();

-- ---------------------------------------------------------------------------
-- 5. Matches: a result entered, changed or cleared; and "bracket generated".
--    generate_bracket() inserts the final first, and it is the only match without a
--    next match, so that insert stands for the whole bracket (one entry, not one per match).
--    Winners moving into the next match (the advance trigger) only change the teams, so
--    they aren't logged.
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
      'winner', (select name from public.teams where id = new.winner_team_id)));
  return null;
end $$;

create trigger matches_log
  after insert or update on public.matches
  for each row execute function public.log_match();

-- ---------------------------------------------------------------------------
-- 6. Users: role changed, student verified / rejected / revoked, account deleted.
--    Deleting a user deletes the profile through a cascade from auth.users, so the
--    delete is logged at any trigger depth.
-- ---------------------------------------------------------------------------
create or replace function public.log_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_name text;
begin
  if tg_op = 'DELETE' then
    perform public.log_activity('user.deleted', 'user', old.id, jsonb_build_object(
      'user_name', coalesce(nullif(trim(old.full_name), ''), 'Unnamed user'),
      'role', old.role,
      'self', coalesce(auth.uid() = old.id, false)));
    return null;
  end if;

  if pg_trigger_depth() > 1 then return null; end if;
  user_name := coalesce(nullif(trim(new.full_name), ''), 'Unnamed user');

  if new.role is distinct from old.role then
    perform public.log_activity('user.role_changed', 'user', new.id, jsonb_build_object(
      'user_name', user_name, 'old_role', old.role, 'new_role', new.role));
  end if;

  -- Only an organizer's review (not the player saving their details) is logged
  if new.verification_status is distinct from old.verification_status
     and new.verification_status in ('verified', 'rejected') then
    perform public.log_activity(
      case when new.verification_status = 'verified' then 'student.verified'
           when old.verification_status = 'verified' then 'student.revoked'
           else 'student.rejected' end,
      'user', new.id,
      jsonb_build_object('user_name', user_name, 'note', new.verification_note));
  end if;

  return null;
end $$;

create trigger profiles_log
  after update or delete on public.profiles
  for each row execute function public.log_profile();

-- ---------------------------------------------------------------------------
-- 7. Announcements: posted, edited, deleted
-- ---------------------------------------------------------------------------
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

create trigger announcements_log
  after insert or update or delete on public.announcements
  for each row execute function public.log_announcement();

-- ---------------------------------------------------------------------------
-- 8. Streams: added, edited (including going live / ending), removed
-- ---------------------------------------------------------------------------
create or replace function public.log_stream()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st record;
  fields text[];
begin
  if pg_trigger_depth() > 1 then return null; end if;

  if tg_op = 'UPDATE' then
    fields := public.changed_columns(to_jsonb(old), to_jsonb(new));
    if cardinality(fields) = 0 then return null; end if;
  end if;

  if tg_op = 'DELETE' then st := old; else st := new; end if;
  perform public.log_activity(
    case tg_op when 'INSERT' then 'stream.added'
               when 'UPDATE' then 'stream.edited'
               else 'stream.removed' end,
    'stream', st.id,
    jsonb_build_object('title', st.title,
                       'status', st.status,
                       'fields', to_jsonb(fields),
                       'tournament_id', st.tournament_id,
                       'tournament_name', (select name from public.tournaments where id = st.tournament_id)));
  return null;
end $$;

create trigger streams_log
  after insert or update or delete on public.streams
  for each row execute function public.log_stream();

-- ---------------------------------------------------------------------------
-- 9. People who appear in the log, for the "user" filter on /admin/activity (admin only:
--    runs with the caller's permissions, so the RLS above applies).
-- ---------------------------------------------------------------------------
create or replace function public.activity_log_actors()
returns table (actor_id uuid, actor_name text)
language sql
stable
set search_path = ''
as $$
  select distinct on (l.actor_id) l.actor_id, l.details ->> 'actor_name'
  from public.activity_logs l
  where l.actor_id is not null
  order by l.actor_id, l.created_at desc
$$;

revoke execute on function public.activity_log_actors() from public, anon;
grant execute on function public.activity_log_actors() to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Retention: delete entries older than 1 year (Privacy Notice). SQL Editor only.
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_activity_logs()
returns int  -- number of entries deleted
language plpgsql
set search_path = ''
as $$
declare
  deleted int;
begin
  delete from public.activity_logs where created_at < now() - interval '1 year';
  get diagnostics deleted = row_count;
  return deleted;
end $$;

revoke execute on function public.purge_old_activity_logs() from public, anon, authenticated;

commit;
