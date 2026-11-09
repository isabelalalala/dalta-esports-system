-- Players and spectators may delete their own feedback (Phase 9, Nielsen #3 "user control").
--
-- Until now only admins could delete feedback. A user may now delete (and so rewrite and resend)
-- their own feedback, except while it is hidden for review or after a moderator removed it:
-- otherwise deleting would erase the evidence a moderator is looking at. Warnings already given
-- stay (user_warnings keeps source_id without a foreign key). After deleting, the one-feedback-
-- per-target rule (feedback_one_per_target) lets them send a new one for the same target.
-- No new table, so no other policies change. Run in the Supabase SQL Editor.

begin;

drop policy if exists "Users delete their own feedback" on public.feedback;
create policy "Users delete their own feedback"
  on public.feedback for delete
  to authenticated
  using (user_id = auth.uid() and moderation_status in ('pending', 'approved', 'restored'));

commit;
