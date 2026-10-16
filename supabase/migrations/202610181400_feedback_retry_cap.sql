-- Feedback sentiment retry cap (issue: analysis_attempts was written but never
-- read, so unclassifiable feedback could be retried forever).
--
-- Two changes inside claim_gemini_call:
--   1. Admins are exempt from the per-user 5-per-10-min cap. That cap exists to
--      stop one submitter spamming new feedback; on the admin "Retry pending
--      analysis" path the caller is always the admin, so >5 retry clicks in
--      10 min used to hit it. App-wide 10/min and 500/day still apply.
--   2. Limit messages now say what actually happens: nothing retries
--      automatically, someone has to click Retry on /admin/feedback.
--
-- The attempt cap itself lives in the app: /api/feedback/classify only selects
-- rows with analysis_attempts < MAX_FEEDBACK_ANALYSIS_ATTEMPTS.

begin;

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
    return 'Too many sentiment requests this minute. Try again in a minute.';
  end if;
  if (select count(*) from public.gemini_calls where called_at > now() - interval '1 day') >= per_day then
    return 'The daily sentiment analysis limit was reached. Try again tomorrow.';
  end if;
  -- The per-user cap guards submitters, not the admin who retries a backlog.
  if public.get_my_role() <> 'admin' and auth.uid() is not null and (
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

commit;
