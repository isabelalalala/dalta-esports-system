-- Feedback protection (Module 5, final quality pass)
-- - One feedback per user per tournament, per match, and one general feedback.
-- - Feedback can be about one match (match_id).
-- - The server classifies new feedback with Gemini right away. When Gemini fails or the limit is
--   reached, the feedback stays "pending analysis" (sentiment is null) with the reason, and an
--   admin retries it later on /admin/feedback.
-- - Gemini calls are rate-limited in the database (gemini_calls), so the limit holds for every
--   server instance.
-- - Only the server may save sentiment results or use the rate limiter: it proves this with a key
--   that is stored in Supabase Vault and in the server-only env var FEEDBACK_SERVER_KEY.
--   (No service role key is used.)
--
-- SETUP AFTER RUNNING THIS FILE (once):
--   1. Make a long random text (e.g. a password generator, 40+ characters).
--   2. In the SQL Editor: select vault.create_secret('<that text>', 'feedback_server_key');
--   3. Put the same text in FEEDBACK_SERVER_KEY in .env.local and in Railway.
--   To change it later: select vault.update_secret(
--     (select id from vault.secrets where name = 'feedback_server_key'), '<new text>');
--   Without the key, feedback is still saved; it just stays "pending analysis".
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------
alter table public.feedback
  -- Optional: feedback about one match (its tournament is filled in automatically)
  add column match_id uuid references public.matches (id) on delete set null,
  -- Set when the tournament or match this feedback was about is deleted. Such rows no longer
  -- count for the "one feedback per ..." rule (otherwise deleting a tournament or regenerating
  -- a bracket would fail on the unique index below).
  add column target_removed boolean not null default false,
  -- "Pending analysis": how often classification was tried and why it didn't work
  add column analysis_attempts int not null default 0,
  add column analysis_error text,
  add column analysis_attempted_at timestamptz;

create index feedback_match_idx on public.feedback (match_id);

-- ---------------------------------------------------------------------------
-- 2. One feedback per user per tournament / match / general
--    Existing duplicates: the newest one stays linked to the user; older ones are unlinked
--    from the account (user_id = null), so they still count in reports, anonymously.
-- ---------------------------------------------------------------------------
with ranked as (
  select id, row_number() over (
    partition by user_id, tournament_id, match_id order by created_at desc, id
  ) as n
  from public.feedback
  where user_id is not null
)
update public.feedback f
set user_id = null
from ranked
where ranked.id = f.id and ranked.n > 1;

-- nulls not distinct: (user, null, null) = the one general feedback,
-- (user, tournament, null) = the tournament's, (user, tournament, match) = the match's.
create unique index feedback_one_per_target
  on public.feedback (user_id, tournament_id, match_id) nulls not distinct
  where user_id is not null and not target_removed;

-- ---------------------------------------------------------------------------
-- 3. Insert rules
-- ---------------------------------------------------------------------------
drop policy if exists "Users submit their own feedback" on public.feedback;

create policy "Users submit their own feedback"
  on public.feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and sentiment is null and sentiment_score is null
    and topics = '{}' and classified_at is null
    and not target_removed
    and analysis_attempts = 0 and analysis_error is null and analysis_attempted_at is null
  );

-- Feedback about a match belongs to that match's tournament.
create or replace function public.check_feedback_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  match_tournament uuid;
begin
  if new.match_id is not null then
    select m.tournament_id into match_tournament from public.matches m where m.id = new.match_id;
    if match_tournament is null then
      raise exception 'That match doesn''t exist anymore.';
    end if;
    new.tournament_id := match_tournament;
  end if;
  return new;
end $$;

create trigger feedback_check_target
  before insert on public.feedback
  for each row execute function public.check_feedback_target();

-- ---------------------------------------------------------------------------
-- 4. Nobody edits what a user wrote (latest version of protect_feedback, from 202610162200,
--    plus match_id and target_removed).
-- ---------------------------------------------------------------------------
create or replace function public.protect_feedback()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The links may only be cleared (that's what happens when the account, tournament or
  -- match is deleted), never pointed somewhere else.
  if new.rating is distinct from old.rating
     or new.comment is distinct from old.comment
     or new.created_at is distinct from old.created_at
     or (new.user_id is distinct from old.user_id and new.user_id is not null)
     or (new.tournament_id is distinct from old.tournament_id and new.tournament_id is not null)
     or (new.match_id is distinct from old.match_id and new.match_id is not null) then
    raise exception 'Feedback can''t be edited; only its sentiment can be saved.';
  end if;

  -- Its tournament or match was deleted: it no longer counts as "the user's feedback about X"
  if (old.tournament_id is not null and new.tournament_id is null)
     or (old.match_id is not null and new.match_id is null) then
    new.target_removed := true;
  end if;
  new.target_removed := new.target_removed or old.target_removed;  -- never switched back
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Gemini rate limit
-- ---------------------------------------------------------------------------
create table public.gemini_calls (
  id bigint generated always as identity primary key,
  -- Who caused the call (the person sending feedback, or the admin retrying). Rows are deleted
  -- after 1 day, so this is only used for the per-user limit.
  user_id uuid references public.profiles (id) on delete set null,
  items int not null default 1,
  called_at timestamptz not null default now()
);

