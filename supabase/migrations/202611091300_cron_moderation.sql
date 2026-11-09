-- Scheduled retry of "pending analysis" (Vercel Cron → GET /api/cron/moderation, once a day)
--
-- The cron request has no logged-in user, so it calls these four functions with the anon role.
-- That is safe: each one checks the secret server key (feedback_server_key_ok) before doing
-- anything, and the key only exists on the server (FEEDBACK_SERVER_KEY). Without it they refuse.
-- With no user, claim_gemini_call skips the per-user cap; the per-minute and per-day caps still
-- apply. No new table, so no new RLS policies. Run in the Supabase SQL Editor.

grant execute on function public.claim_gemini_call(text, int) to anon;
grant execute on function public.claim_moderation_batch(text, int, text, uuid) to anon;
grant execute on function public.save_moderation_result(text, text, uuid, text, numeric, text[], boolean, boolean, text, text) to anon;
grant execute on function public.mark_moderation_pending(text, text, uuid[], text, boolean) to anon;
