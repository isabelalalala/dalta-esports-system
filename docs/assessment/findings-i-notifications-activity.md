# Findings — I: Notifications and activity log

## Verdict

Solid and consistent: every emitted notification type is inside the latest `notifications_type_check` (no crash bug), recipients and self-exclusion are correct throughout, and the log/bell/page implementations are clean — ~~but there are real coverage gaps~~ — **all four Required gaps RESOLVED in `202610181500_notification_audit_gaps`** (applied + smoke-tested live: `result.submitted`, `result.confirmed`, `match.edited`, `tournament.cancelled` all verified in `activity_logs`): cancelled tournaments and removed registrations now notify; match edits and every submission status change are audited. Three nits fixed in the same migration (completed-match notification spam, reschedule-checkin message, confirm→submitter notification).

## Checked

**`notify_users()` call sites (all verified against recipients, message, link):**

| Event | Location | Recipients | OK? |
|---|---|---|---|
| registration approved/rejected | `202610171200_notifications.sql:126` via `tournament_registrations_notify` (AFTER UPDATE only, :135) | team captain, fallback `new.user_id` | ✓ |
| match scheduled / rescheduled / live | `202610171200:190,196` via `matches_notify` (AFTER UPDATE only, :208) | members of both teams; live links to `/live/<stream>` when one exists | ✓ (INSERT gap already found) |
| announcement posted | `202610171200:238` via `announcements_notify` (AFTER INSERT) | general → all profiles; tournament → members of pending/approved registered teams (:231-235) | ✓ |
| student verified/rejected/revoked | `202610171200:292-300` via `profiles_notify` (AFTER UPDATE) | the player, `/profile` | ✓ |
| team_captain transferred | `202610171300:282` inside `transfer_team_captaincy` | new captain | ✓ |
| team_invite / invite_accepted / invite_declined | `202610171300:466,472` via `team_invites_notify` (INSERT + UPDATE pending→accepted/declined) | invited player; then the captain | ✓ |
| member_left / member_removed | `202610171300:503,506` via `team_members_notify_left` (AFTER DELETE) | captain; the removed player. Skips `role='captain'` rows and cascades (`pg_trigger_depth()>1`, :495) | ✓ |
| checkin_open | `202610171400:313` inside `send_checkin_open_notifications` (pg_cron, `auth.uid()` null → nobody filtered out) | both captains | ✓ |
| match_forfeit | `202610171400:211` inside `declare_forfeit` | members of both teams | ✓ |
| result_submitted | `202610171500:269` inside `submit_match_result` | the OTHER captain | ✓ |
| result_confirmed / result_disputed | `202610171500:326,329` inside `respond_to_match_result` | `staff_ids()`; disputed also adds `submitted_by` | ✓ |
| result_rejected | `202610171500:385` inside `review_match_result` ('reject') | both team captains | ✓ |
| result_approved (also used for override) | `202610171500:423` inside `review_match_result` | members of both teams; override flagged in message | ✓ |
| team_added | `202610171200:267` | — trigger+function dropped in `202610171300:444-445`; type kept in CHECK for old rows | dead code removed cleanly |

**`log_activity()` call sites:** `log_tournament` (:119-133: created/edited-with-fields/cancelled/deleted), `log_registration` (:171: `registration.<status>` + `removed`; UPDATE/DELETE trigger only), `log_match` (:208/:220, redefined `202610171400:223-269` adding `forfeit`), `log_profile` (:254/:265/:272: user.deleted at any depth, role_changed both directions, student.*), `log_announcement` (:305), `log_stream` (:341), `log_export` → `export.<type>` (`202610171700:27`).

**Other items verified:** `notifications` table RLS own-rows select + update-with-check, `grant update (is_read)` column-only (:44-52); link CHECK `like '/%' and not like '//%'` (:29) — all emitted links are `/...` paths; `is_read` model with single + mark-all paths (`utils/notifications.ts:81-89`); `purge_old_notifications` (read >90d, revoked from app roles, :312-325); `notify_users` dedupes via `distinct`, joins `profiles` (deleted users skipped), excludes `auth.uid()`, empty/null array → 0-row no-op; NotificationBell channel `notifications-${userId}` with `user_id=eq.` filter, `removeChannel` cleanup, head-count unread (`NotificationBell.tsx:26-39`, `utils/notifications.ts:55-63`); `/admin/activity` 50/page + action group/actor/date filters, `activity_log_actors` is security-invoker so RLS confines it to admins; `log_export` re-checks role in DB (`202610171700:16-25`), route logs before sending (`route.ts:39-51`); `changed_columns` ignores `updated_at` (:88); `checkin_notified_at` update inside cron fires `matches_notify`/`log_match` but both early-return harmlessly.

## Findings

**Critical:** none. Every `notify_users` type emitted (`registration_*`, `match_scheduled|rescheduled|live`, `checkin_open`, `match_forfeit`, `result_submitted|confirmed|disputed|approved|rejected`, `announcement`, `team_invite`, `invite_*`, `team_captain`, `member_*`, `student_*`, `team_added`) is present in the latest CHECK at `202610171500_match_results.sql:157-167`; no migration after that redefines it. No type-mismatch crash.

**Required:**

