-- Phase 4: live stream comments, AI moderation (comments + feedback), warnings and bans.
--
-- 1. stream_comments: comments on a stream (live or replay). Posted by logged-in users who aren't
--    flagged or banned (1 per 3 seconds, 300 characters). Shown right away ("pending"), then the
--    server's AI analysis approves them or hides them.
-- 2. stream_comment_activity: one row per stream whose version goes up on every comment change.
--    It is the only thing in Realtime: viewers reload the comments through get_stream_comments(),
--    which returns only visible comments. (If comments themselves were in Realtime, viewers could
--    never learn that a comment was HIDDEN: Realtime drops updates a viewer may no longer read.)
-- 3. feedback gets the same moderation fields.
-- 4. The same analysis for both: claim_moderation_batch() -> Gemini -> save_moderation_result(),
--    or mark_moderation_pending() when it fails. All three need FEEDBACK_SERVER_KEY (Vault).
--    Policy (save_moderation_result):
--      - profanity only: stays visible, flagged, 1 warning
--      - bullying / harassment / hate speech / threat / sexual: hidden, moderation queue, 1 warning
--      - 5 active warnings: the account is flagged ("pending ban") and admins are told
-- 5. user_warnings: every warning (system or admin). Admins can remove one (kept, marked removed).
-- 6. profiles.ban_status none / pending / banned. Pending and banned accounts can't comment or
--    send feedback (RLS). Banned accounts are sent to /banned (proxy.ts) and, once the hook below
--    is switched on, can't log in or refresh their session.
-- 7. Moderator functions (logged in activity_logs): moderate_comment(), moderate_feedback(),
--    remove_warning(), ban_user(), dismiss_ban(), unban_user().
-- 8. report_comment_sentiment(): comment sentiment for the admin dashboard.
-- 9. custom_access_token_hook(): blocks banned accounts at login.
--
-- SETUP AFTER RUNNING THIS FILE (once, optional but recommended):
--   Supabase dashboard -> Authentication -> Hooks -> "Customize Access Token (JWT) Claims" ->
--   enable, type Postgres, function public.custom_access_token_hook. Without it, banned users are
--   still blocked from every protected page and from posting, but a session they already have
--   keeps working on public pages until it expires.
--
-- Run in the Supabase SQL Editor after 202611081400_avatars_and_tour.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Bans on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists ban_status text not null default 'none',
  add column if not exists ban_flagged_at timestamptz,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid references public.profiles (id) on delete set null,
  add column if not exists ban_reason text;

alter table public.profiles drop constraint if exists profiles_ban_status_check;
alter table public.profiles add constraint profiles_ban_status_check
  check (ban_status in ('none', 'pending', 'banned'));

-- Ban fields change only inside the moderation functions (flag app.moderating_user)
create or replace function public.protect_ban_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.moderating_user', true), '') <> 'on'
     and (new.ban_status is distinct from old.ban_status
          or new.ban_flagged_at is distinct from old.ban_flagged_at
          or new.banned_at is distinct from old.banned_at
          or new.banned_by is distinct from old.banned_by
          or new.ban_reason is distinct from old.ban_reason) then
    raise exception 'Bans are managed on the moderation page.';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_ban on public.profiles;
create trigger profiles_protect_ban
  before update on public.profiles
  for each row execute function public.protect_ban_fields();

-- May the current user post comments and feedback? (logged in, not flagged, not banned)
create or replace function public.can_post()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and ban_status = 'none')
$$;
revoke execute on function public.can_post() from public, anon;
grant execute on function public.can_post() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. user_warnings
-- ---------------------------------------------------------------------------
create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('comment', 'feedback')),
  source_id uuid,
  type text not null check (type in ('profanity', 'offensive')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  issued_by uuid references public.profiles (id) on delete set null,   -- null = the system (AI)
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  removal_reason text
);

create index if not exists user_warnings_user_idx on public.user_warnings (user_id, created_at desc);

alter table public.user_warnings enable row level security;

drop policy if exists "Users see their warnings, admins all" on public.user_warnings;
create policy "Users see their warnings, admins all"
  on public.user_warnings for select
  to authenticated
  using (user_id = auth.uid() or public.get_my_role() = 'admin');

revoke insert, update, delete on public.user_warnings from anon, authenticated;

