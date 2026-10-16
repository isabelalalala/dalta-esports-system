# Findings — L: Data privacy compliance (RA 10173)

## Verdict

Privacy design is genuinely solid (versioned consent, DB-enforced single write path, honest notice covering most of the schema) but **not submission-ready**: the privacy contact is a self-admitted placeholder, the consent gate is enforced on `/dashboard` only (every other page still works — and still collects data — without consent), match-proof screenshots persist forever with no disclosure or deletion path, and public-site officer/player names+photos are published outside the notice entirely.

## Checked

- `utils/privacy.ts` (all 14 lines)
- `app/privacy/page.tsx` (full notice, 10 sections), `app/privacy/consent/page.tsx`
- `components/PrivacyConsentCheckbox.tsx`, `app/auth/register/page.tsx`, `app/dashboard/page.tsx:98–134`, `app/admin/users/page.tsx`, `app/profile/page.tsx`, `app/live/[id]/page.tsx:25–90`, `proxy.ts`
- `utils/exports.ts` (all export types and columns)
- Migrations: `202610170900_privacy_consent.sql` (full), plus schema/FK/RLS evidence from `202610151200`, `202610161200`, `202610161300`, `202610161500`, `202610161900`, `202610162000`, `202610162100`, `202610162200`, `202610162300`, `202610171000`, `202610171100`, `202610171200`, `202610171300`, `202610171400`, `202610171500`, `202610171600`, `202610171800`, `202610181000`, `202610181100`
- `CLAUDE.md` privacy paragraph (lines 56–60) and schema docs

## Findings

**Required**

1. **Privacy contact is a confirmed placeholder.** `utils/privacy.ts:12–13` — `PRIVACY_CONTACT_EMAIL = 'its.molino@perpetualdalta.edu.ph'` sits under an explicit `// TODO: replace with the organization's real contact before going live.` `PRIVACY_CONTACT_PERSON = 'DALTA Esports Data Privacy Officer'` (`utils/privacy.ts:14`) is a role title, not a named DPO. CLAUDE.md:57 confirms "(the contact is still a placeholder)". Rendered verbatim on the public notice (`app/privacy/page.tsx:32–33`, mailto at :168). Under RA 10173 the notice should name a reachable data protection contact — must be fixed before demo/go-live.

2. **Consent enforcement exists only on `/dashboard`.** The sole version/consent check in the codebase is `app/dashboard/page.tsx:124–127` (`privacy_consent_version !== PRIVACY_NOTICE_VERSION` → `router.replace('/privacy/consent')`); grep confirms no other page or component enforces it. `proxy.ts:57–62` checks only authentication, not consent. A non-consented user (pre-notice account, admin-created account, or a user whose notice version went stale) can still directly open `/teams`, `/feedback`, `/live/[id]`, `/profile`, etc. and trigger personal-data writes: `stream_views` insert (`app/live/[id]/page.tsx:47–52`), `feedback` insert (`202610162200` policies), `predictions` insert, `gemini_calls` rows. Consent gating is advisory, not enforced — processing continues without valid consent. Consider enforcing in `proxy.ts` or a shared layout check.

3. **Match-proof screenshots are retained forever and this is undisclosed — and the notice is internally inconsistent about it.** The `match-proofs` bucket has no update/delete policy at all: "No update or delete policies: proofs can't be replaced or removed from the app" (`202610171500_match_results.sql:99`); CLAUDE.md states deleting a match/tournament does not delete the files. On account deletion only `submitted_by`/`responded_by`/`reviewed_by` are nulled (`202610171500:108,115,121`) — the submission row and the file itself persist. Notice §6 lists what is deleted and kept (`app/privacy/page.tsx:132–141`) but never mentions screenshots; worse, "Kept as event records: … match results, which show team names, not personal data" (:140–141) contradicts §2's own admission that screenshots "can show in-game names" (:48–49). Personal data (IGNs in images) outlives the account with no retention limit and no deletion path — needs a §6 line and ideally a manual purge procedure.

4. **Public website publishes named/photographed people the notice doesn't mention.** `officers` (`name`, `position`, `photo_path`) and `official_team_players` (`name`, `ign`, `role`, `photo_path`) are readable by `anon` when published (`202610171600_public_website.sql:99–133`; anon policies :151–171; public `site-images` bucket :201–206). Notice §4's "anyone" list (`app/privacy/page.tsx:87–89`) covers only tournament details, brackets, team names and pick'em splits — not officers' real names/photos or official rosters on `/about`, `/divisions/[game]/[team]`. These people may not even be app users, so no consent flow covers them at all.

5. **Download disclosure understates export scope.** Notice §4: "Organizers may download lists (registrations, team rosters, schedules and results)" (`app/privacy/page.tsx:106–107`). Actual exports (`utils/exports.ts:12`) also include `users` — full_name, **email, student_id, school, course_year, privacy_consent_at** for every account (`utils/exports.ts:397–419`, admin-only) — and `feedback` with full comment text (`utils/exports.ts:361–395`, admin). The registrations export itself embeds member `student_id`/`school`/`course_year` (`utils/exports.ts:249–254`). The notice should enumerate account-list and feedback exports, since emails and student IDs leaving the system in files is the highest-risk flow it has.