- **Tournament cancelled → registrants never notified.** **RESOLVED (202610181500):** `tournament_cancelled` type + `tournaments_notify` AFTER UPDATE trigger → members of pending/approved registered teams; verified live. Original: `log_tournament` records `tournament.cancelled` (`202610171100_activity_log.sql:127`) but there is no notify trigger on `tournaments` and no `tournament_cancelled` type in the CHECK. Every registered/pending team's members learn nothing about a cancellation — the single most user-impactful event in the system.
- **Admin-deleted registration → captain never notified.** **RESOLVED (202610181500):** `registration_removed` type + `notify_registration` extended to AFTER DELETE → captain (or `old.user_id` fallback); the captain's own cancel self-suppresses via `notify_users`' `auth.uid()` filter. Original: `tournament_registrations_notify` was `after update` only (`202610171200:135-137`); `log_registration` logged `registration.removed` on DELETE but no notification was sent.
- **Match reschedule/status edits leave no audit entry.** **RESOLVED (202610181500):** `log_match` now emits `match.edited` with the changed-fields list for non-result changes (verified live via a `scheduled_at` update); `checkin_notified_at`/winner-advance columns stay ignored. Original: `log_match` returned early unless `winner_team_id`/`score_a`/`score_b` changed (`202610171400:249-253`), so rescheduling — which also wipes `match_checkins` — was invisible to the audit log.
- **Result-review decisions are only half audited.** **RESOLVED (202610181500):** `match_result_submissions_log` trigger emits `result.submitted/confirmed/disputed/approved/overridden/rejected` for every status change (verified live), including `declare_forfeit`'s auto-rejects; labels/descriptions added to `utils/activity.ts`. Original: the 'reject' path touched only `match_result_submissions` → nothing logged; submits/confirms/disputes produced no `activity_logs` row either.

**Nit:**

- **Invite cancellations are silent.** `notify_team_invite` fires for INSERT and pending→accepted/declined only (`202610171300:465-475`): a captain cancelling an invite doesn't tell the invited player (no `invite_cancelled` type exists), and the auto-cancel of the player's *other* pending invites in `respond_to_team_invite` (`:208-215`) leaves those captains unaware the player joined elsewhere — they just see the invite gone.
- **`match_rescheduled` message doesn't mention check-ins were cleared.** **RESOLVED (202610181500):** the rescheduled message now appends "Check-ins were reset — check in again." Original: reschedule deletes `match_checkins` (`202610171400:138`) but the notification only stated the new time.
- **`result_confirmed` notifies staff but not the submitting captain.** **RESOLVED (202610181500):** confirm now includes `submitted_by`, mirroring the disputed branch. Original: the submitter wasn't told the opponent agreed (`202610171500:326-327`).
- **Registration approval goes to the captain only** (`202610171200:126-131`); roster members aren't told their team is in. Same for rejection.
- **Team deletion notifies nobody.** `notify_team_member_left` skips cascades (`pg_trigger_depth()>1`, `202610171300:495`), so deleting a whole team never tells its members.
- **Reschedule notification is status-agnostic:** **RESOLVED (202610181500):** `notify_match` returns early when `new.status = 'completed'` — finished matches send nothing. Original: fired on any `scheduled_at` change even for completed matches (`202610171200:165,195`).
- **Audit gaps (lower value):** registration INSERT (a captain registering) isn't logged — `tournament_registrations_log` is UPDATE/DELETE only (`202610171100:177-179`); profile INSERT (signup / admin "Add account") isn't logged — `profiles_log` is UPDATE/DELETE only (:283-285); member removals/invite answers aren't logged; website edits (`site_content`, `hero_images`, `campaigns`, `events`, `officers`, `official_teams` — all admin-only, public-facing) have no log triggers (`202610171600` has none); admin feedback deletes and saved-report generate/delete aren't logged; `give_privacy_consent` isn't logged (the profile's `privacy_consent_at` is the record).
- **No length cap on notification title/message.** `result_disputed`/`result_rejected` truncate reasons to 200 chars, but `announcement` copies `new.title` (which has only a `length>0` check, `202610162000:11`) and `student_rejected` embeds a 300-char note verbatim. Trivial UI risk only.

**FYI:**

- New registrations and `verification_status → pending` submissions notify no organizer — staff must poll `/tournaments/[id]/registrations` and `/admin/verification`. Arguably by design (organizer-initiated review queues) but worth noting.
- Self-notification handling is correct everywhere: `notify_users` filters `auth.uid()` (`202610171200:85`); cron runs with null uid so both captains are notified; edge case — if one person captains both teams, `result_submitted` to `other_captain` is correctly suppressed (they are the other captain).
- `purge_old_notifications`/`purge_old_activity_logs` are *not* `security definer` but are revoked from all app roles, so they run as the SQL Editor superuser which bypasses RLS — safe.
- `notify_users` with `array[null]` (e.g. `other_captain` when a team has no captain row) joins zero profiles — safe no-op.
- Notification for a deleted user: `notifications.user_id` FK is `on delete cascade` (`202610171200:17`); rows die with the profile.

## Unverifiable locally

- Realtime delivery of `postgres_changes` for `notifications` under RLS (publication membership is declared at `202610171200:55-63`, but actual push behavior and the `user_id=eq.` filter can't be exercised here).
- pg_cron `dalta-checkin-open-notifications` firing every 5 min (`202610171400:328-332`) — depends on pg_cron being enabled in the project.
- Whether `purge_old_notifications`/`purge_old_activity_logs` are ever actually run — retention compliance (90d read / 1y) is manual.
- Volume behavior of `markAllAsRead` on very large unread sets and of general `announcement` fan-out to all `profiles` (both are single UPDATE/INSERT statements — fine at plausible scale, untested at thousands of users).