create or replace function public.active_warning_count(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.user_warnings where user_id = p_user_id and removed_at is null
$$;
revoke execute on function public.active_warning_count(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. stream_comments
-- ---------------------------------------------------------------------------
create table if not exists public.stream_comments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  sentiment_label text check (sentiment_label in ('positive', 'neutral', 'negative')),
  sentiment_score numeric check (sentiment_score between -1 and 1),
  topics text[] not null default '{}',
  is_profane boolean not null default false,
  is_offensive boolean not null default false,
  offense_type text not null default 'none'
    check (offense_type in ('none', 'bullying', 'harassment', 'hate_speech', 'threat', 'sexual')),
  -- pending = posted, not analysed yet (shown); approved = analysed, fine (shown);
  -- hidden = AI found it offensive (moderation queue); restored = a moderator showed it again;
  -- removed = a moderator confirmed the removal
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'hidden', 'restored', 'removed')),
  moderation_reason text,
  analysis_attempts int not null default 0,
  analysis_error text,
  analysis_attempted_at timestamptz,
  analysed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists stream_comments_stream_idx on public.stream_comments (stream_id, created_at desc);
create index if not exists stream_comments_user_idx on public.stream_comments (user_id, created_at desc);
create index if not exists stream_comments_pending_idx on public.stream_comments (created_at) where moderation_status = 'pending';

alter table public.stream_comments enable row level security;