create index gemini_calls_called_at_idx on public.gemini_calls (called_at);

alter table public.gemini_calls enable row level security;

-- Admins can see how much of the limit is used. Nobody writes directly:
-- rows are added only by claim_gemini_call().
create policy "Admins read Gemini usage"
  on public.gemini_calls for select
  to authenticated
  using (public.get_my_role() = 'admin');

-- True when p_key matches the server key in Vault. Internal: not callable from the app.
create or replace function public.feedback_server_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(p_key) >= 20, false) and exists (
    select 1 from vault.decrypted_secrets
    where name = 'feedback_server_key' and decrypted_secret = p_key
  );
$$;

revoke execute on function public.feedback_server_key_ok(text) from public, anon, authenticated;

-- Asks for permission to send one request to Gemini.
-- Returns null when allowed (and counts the call), or a readable reason when a limit is reached.
-- Limits (free tier friendly): 10 requests per minute and 500 per 24 hours for the whole app,
-- 5 requests per 10 minutes per user.
create or replace function public.claim_gemini_call(p_key text, p_items int default 1)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  per_minute constant int := 10;
  per_day constant int := 500;
  per_user constant int := 5;
begin
  if not public.feedback_server_key_ok(p_key) then
    raise exception 'The feedback server key is missing or wrong. See the setup steps in 202610181000_feedback_protection.sql.';
  end if;

  -- One claim at a time, so two requests can't both take the last free slot
  perform pg_advisory_xact_lock(hashtext('gemini_calls'));

  -- Keep the table small
  delete from public.gemini_calls where called_at < now() - interval '1 day';

  if (select count(*) from public.gemini_calls where called_at > now() - interval '1 minute') >= per_minute then
    return 'Too many sentiment requests this minute. It will be retried later.';
  end if;
  if (select count(*) from public.gemini_calls where called_at > now() - interval '1 day') >= per_day then
    return 'The daily sentiment analysis limit was reached. It will be retried later.';
  end if;
  if auth.uid() is not null and (
    select count(*) from public.gemini_calls
    where user_id = auth.uid() and called_at > now() - interval '10 minutes'
  ) >= per_user then
    return 'Too many sentiment requests from this account. Try again in a few minutes.';
  end if;

  insert into public.gemini_calls (user_id, items) values (auth.uid(), greatest(coalesce(p_items, 1), 1));
  return null;
end $$;

revoke execute on function public.claim_gemini_call(text, int) from public, anon;
grant execute on function public.claim_gemini_call(text, int) to authenticated;

-- Saves one classification result (only while the feedback is still unclassified).
-- Returns true when it was saved.
create or replace function public.save_feedback_sentiment(
  p_key text,
  p_feedback_id uuid,
  p_sentiment text,
  p_score numeric,
  p_topics text[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_topics text[];
begin
  if not public.feedback_server_key_ok(p_key) then
    raise exception 'The feedback server key is missing or wrong.';
  end if;
  if p_sentiment not in ('positive', 'neutral', 'negative') then
    raise exception 'Unknown sentiment.';
  end if;

  -- At most 3 short lowercase labels
  select coalesce(array_agg(t), '{}') into clean_topics
  from (
    select left(lower(trim(t)), 40) as t
    from unnest(coalesce(p_topics, '{}')) as t
    where trim(t) <> ''
    limit 3
  ) x;

  update public.feedback
  set sentiment = p_sentiment,
      sentiment_score = round(greatest(-1, least(1, coalesce(p_score, 0))), 2),
      topics = clean_topics,
      classified_at = now(),
      analysis_attempts = analysis_attempts + 1,
      analysis_error = null,
      analysis_attempted_at = now()
  where id = p_feedback_id and sentiment is null;

  return found;
end $$;

revoke execute on function public.save_feedback_sentiment(text, uuid, text, numeric, text[]) from public, anon;
grant execute on function public.save_feedback_sentiment(text, uuid, text, numeric, text[]) to authenticated;

-- Marks feedback as still "pending analysis", with the reason (Gemini down, limit reached, ...).
create or replace function public.mark_feedback_pending(p_key text, p_feedback_ids uuid[], p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.feedback_server_key_ok(p_key) then
    raise exception 'The feedback server key is missing or wrong.';
  end if;

  update public.feedback
  set analysis_attempts = analysis_attempts + 1,
      analysis_error = left(coalesce(p_reason, 'Unknown error'), 200),
      analysis_attempted_at = now()
  where id = any(p_feedback_ids) and sentiment is null;
end $$;

revoke execute on function public.mark_feedback_pending(text, uuid[], text) from public, anon;
grant execute on function public.mark_feedback_pending(text, uuid[], text) to authenticated;

commit;