**Nit:**

6. **Sign-up consent is client-asserted.** `handle_new_user()` trusts `raw_user_meta_data ->> 'privacy_consent' = 'true'` and any `privacy_notice_version` string (`202610170900:31,39–41`). `signUp` is a public endpoint — anyone can create an account flagged "consented" without ever rendering the checkbox (register only enforces in the UI: `app/auth/register/page.tsx:42–45`). Unavoidable with Supabase metadata, but worth knowing the recorded consent is self-declared.

7. **`give_privacy_consent` accepts any version string.** Only non-empty is required (`202610170900:102–104`); nothing ties `p_version` to the real `PRIVACY_NOTICE_VERSION`. Self-limiting (a wrong value re-triggers the dashboard redirect) but means the stored version is whatever the caller claimed.

8. **`match_checkins` readable by every logged-in user** — `using (true)` select policy (`202610171400:41–44`) exposes `checked_in_by` + `checked_in_at`; §4 doesn't list check-ins under "who can see it".

9. **Team-invite history persists undisclosed.** "No delete policy: answered invites stay as history" (`202610171300:68`); `invited_by` only nulled on deletion (:23). Not mentioned in §2 or §6.

10. **"This note is deleted after one day" is slightly overstated.** `gemini_calls` rows do purge after 1 day (`202610181000:196`), matching `app/privacy/page.tsx:52–53`, but `feedback.analysis_attempts/analysis_error/analysis_attempted_at` (`202610181000:36–38`) persist on the feedback row indefinitely.

11. **Notifications store other users' names in messages** (e.g. "X accepted your invite") and read ones >90 days are purged manually (`202610171200:5–6`, cascade on deletion :17) — mentioned as a purpose (`app/privacy/page.tsx:73–74`) but not as stored data in §2. Minor.

**FYI:**

12. **Consent columns are genuinely locked down.** `protect_profile_role` blocks direct `privacy_consent_*` updates for **any** logged-in user including admins unless the `app.giving_privacy_consent` transaction flag is set (`202610170900:78–84`); `give_privacy_consent` is granted to `authenticated` only, updates only `auth.uid()`'s own row (:92–117). Only exception: `auth.uid() is null` (SQL Editor / postgres) bypasses — documented design, applies to all protected fields.
13. **Admin "Add account" correctly does not fabricate consent** — sign-up metadata contains only `full_name, role` (`app/admin/users/page.tsx:317–324`), so those users get null consent and hit the dashboard gate.
14. **Deletion cascades verified end-to-end:** `auth.users` → `profiles` cascade (`202610161300:89`) → `player_game_profiles`, `team_members`, `teams` captained, `tournament_registrations.user_id`, `predictions`, `stream_views`, `notifications`, received `team_invites` all cascade; `feedback.user_id`, `activity_logs.actor_id` (name survives in `details` — disclosed, `202610171100:23,62–74`), `match_result_submissions`, `match_checkins`, `analytics_reports.generated_by`, `announcements/streams/tournaments.created_by` set null. Notice §6 covers feedback and the 1-year activity log accurately.
15. **Version-bump mechanism is sound:** single constant `PRIVACY_NOTICE_VERSION = '2026-10-18'` (`utils/privacy.ts:9`) is what's stored at register (`app/auth/register/page.tsx:63`), what's sent on re-consent (`app/privacy/consent/page.tsx:27`), what's displayed on the notice (`app/privacy/page.tsx:16`) and what the dashboard compares against — one edit forces re-consent for everyone who next opens the dashboard.
16. Notice accuracy confirmed for: player game profiles (IGN/role/rank, `202610161300:11–20`), student fields + `is_verified` generated column (`202610171000:19–33`), feedback admin-only visibility (policy flip `202610162300:17–29`), stream_views per-user-per-day + staff/admin-only read (`202610162100:82–103`, Manila date `202610162300:35–43`), live presence not persisted (`app/live/[id]/page.tsx:79–81`), predictions own-row policies + anonymous split + "first name + initial" leaderboard (`202610181100:37–56,175–189,224–238`), activity-log admin-only + 1-year purge (`202610171100:37–41,380–393`).

## Unverifiable locally

- Whether the migrations (and trigger/policy versions cited) are actually deployed — all SQL is run manually in the Supabase SQL Editor; a stale `handle_new_user`/`protect_profile_role` would silently change behavior.
- Whether the redirect gate and `give_privacy_consent` RPC work end-to-end in the running app (needs a live session and a non-consented test account).
- Whether `purge_old_activity_logs()` / `purge_old_notifications()` are ever actually run (manual SQL Editor tasks; the 1-year claim in the notice depends on it).
- Whether `its.molino@perpetualdalta.edu.ph` is monitored, and whether the officers/official players featured on the public site gave real-world consent for their names/photos — the app has no mechanism to record that.
- Whether match-proofs files are manually purged in Supabase Storage when accounts/tournaments are deleted (the code provides no path).