-- Direct reads (moderation page, the author's own comments). Everyone else, including logged-out
-- visitors, reads through get_stream_comments().
drop policy if exists "Visible comments, own comments, organizers all" on public.stream_comments;
create policy "Visible comments, own comments, organizers all"
  on public.stream_comments for select
  to authenticated
  using (
    moderation_status in ('pending', 'approved', 'restored')
    or user_id = auth.uid()
    or public.get_my_role() in ('admin', 'staff')
  );

drop policy if exists "Users comment as themselves" on public.stream_comments;
create policy "Users comment as themselves"
  on public.stream_comments for insert
  to authenticated
  with check (user_id = auth.uid() and public.can_post());

-- Authors may delete their own comment once it was analysed and allowed (deleting a pending or
-- hidden comment would dodge moderation)
drop policy if exists "Authors delete their allowed comments" on public.stream_comments;
create policy "Authors delete their allowed comments"
  on public.stream_comments for delete
  to authenticated
  using (user_id = auth.uid() and moderation_status in ('approved', 'restored'));

-- No update policy: only the moderation functions change comments.
revoke update on public.stream_comments from anon, authenticated;

create or replace function public.check_stream_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is not null and coalesce(current_setting('app.moderating', true), '') <> 'on' then
      raise exception 'Comments can''t be edited.';
    end if;
    return new;
  end if;

  new.content := trim(coalesce(new.content, ''));
  if char_length(new.content) = 0 then
    raise exception 'Write something first.';
  end if;
  if char_length(new.content) > 300 then
    raise exception 'Comments can be at most 300 characters.';
  end if;

  -- One comment every 3 seconds per user (the lock stops two at the same moment)
  perform pg_advisory_xact_lock(hashtext('comment:' || coalesce(new.user_id::text, '')));
  if exists (
    select 1 from public.stream_comments
    where user_id = new.user_id and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'Slow down: you can comment once every 3 seconds.';
  end if;

  -- Users never set these themselves
  new.created_at := now();
  new.sentiment_label := null;
  new.sentiment_score := null;
  new.topics := '{}';
  new.is_profane := false;
  new.is_offensive := false;
  new.offense_type := 'none';
  new.moderation_status := 'pending';
  new.moderation_reason := null;
  new.analysis_attempts := 0;
  new.analysis_error := null;
  new.analysis_attempted_at := null;
  new.analysed_at := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end $$;

drop trigger if exists stream_comments_check on public.stream_comments;
create trigger stream_comments_check
  before insert or update on public.stream_comments
  for each row execute function public.check_stream_comment();

-- ---------------------------------------------------------------------------
-- 4. stream_comment_activity: the Realtime signal
-- ---------------------------------------------------------------------------
create table if not exists public.stream_comment_activity (
  stream_id uuid primary key references public.streams (id) on delete cascade,
  version bigint not null default 0,
  changed_at timestamptz not null default now()
);

alter table public.stream_comment_activity enable row level security;

drop policy if exists "Anyone reads comment activity" on public.stream_comment_activity;
create policy "Anyone reads comment activity"
  on public.stream_comment_activity for select
  to anon, authenticated
  using (true);
revoke insert, update, delete on public.stream_comment_activity from anon, authenticated;

create or replace function public.bump_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := coalesce(new.stream_id, old.stream_id);
begin
  -- The stream itself is being deleted (cascade): nothing to signal
  if not exists (select 1 from public.streams where id = sid) then
    return null;
  end if;
  insert into public.stream_comment_activity (stream_id, version, changed_at)
  values (sid, 1, now())
  on conflict (stream_id) do update
    set version = public.stream_comment_activity.version + 1, changed_at = now();
  return null;
end $$;

drop trigger if exists stream_comments_bump on public.stream_comments;
create trigger stream_comments_bump
  after insert or update or delete on public.stream_comments
  for each row execute function public.bump_comment_activity();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stream_comment_activity'
  ) then
    alter publication supabase_realtime add table public.stream_comment_activity;
  end if;
end $$;

-- "Juan dela Cruz" -> "Juan C." (how commenters are named, like the pick'em leaderboard)
create or replace function public.short_name(p_full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(trim(p_full_name), '') = '' then 'Player'
    when position(' ' in trim(p_full_name)) = 0 then trim(p_full_name)
    else split_part(trim(p_full_name), ' ', 1) || ' ' ||
         upper(left(reverse(split_part(reverse(trim(p_full_name)), ' ', 1)), 1)) || '.'
  end
$$;

-- The comments of one stream, newest first (the page shows them oldest first). Visible comments
-- for everyone (also logged out); the author also gets their own hidden ones, marked.
create or replace function public.get_stream_comments(
  p_stream_id uuid,
  p_limit int default 100,
  p_before timestamptz default null
)
returns table (
  id uuid, content text, created_at timestamptz, author_name text, author_avatar text,
  is_mine boolean, is_profane boolean, moderation_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.content, c.created_at, public.short_name(p.full_name), p.avatar_url,
         c.user_id = auth.uid(), c.is_profane, c.moderation_status
  from public.stream_comments c
  left join public.profiles p on p.id = c.user_id
  where c.stream_id = p_stream_id
    and (c.moderation_status in ('pending', 'approved', 'restored')
         or (auth.uid() is not null and c.user_id = auth.uid() and c.moderation_status = 'hidden'))
    and (p_before is null or c.created_at < p_before)
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
$$;
revoke execute on function public.get_stream_comments(uuid, int, timestamptz) from public;
grant execute on function public.get_stream_comments(uuid, int, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Feedback moderation fields
-- ---------------------------------------------------------------------------
alter table public.feedback
  add column if not exists is_profane boolean not null default false,
  add column if not exists is_offensive boolean not null default false,
  add column if not exists offense_type text not null default 'none',
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists moderation_reason text,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.feedback drop constraint if exists feedback_offense_type_check;
alter table public.feedback add constraint feedback_offense_type_check
  check (offense_type in ('none', 'bullying', 'harassment', 'hate_speech', 'threat', 'sexual'));
alter table public.feedback drop constraint if exists feedback_moderation_status_check;
alter table public.feedback add constraint feedback_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'hidden', 'restored', 'removed'));

-- Feedback sent before this migration counts as checked; new feedback starts as pending
update public.feedback set moderation_status = 'pending' where sentiment is null;
alter table public.feedback alter column moderation_status set default 'pending';

-- Latest insert policy (202610181000_feedback_protection) + not flagged/banned + clean moderation fields
drop policy if exists "Users submit their own feedback" on public.feedback;
create policy "Users submit their own feedback"
  on public.feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_post()
    and sentiment is null and sentiment_score is null
    and topics = '{}' and classified_at is null
    and not target_removed
    and analysis_attempts = 0 and analysis_error is null and analysis_attempted_at is null
    and moderation_status = 'pending' and not is_profane and not is_offensive and offense_type = 'none'
    and moderation_reason is null and reviewed_by is null and reviewed_at is null
  );

-- ---------------------------------------------------------------------------
-- 6. The analysis pipeline (server key only)
-- ---------------------------------------------------------------------------

-- The oldest items waiting for analysis (comments and feedback), up to p_limit, with the item
-- named by p_first_kind/p_first_id first (the one just posted). Items that failed 5 times are
-- left alone (shown as "gave up" to admins).
create or replace function public.claim_moderation_batch(
  p_key text,
  p_limit int default 20,
  p_first_kind text default null,
  p_first_id uuid default null
)
returns table (kind text, id uuid, content text, rating int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.feedback_server_key_ok(p_key) then
    raise exception 'The feedback server key is missing or wrong.';
  end if;

  return query
  select x.kind, x.id, x.content, x.rating
  from (
    select 'comment'::text as kind, c.id, c.content, null::int as rating, c.created_at
    from public.stream_comments c
    where c.moderation_status = 'pending' and c.analysis_attempts < 5
    union all
    select 'feedback'::text, f.id, f.comment, f.rating, f.created_at
    from public.feedback f
    where f.sentiment is null and f.analysis_attempts < 5
  ) x
  order by coalesce(x.kind = p_first_kind and x.id = p_first_id, false) desc, x.created_at
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
end $$;
revoke execute on function public.claim_moderation_batch(text, int, text, uuid) from public, anon;
grant execute on function public.claim_moderation_batch(text, int, text, uuid) to authenticated;

-- Activity log entry by the system (the AI), not by whoever's session ran the analysis
create or replace function public.log_system_activity(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, details)
  values (null, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}') || '{"actor_name": "AI moderation"}')
$$;
revoke execute on function public.log_system_activity(text, text, uuid, jsonb) from public, anon, authenticated;

-- Admin ids (for the "account flagged" notice)
create or replace function public.admin_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'admin'
$$;
revoke execute on function public.admin_ids() from public, anon, authenticated;

-- 5 active warnings: flag the account (pending ban) and tell the user and the admins
create or replace function public.check_ban_threshold(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  if public.active_warning_count(p_user_id) < 5 then return; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and ban_status = 'none') then return; end if;

  perform set_config('app.moderating_user', 'on', true);
  update public.profiles set ban_status = 'pending', ban_flagged_at = now() where id = p_user_id;
  perform set_config('app.moderating_user', 'off', true);

  select public.log_name(p_user_id) into who;
  perform public.notify_users(array[p_user_id], 'account_flagged', 'Your account is flagged for a ban',
    'You reached 5 warnings. An admin will review your account; until then you can''t comment or send feedback.',
    '/profile#warnings');
  perform public.notify_users(public.admin_ids(), 'ban_review', 'Account waiting for a ban decision',
    format('%s reached 5 warnings. Confirm the ban or dismiss it.', who), '/admin/moderation?tab=bans');
  perform public.log_system_activity('user.ban_flagged', 'user', p_user_id, jsonb_build_object('user_name', who));
end $$;
revoke execute on function public.check_ban_threshold(uuid) from public, anon, authenticated;

-- Saves one analysis result and applies the moderation policy. Returns true when saved
-- (false when the item was already analysed or no longer exists).
create or replace function public.save_moderation_result(
  p_key text,
  p_kind text,
  p_id uuid,
  p_sentiment text,
  p_score numeric,
  p_topics text[],
  p_is_profane boolean,
  p_is_offensive boolean,
  p_offense_type text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  offensive boolean;
  clean_type text;
  clean_topics text[];
  clean_reason text := left(trim(coalesce(p_reason, '')), 300);
  author uuid;
  warning_type text;
  warnings int;
  saved int;
  what text := case when p_kind = 'comment' then 'comment' else 'feedback' end;
begin
  if not public.feedback_server_key_ok(p_key) then
    raise exception 'The feedback server key is missing or wrong.';
  end if;
  if p_sentiment not in ('positive', 'neutral', 'negative') then
    raise exception 'Unknown sentiment.';
  end if;

  clean_type := case when p_offense_type in ('bullying', 'harassment', 'hate_speech', 'threat', 'sexual')
                     then p_offense_type else 'none' end;
  offensive := clean_type <> 'none' or coalesce(p_is_offensive, false);
  if offensive and clean_type = 'none' then clean_type := 'harassment'; end if;

  select coalesce(array_agg(t), '{}') into clean_topics
  from (
    select left(lower(trim(t)), 40) as t
    from unnest(coalesce(p_topics, '{}')) as t
    where trim(t) <> ''
    limit 3
  ) x;

  if p_kind = 'comment' then
    perform set_config('app.moderating', 'on', true);
    update public.stream_comments
    set sentiment_label = p_sentiment,
        sentiment_score = round(greatest(-1, least(1, coalesce(p_score, 0))), 2),
        topics = clean_topics,
        is_profane = coalesce(p_is_profane, false),
        is_offensive = offensive,
        offense_type = clean_type,
        moderation_status = case when offensive then 'hidden' else 'approved' end,
        moderation_reason = nullif(clean_reason, ''),
        analysis_attempts = analysis_attempts + 1,
        analysis_error = null,
        analysis_attempted_at = now(),
        analysed_at = now()
    where id = p_id and moderation_status = 'pending'
    returning user_id into author;
    -- Read the row count right away: PERFORM below would overwrite FOUND
    get diagnostics saved = row_count;
    perform set_config('app.moderating', 'off', true);
  elsif p_kind = 'feedback' then
    update public.feedback
    set sentiment = p_sentiment,
        sentiment_score = round(greatest(-1, least(1, coalesce(p_score, 0))), 2),
        topics = clean_topics,
        classified_at = now(),
        is_profane = coalesce(p_is_profane, false),
        is_offensive = offensive,
        offense_type = clean_type,
        moderation_status = case when offensive then 'hidden' else 'approved' end,
        moderation_reason = nullif(clean_reason, ''),
        analysis_attempts = analysis_attempts + 1,
        analysis_error = null,
        analysis_attempted_at = now()
    where id = p_id and sentiment is null
    returning user_id into author;
    get diagnostics saved = row_count;
  else
    raise exception 'Unknown item kind.';
  end if;

  -- Already analysed (or gone): nothing to save, and no second warning
  if saved = 0 then return false; end if;

  -- Warnings: offensive beats profanity; clean items get none
  warning_type := case when offensive then 'offensive' when coalesce(p_is_profane, false) then 'profanity' end;
  if warning_type is not null and author is not null then
    insert into public.user_warnings (user_id, source, source_id, type, reason)
    values (author, p_kind, p_id, warning_type,
            coalesce(nullif(clean_reason, ''), case when offensive then 'Offensive content' else 'Profanity' end));
    warnings := public.active_warning_count(author);

    perform public.notify_users(array[author], 'warning_issued',
      case when offensive then format('Your %s was hidden', what) else format('Warning: profanity in your %s', what) end,
      format('%s%s This is warning %s of 5.',
             case when offensive then 'It was hidden and sent to the moderators. ' else '' end,
             coalesce(nullif(clean_reason, ''), case when offensive then 'Offensive content.' else 'Profanity.' end),
             warnings),
      '/profile#warnings');

    perform public.check_ban_threshold(author);
  end if;

  return true;
end $$;
revoke execute on function public.save_moderation_result(text, text, uuid, text, numeric, text[], boolean, boolean, text, text) from public, anon;
grant execute on function public.save_moderation_result(text, text, uuid, text, numeric, text[], boolean, boolean, text, text) to authenticated;

-- Records why items are still pending. p_count_attempt = false for "rate limit reached" (that's
-- not the item's fault, so it doesn't count towards giving up after 5 attempts).
create or replace function public.mark_moderation_pending(
  p_key text,
  p_kind text,
  p_ids uuid[],
  p_reason text,
  p_count_attempt boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  add_attempt int := case when coalesce(p_count_attempt, true) then 1 else 0 end;
begin
  if not public.feedback_server_key_ok(p_key) then
    raise exception 'The feedback server key is missing or wrong.';
  end if;

  if p_kind = 'comment' then
    perform set_config('app.moderating', 'on', true);
    update public.stream_comments
    set analysis_attempts = analysis_attempts + add_attempt,
        analysis_error = left(coalesce(p_reason, 'Unknown error'), 200),
        analysis_attempted_at = now()
    where id = any(p_ids) and moderation_status = 'pending';
    perform set_config('app.moderating', 'off', true);
  elsif p_kind = 'feedback' then
    update public.feedback
    set analysis_attempts = analysis_attempts + add_attempt,
        analysis_error = left(coalesce(p_reason, 'Unknown error'), 200),
        analysis_attempted_at = now()
    where id = any(p_ids) and sentiment is null;
  end if;
end $$;
revoke execute on function public.mark_moderation_pending(text, text, uuid[], text, boolean) from public, anon;
grant execute on function public.mark_moderation_pending(text, text, uuid[], text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Moderator actions (all logged)
-- ---------------------------------------------------------------------------

-- Comments (admin and staff): restore a hidden comment (and drop the warning the AI gave for it),
-- or remove a comment for good. p_warn: also give the author a warning (removing a comment the AI
-- missed).
create or replace function public.moderate_comment(p_comment_id uuid, p_action text, p_note text, p_warn boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  note text := left(trim(coalesce(p_note, '')), 300);
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only moderators can do this.';
  end if;
  if p_action not in ('restore', 'remove') then
    raise exception 'Unknown action.';
  end if;

  select sc.*, s.title as stream_title into c
  from public.stream_comments sc join public.streams s on s.id = sc.stream_id
  where sc.id = p_comment_id for update of sc;
  if not found then raise exception 'Comment not found.'; end if;

  perform set_config('app.moderating', 'on', true);
  update public.stream_comments
  set moderation_status = case when p_action = 'restore' then 'restored' else 'removed' end,
      moderation_reason = coalesce(nullif(note, ''), moderation_reason),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_comment_id;
  perform set_config('app.moderating', 'off', true);

  if p_action = 'restore' then
    -- The AI was wrong: its offensive warning for this comment no longer counts
    update public.user_warnings
    set removed_at = now(), removed_by = auth.uid(), removal_reason = 'Comment restored by a moderator'
    where source = 'comment' and source_id = p_comment_id and type = 'offensive' and removed_at is null;
    perform public.notify_users(array[c.user_id], 'content_restored', 'Your comment is visible again',
      'A moderator reviewed your comment and restored it. The warning for it was removed.', '/profile#warnings');
  elsif coalesce(p_warn, false) and c.user_id is not null then
    insert into public.user_warnings (user_id, source, source_id, type, reason, issued_by)
    values (c.user_id, 'comment', p_comment_id, 'offensive', coalesce(nullif(note, ''), 'Removed by a moderator'), auth.uid());
    perform public.notify_users(array[c.user_id], 'warning_issued', 'Your comment was removed',
      format('%s This is warning %s of 5.', coalesce(nullif(note, ''), 'A moderator removed your comment.'),
             public.active_warning_count(c.user_id)), '/profile#warnings');
    perform public.check_ban_threshold(c.user_id);
  end if;

  perform public.log_activity('comment.' || case when p_action = 'restore' then 'restored' else 'removed' end,
    'comment', p_comment_id, jsonb_build_object(
      'user_name', public.log_name(c.user_id), 'title', c.stream_title,
      'note', nullif(note, ''), 'warned', coalesce(p_warn, false) and p_action = 'remove'));
end $$;
revoke execute on function public.moderate_comment(uuid, text, text, boolean) from public, anon;
grant execute on function public.moderate_comment(uuid, text, text, boolean) to authenticated;

-- Feedback (admin only, like reading feedback): restore or remove a hidden feedback item
create or replace function public.moderate_feedback(p_feedback_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  note text := left(trim(coalesce(p_note, '')), 300);
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can moderate feedback.';
  end if;
  if p_action not in ('restore', 'remove') then
    raise exception 'Unknown action.';
  end if;

  update public.feedback
  set moderation_status = case when p_action = 'restore' then 'restored' else 'removed' end,
      moderation_reason = coalesce(nullif(note, ''), moderation_reason),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_feedback_id
  returning user_id into author;
  if not found then raise exception 'Feedback not found.'; end if;

  if p_action = 'restore' then
    update public.user_warnings
    set removed_at = now(), removed_by = auth.uid(), removal_reason = 'Feedback restored by an admin'
    where source = 'feedback' and source_id = p_feedback_id and type = 'offensive' and removed_at is null;
  end if;

  perform public.log_activity('feedback.' || case when p_action = 'restore' then 'restored' else 'removed' end,
    'feedback', p_feedback_id, jsonb_build_object('user_name', public.log_name(author), 'note', nullif(note, '')));
end $$;
revoke execute on function public.moderate_feedback(uuid, text, text) from public, anon;
grant execute on function public.moderate_feedback(uuid, text, text) to authenticated;

-- Remove a warning the AI got wrong (admin). The row stays, marked removed, for the record.
create or replace function public.remove_warning(p_warning_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w record;
  clean_reason text := left(trim(coalesce(p_reason, '')), 300);
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can remove warnings.';
  end if;
  if char_length(clean_reason) < 3 then
    raise exception 'Please give a reason.';
  end if;

  update public.user_warnings
  set removed_at = now(), removed_by = auth.uid(), removal_reason = clean_reason
  where id = p_warning_id and removed_at is null
  returning * into w;
  if not found then raise exception 'That warning was already removed.'; end if;

  perform public.notify_users(array[w.user_id], 'warning_removed', 'A warning was removed',
    format('An admin removed one of your warnings. Reason: %s', clean_reason), '/profile#warnings');
  perform public.log_activity('warning.removed', 'user', w.user_id,
    jsonb_build_object('user_name', public.log_name(w.user_id), 'note', clean_reason, 'warning_type', w.type));
end $$;
revoke execute on function public.remove_warning(uuid, text) from public, anon;
grant execute on function public.remove_warning(uuid, text) to authenticated;

-- Ban an account (admin): confirms a pending ban, or bans directly. Admins can't be banned.
create or replace function public.ban_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := left(trim(coalesce(p_reason, '')), 300);
  target record;
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can ban accounts.';
  end if;
  if char_length(clean_reason) < 3 then
    raise exception 'Please give a reason (the user will see it).';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You can''t ban yourself.';
  end if;

  select role, ban_status into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User not found.'; end if;
  if target.role = 'admin' then raise exception 'Admins can''t be banned. Change their role first.'; end if;
  if target.ban_status = 'banned' then raise exception 'This account is already banned.'; end if;

  perform set_config('app.moderating_user', 'on', true);
  update public.profiles
  set ban_status = 'banned', banned_at = now(), banned_by = auth.uid(), ban_reason = clean_reason
  where id = p_user_id;
  perform set_config('app.moderating_user', 'off', true);

  perform public.log_activity(case when target.ban_status = 'pending' then 'user.ban_confirmed' else 'user.banned' end,
    'user', p_user_id, jsonb_build_object('user_name', public.log_name(p_user_id), 'note', clean_reason));
end $$;
revoke execute on function public.ban_user(uuid, text) from public, anon;
grant execute on function public.ban_user(uuid, text) to authenticated;

-- Dismiss a pending ban (admin): the account is cleared and its active warnings are reset
create or replace function public.dismiss_ban(p_user_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  note text := left(trim(coalesce(p_note, '')), 300);
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can do this.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and ban_status = 'pending') then
    raise exception 'This account isn''t waiting for a ban decision.';
  end if;

  perform set_config('app.moderating_user', 'on', true);
  update public.profiles set ban_status = 'none', ban_flagged_at = null where id = p_user_id;
  perform set_config('app.moderating_user', 'off', true);

  update public.user_warnings
  set removed_at = now(), removed_by = auth.uid(),
      removal_reason = 'Warnings reset when the ban was dismissed' || coalesce(': ' || nullif(note, ''), '')
  where user_id = p_user_id and removed_at is null;

  perform public.notify_users(array[p_user_id], 'ban_dismissed', 'Your account is in good standing',
    'An admin reviewed your account. Your warnings were reset and you can comment again.', '/profile#warnings');
  perform public.log_activity('user.ban_dismissed', 'user', p_user_id,
    jsonb_build_object('user_name', public.log_name(p_user_id), 'note', nullif(note, '')));
end $$;
revoke execute on function public.dismiss_ban(uuid, text) from public, anon;
grant execute on function public.dismiss_ban(uuid, text) to authenticated;

-- Unban (admin): a fresh start, so active warnings are reset too
create or replace function public.unban_user(p_user_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  note text := left(trim(coalesce(p_note, '')), 300);
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can unban accounts.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and ban_status = 'banned') then
    raise exception 'This account isn''t banned.';
  end if;

  perform set_config('app.moderating_user', 'on', true);
  update public.profiles
  set ban_status = 'none', ban_flagged_at = null, banned_at = null, banned_by = null, ban_reason = null
  where id = p_user_id;
  perform set_config('app.moderating_user', 'off', true);

  update public.user_warnings
  set removed_at = now(), removed_by = auth.uid(),
      removal_reason = 'Warnings reset when the account was unbanned' || coalesce(': ' || nullif(note, ''), '')
  where user_id = p_user_id and removed_at is null;

  perform public.notify_users(array[p_user_id], 'account_unbanned', 'Your account was unbanned',
    'An admin lifted the ban on your account. Welcome back.', '/dashboard');
  perform public.log_activity('user.unbanned', 'user', p_user_id,
    jsonb_build_object('user_name', public.log_name(p_user_id), 'note', nullif(note, '')));
end $$;
revoke execute on function public.unban_user(uuid, text) from public, anon;
grant execute on function public.unban_user(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Comment sentiment for the admin dashboard. Dates inclusive, Manila time; null = all.
-- ---------------------------------------------------------------------------
create or replace function public.report_comment_sentiment(
  p_tournament_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can see comment sentiment.';
  end if;

  with c as (
    select sc.*, s.title as stream_title, s.tournament_id, t.name as tournament_name,
           (sc.created_at at time zone 'Asia/Manila')::date as day
    from public.stream_comments sc
    join public.streams s on s.id = sc.stream_id
    join public.tournaments t on t.id = s.tournament_id
    where (p_tournament_id is null or s.tournament_id = p_tournament_id)
      and (p_from is null or (sc.created_at at time zone 'Asia/Manila')::date >= p_from)
      and (p_to is null or (sc.created_at at time zone 'Asia/Manila')::date <= p_to)
  )
  select jsonb_build_object(
    'total', (select count(*) from c),
    'analysed', (select count(*) from c where sentiment_label is not null),
    'pending', (select count(*) from c where moderation_status = 'pending'),
    'by_sentiment', jsonb_build_object(
      'positive', (select count(*) from c where sentiment_label = 'positive'),
      'neutral', (select count(*) from c where sentiment_label = 'neutral'),
      'negative', (select count(*) from c where sentiment_label = 'negative')),
    'flagged', jsonb_build_object(
      'profane', (select count(*) from c where is_profane),
      'hidden', (select count(*) from c where moderation_status in ('hidden', 'removed')),
      'restored', (select count(*) from c where moderation_status = 'restored'),
      'warnings', (select count(*) from public.user_warnings w
                   where w.source = 'comment' and w.source_id in (select id from c))),
    'per_stream', coalesce((
      select jsonb_agg(row_to_json(x) order by x.total desc) from (
        select stream_title as label, count(*) as total,
               count(*) filter (where sentiment_label = 'positive') as positive,
               count(*) filter (where sentiment_label = 'neutral') as neutral,
               count(*) filter (where sentiment_label = 'negative') as negative
        from c group by stream_id, stream_title order by count(*) desc limit 10) x), '[]'),
    'per_tournament', coalesce((
      select jsonb_agg(row_to_json(x) order by x.total desc) from (
        select tournament_name as label, count(*) as total,
               count(*) filter (where sentiment_label = 'positive') as positive,
               count(*) filter (where sentiment_label = 'neutral') as neutral,
               count(*) filter (where sentiment_label = 'negative') as negative
        from c group by tournament_id, tournament_name order by count(*) desc limit 10) x), '[]'),
    'per_day', coalesce((
      select jsonb_agg(row_to_json(x) order by x.day) from (
        select day, count(*) as total,
               count(*) filter (where sentiment_label = 'positive') as positive,
               count(*) filter (where sentiment_label = 'neutral') as neutral,
               count(*) filter (where sentiment_label = 'negative') as negative
        from c group by day) x), '[]'),
    'top_topics', coalesce((
      select jsonb_agg(row_to_json(x) order by x.count desc) from (
        select topic, count(*) as count
        from c, unnest(c.topics) as topic
        group by topic order by count(*) desc limit 10) x), '[]')
  ) into result;

  return result;
end $$;
revoke execute on function public.report_comment_sentiment(uuid, date, date) from public, anon;
grant execute on function public.report_comment_sentiment(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Login hook: banned accounts get no access token (no login, no session refresh).
--    Enable it in the dashboard (see SETUP at the top).
-- ---------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reason text;
begin
  select ban_reason into reason
  from public.profiles
  where id = (event ->> 'user_id')::uuid and ban_status = 'banned';

  if found then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This account is banned. Reason: ' || coalesce(reason, 'Code of Conduct violation') ||
                 '. Contact the organizers if you think this is a mistake.'));
  end if;
  return event;
end $$;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 10. Notification types: list from 202611081400_avatars_and_tour + moderation types
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
  'account_flagged', 'ban_review', 'ban_dismissed', 'account_unbanned'
));

commit;
