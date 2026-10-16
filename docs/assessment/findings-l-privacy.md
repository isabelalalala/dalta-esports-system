# Findings — L: Data privacy compliance (RA 10173)

## Verdict

Privacy design is genuinely solid (versioned consent, DB-enforced single write path, honest notice covering most of the schema). All five Required items below are now resolved: the contact is env-configurable (`NEXT_PUBLIC_PRIVACY_CONTACT_*`, real values still to be set before launch), the consent gate runs in `proxy.ts` on every protected page, and the notice discloses match-proof retention, public officers/players, export scope and check-ins (`PRIVACY_NOTICE_VERSION` bumped to `2026-10-18.2` to force re-consent).

## Checked

- `utils/privacy.ts` (all 14 lines)
- `app/privacy/page.tsx` (full notice, 10 sections), `app/privacy/consent/page.tsx`
- `components/PrivacyConsentCheckbox.tsx`, `app/auth/register/page.tsx`, `app/dashboard/page.tsx:98–134`, `app/admin/users/page.tsx`, `app/profile/page.tsx`, `app/live/[id]/page.tsx:25–90`, `proxy.ts`
- `utils/exports.ts` (all export types and columns)
- Migrations: `202610170900_privacy_consent.sql` (full), plus schema/FK/RLS evidence from `202610151200`, `202610161200`, `202610161300`, `202610161500`, `202610161900`, `202610162000`, `202610162100`, `202610162200`, `202610162300`, `202610171000`, `202610171100`, `202610171200`, `202610171300`, `202610171400`, `202610171500`, `202610171600`, `202610171800`, `202610181000`, `202610181100`
- `CLAUDE.md` privacy paragraph (lines 56–60) and schema docs

## Findings

**Required**

1. ~~**Privacy contact is a confirmed placeholder.**~~ **PARTIALLY RESOLVED** — `utils/privacy.ts` now reads `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`/`NEXT_PUBLIC_PRIVACY_CONTACT_PERSON` (documented in `.env.example`/`.env.local`/CLAUDE.md). The fallbacks remain placeholders, so the remaining task is operational: set the real values in `.env.local` and Railway before launch.

2. ~~**Consent enforcement exists only on `/dashboard`.**~~ **RESOLVED** — `proxy.ts` now checks `profiles.privacy_consent_version` against `PRIVACY_NOTICE_VERSION` on every protected page (one PK lookup; `/privacy/consent` exempt to avoid a loop) and redirects to `/privacy/consent`. The dashboard check remains as a client-side fallback.

3. ~~**Match-proof screenshots are retained forever and this is undisclosed.**~~ **RESOLVED (disclosure)** — §6 now states screenshots stay as event records indefinitely (may show in-game names) and that organizers remove files manually from storage. The internal contradiction is gone. Still absent by design: an in-app deletion path (the bucket intentionally has no update/delete policy).

4. ~~**Public website publishes named/photographed people the notice doesn't mention.**~~ **RESOLVED (disclosure)** — §4's "anyone" list now covers officers'/official players' names, positions, in-game roles and photos. Remaining real-world caveat: officers/players may not be app users, so their consent is an offline matter the app cannot record.

5. ~~**Download disclosure understates export scope.**~~ **RESOLVED** — §4 now enumerates the registrations export (member student ID/school/course-year), the admin account-list export (names, emails, student details, consent date) and the feedback export (comment text).

**Nit:**

6. **Sign-up consent is client-asserted.** `handle_new_user()` trusts `raw_user_meta_data ->> 'privacy_consent' = 'true'` and any `privacy_notice_version` string (`202610170900:31,39–41`). `signUp` is a public endpoint — anyone can create an account flagged "consented" without ever rendering the checkbox (register only enforces in the UI: `app/auth/register/page.tsx:42–45`). Unavoidable with Supabase metadata, but worth knowing the recorded consent is self-declared.

7. **`give_privacy_consent` accepts any version string.** Only non-empty is required (`202610170900:102–104`); nothing ties `p_version` to the real `PRIVACY_NOTICE_VERSION`. Self-limiting (a wrong value re-triggers the dashboard redirect) but means the stored version is whatever the caller claimed.

8. ~~**`match_checkins` readable by every logged-in user**~~ **RESOLVED (disclosure)** — §4 now lists check-ins ("who checked in for a match and when") under logged-in visibility. The `using (true)` policy itself is unchanged.

9. ~~**Team-invite history persists undisclosed.**~~ **RESOLVED** — §6 now notes answered team invitations are kept as history.

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
