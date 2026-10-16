# Findings — A: Functional coverage vs requirements

## Verdict

Coverage is essentially complete: every actor action, use case, data flow, table, function and page named in `docs/requirements.md` and `docs/new-features-summary.md` has a working implementation in `app/`, `components/`, `utils/` or `supabase/migrations/`. The only real gaps are (1) the three base tables (`profiles`, `tournaments`, `tournament_registrations`) are documented in CLAUDE.md but are never created by any migration — they predate the migrations folder — and (2) the public site's "Tournaments" nav link sends logged-out visitors to a page that bounces them to login (no public tournament index exists; only per-tournament `/t/[id]` pages do).

## Checked

- **Spec documents read in full:** `CLAUDE.md` (roles, full schema, policies, all RPCs), `docs/requirements.md` (business case, actors, DFD stores/processes, 8 modules, wireframe pages, additions list), `docs/new-features-summary.md` (all 13 features: use cases, data flows, tables, functions).
- **Routes:** all 80+ files under `app/` — `admin/{activity,feedback,users,verification,website}`, `analytics/{page,engagement,reports/[id]}`, `announcements`, `api/{exports/[type],feedback,feedback/classify}`, `auth/{callback,forgot-password,login,register,reset-password}`, `calendar/[kind]/[id]`, `dashboard`, `feedback`, `live/{[id]}`, `matches/{[id]}`, `notifications`, `privacy/{consent}`, `profile`, `registrations`, `schedule`, `teams/{[id]}`, `tournaments/{create,[id]{,edit,matches,predictions,registrations,streams}}`, and `app/(site)/{about,campaigns,community,divisions,events,page,search,t/[id]{,/match/[matchId]}}`.
- **Shared code:** all files in `components/` and `utils/` (spot-read: `auth.ts`, `gemini.ts`, `exports.ts`, `checkin.ts`, `notifications.ts`, `privacy.ts`, `site-data.ts`, `streams.ts`, `public-tournament.ts` via grep, `PredictionsProvider.tsx`, `PredictionPicker.tsx`, `NotificationBell.tsx`, `FacebookPlayer.tsx`, `Footer.tsx`, `SiteHeader.tsx`).
- **Migrations:** all 25 files in `supabase/migrations/` (202610151200 → 202610181100); grep-verified every `create table`, every `notify_users()`/`log_activity()` call site, every `create or replace function`, RLS policy declarations, storage buckets, Vault usage, pg_cron schedule and Realtime publication adds; read `202610161500`, `202610162100`, `202610171500`, `202610171600`, `202610171800`, `202610181100` in detail.
- **Cross-checks:** every documented RPC has at least one call site in app code (43 `rpc(...)` matches mapped to functions); `proxy.ts` protected-route list compared against CLAUDE.md's page list.

## Use-case checklist

**Module 1 — Account Management (process 1.0)**

| Documented capability | Status | Evidence |
|---|---|---|
| Register (player/spectator only) | implemented | `app/auth/register/page.tsx` (role state limited to player/spectator, line 21,56), `handle_new_user()` trigger `202610161200_role_security.sql:73` + `202610170900` redefinition |
| Login | implemented | `app/auth/login/page.tsx` |
| View/edit own account (name, password) | implemented | `app/profile/page.tsx` (name line 80, ChangePassword line 399) |
| Delete own account | implemented | `app/profile/page.tsx:168` → `delete_own_account()` (`202610161300`) |
| Admin: add account | implemented | `app/admin/users/page.tsx:100` `AddAccountForm` + `utils/supabase/signup-client.ts` |
| Admin: edit/view/delete other accounts | implemented | `app/admin/users/page.tsx` (role change, `admin_delete_user` at line 204, `202610161900`) |
| Reset password / confirm email / resend | implemented | `app/auth/{forgot-password,reset-password,callback}`, resend buttons `login/page.tsx:57`, `register/page.tsx:84`, `utils/auth.ts` |
| Privacy consent at register + re-consent | implemented | `components/PrivacyConsentCheckbox.tsx`, `app/privacy/consent/page.tsx:27` (`give_privacy_consent`), dashboard redirect `app/dashboard/page.tsx:124`, `utils/privacy.ts` |
| Public Privacy Notice | implemented | `app/privacy/page.tsx` |
| Player: submit student details | implemented | `app/profile/StudentDetails.tsx` (update at line 46) |
| Admin/staff: review student verification | implemented | `app/admin/verification/page.tsx:69` (`review_student_verification`) |
| Verified badge (others see only is_verified) | implemented | `components/VerifiedBadge.tsx`, `get_team_roster`/`search_players` |

**Module 2 — Registration & Tournament Management (process 2.0)**

| Documented capability | Status | Evidence |
|---|---|---|
| Player: register as player / update profile + in-game details | implemented | `app/profile/page.tsx` game-profile CRUD (lines 101-159) → `player_game_profiles` (`202610161300`) |
| Staff: create/edit/delete tournaments, manage schedule | implemented | `app/tournaments/create`, `app/tournaments/[id]/edit`, `app/tournaments/[id]/matches/page.tsx` (scheduled_at/status/scores/winner, lines 217-245) |
| Bracket generation (single elim, byes, winner advance) | implemented | `generate_bracket` `202610161800`, called `app/tournaments/[id]/page.tsx:224`; `Bracket.tsx` |
| Team create + captain auto-member | implemented | `app/teams/page.tsx:65-73`, `202610151200` |
| Captain: search players, invite, cancel invite, remove member, transfer captaincy | implemented | `app/teams/[id]/page.tsx` (`search_players` :117, invite insert :135, cancel :156, remove :196, `transfer_team_captaincy` :182), `202610171300` |
| Player: accept/decline invite, leave team | implemented | `components/TeamInvites.tsx:39` (`respond_to_team_invite`), leave via `teams/[id]/page.tsx:464` |
| Roster lock while registered | implemented (DB) | roster-lock trigger `202610171300`; documented CLAUDE.md:113-116 |
| Captain: register team for tournament | implemented | `app/tournaments/[id]/page.tsx:188` insert + rules trigger `check_tournament_registration` (`202610161500:133`, redefined `202610171000`) |
| Admin/staff: approve/reject registrations; captain cancels pending | implemented | `app/tournaments/[id]/registrations/page.tsx:64-84`; policies `202610161500:85-127`; My Registrations `app/registrations/page.tsx` |
| "Verified students only" tournaments | implemented | `tournaments.requires_verification` + member check `app/tournaments/[id]/page.tsx:271-276`; `202610171000` |
| Match check-in + reminders + needs attention + forfeit | implemented | `CheckinSection.tsx` (`check_in_match` :52, `declare_forfeit` :68), `match_checkins` `202610171400`, pg_cron job `dalta-checkin-open-notifications` (`202610171400:328`), `get_needs_attention` + `app/dashboard/NeedsAttention.tsx:37` |
| Captain result + screenshot, confirm/dispute, staff review | implemented | `ResultSection.tsx` (`submit_match_result` :117 with `match-proofs` upload :111, `respond_to_match_result` :134, `review_match_result` :148), `202610171500` |
| Match page w/ realtime updates | implemented | `app/matches/[id]/page.tsx:99-112` (Realtime on matches/checkins/submissions) |

**Module 3 — Event Information (process 3.0)**

| Documented capability | Status | Evidence |
|---|---|---|
| Admin: post/edit/delete announcements (general or per-tournament, pinned) | implemented | `app/announcements/page.tsx` (insert/update :222-226, tournament target :203, pinned :204); policies `202610162000` |
| Audience: view announcements | implemented | `app/announcements/page.tsx`, `app/dashboard/LatestAnnouncements.tsx`, `app/tournaments/[id]/page.tsx:354` |
| Schedule & results listing | implemented | `app/schedule/page.tsx` (live/upcoming/finished) |
| Notifications: bell + live unread + full list + mark read | implemented | `components/NotificationBell.tsx` (Realtime channel :26), `app/notifications/page.tsx`, `utils/notifications.ts`, `202610171200` — all documented types sent via `notify_users()` (registration, match_scheduled/rescheduled/live, checkin_open, forfeit, result_*, announcement, team_invite/invite_*/member_*/team_captain, student_*) |
| Public tournament/match pages (visitor) | implemented | `app/(site)/t/[id]/page.tsx`, `app/(site)/t/[id]/match/[matchId]/page.tsx` via `get_public_tournament` (`202610171800:15`, team names only) + `LiveRefresher` |
| Add to calendar (match/tournament/team, .ics + webcal) | implemented | `app/calendar/[kind]/[id]/route.ts` (all three kinds :11), `utils/ics.ts`, `components/CalendarLinks.tsx`, `get_public_calendar` (`202610171800:67`) |
| Share + link previews (OG image) | implemented | `components/ShareButton.tsx`, `app/(site)/t/[id]/opengraph-image.tsx`, `.../match/[matchId]/opengraph-image.tsx`, `utils/og-card.tsx`, `metadataBase` `app/layout.tsx:27` |

**Module 4 — Live Streaming (process 4.0, store D3)**

| Documented capability | Status | Evidence |
|---|---|---|
| Staff: configure stream, Facebook URL validated | implemented | `app/tournaments/[id]/streams/page.tsx` + `utils/streams.ts:10` `validateFacebookUrl` + DB CHECK `202610162100:22-23` |
| Audience: watch live stream | implemented | `app/live/page.tsx`, `app/live/[id]/page.tsx`, `components/FacebookPlayer.tsx` (embed iframe) |
| Staff: real-time match management | implemented | `app/tournaments/[id]/matches` (status live/completed, scores), live scoreboard `app/live/[id]/page.tsx:97-135` |
| Viewership recorded (1/person/stream/day, PH date) | implemented | `stream_views` `202610162100:82`, upsert `app/live/[id]/page.tsx:47-52` |
| "Watching now" presence count | implemented | `app/live/[id]/page.tsx:66-90` (`viewers-<id>` channel, players/spectators only), counted `app/analytics/engagement/page.tsx:59-77` |

**Module 5 — Feedback & Sentiment (process 5.0, store D4)**

| Documented capability | Status | Evidence |
|---|---|---|
| Audience/player: submit feedback + rating (tournament, match, or general; one per target) | implemented | `app/feedback/page.tsx`, `app/api/feedback/route.ts` (insert :41, 409 on unique :48), `feedback_one_per_target` index `202610181000` |
| Classify sentiment on submit (Gemini, rate-limited, server-only) | implemented | `utils/gemini.ts` (`server-only`, schema, 15s timeout), `utils/feedback-analysis.ts` (`claim_gemini_call` :40 → `save_feedback_sentiment` :59 → `mark_feedback_pending` :35/76), `gemini_calls` `202610181000:137`, Vault check `feedback_server_key_ok` (`202610181000:157-166`) |
| Pending analysis + admin retry + view errors | implemented | `app/admin/feedback/page.tsx` (retry → `/api/feedback/classify` :25, errors :262-264), `app/api/feedback/classify/route.ts` |
| Topics (≤3), "common concerns" = negative topics | implemented | `utils/gemini.ts:57` topics; `report_sentiment` `202610162300:209`; `SentimentSection.tsx` |

**Module 6 — Administrative Reports (process 6.0, store D5)**

| Documented capability | Status | Evidence |
|---|---|---|
| Admin: generate + save report (activity, sentiment, engagement; filters) | implemented | `app/analytics/page.tsx` (`fetchFullReport` :79, insert into `analytics_reports` :81), `report_activity`/`report_sentiment` (admin) + `report_engagement` (admin/staff) `202610162300`, engagement redefined with predictions `202610181100:250` |
| Display saved report, print/PDF, CSV | implemented | `app/analytics/reports/[id]/page.tsx` (three sections, `window.print`, `downloadCsv` :54-67) |
| Staff: view engagement stats | implemented | `app/analytics/engagement/page.tsx` (role check :41, CSV :79, print :114); staff redirected from `/analytics` (`page.tsx:45-48`) |
| Chart.js charts | implemented | `components/ReportChart.tsx`, chart.js dep `package.json:14` |
| Activity (audit) log, filters, retention | implemented | `activity_logs` `202610171100`, `app/admin/activity/page.tsx` (action/actor/date filters :34-56, `activity_log_actors` :88), `purge_old_activity_logs` `202610171100:380` |
| Excel/CSV exports, logged | implemented | `app/api/exports/[type]/route.ts` (role check :24, `log_export` :39 before send), `utils/exports.ts` (5 types, role map :16-22), `components/ExportButtons.tsx`, `202610171700` |

**Module 7 (added) — Public Website & Content (process 7.0, store D6)**

| Documented capability | Status | Evidence |
|---|---|---|
| Visitor: Home (hero, buttons, carousel, campaigns, events), About, Divisions→teams→team, Events, Campaigns, Community, side nav, search | implemented | `app/(site)/{page,about,divisions,divisions/[game],divisions/[game]/[team],events,campaigns,community,search}`, `app/(site)/layout.tsx` nav, `components/site/*`, `site-data.ts` cached reads |
| Admin: edit site text, carousel, campaigns, events, divisions, officers, official teams & players, upload images, publish/reorder | implemented | `app/admin/website/page.tsx` (7 tabs :13, `ListEditor`/`SiteTextEditor`/`ImageField`), `utils/site-images.ts`, `refreshSite` `app/admin/website/actions.ts`; tables + `site-images` bucket `202610171600` |
| Visitor: search tournaments/events/campaigns | implemented | `app/(site)/search/page.tsx:42-50` |

**Module 8 (added) — Pick'em Predictions (process 8.0, store D9)**

| Documented capability | Status | Evidence |
|---|---|---|
| Audience/player: pick winner (change/remove before lock; not own team's match; organizers can't) | implemented | `components/PredictionPicker.tsx` + `PredictionsProvider.tsx:86-112`; `check_prediction()` `202610181100:61-137` |
| Everyone incl. visitors: community split (aggregates only) | implemented | `get_prediction_split` granted to anon `202610181100:175-189`; split rendered `PredictionPicker.tsx:33,72-80` on `/t/[id]`, `/t/[id]/match/[matchId]`, `/matches/[id]`, bracket `renderBelow` |
| Auto-mark picks on final result | implemented | `mark_predictions` trigger `202610181100:144-169` |
| Leaderboard (first name + initial, logged-in only) | implemented | `get_prediction_leaderboard` `202610181100:196-242`; `app/tournaments/[id]/PickemLeaderboard.tsx`, `.../predictions/page.tsx` (top 3 + full page) |

**All 25 migrations** create/alter every documented table; storage buckets `match-proofs` (private, `202610171500:75`) and `site-images` (public, `202610171600:201`) exist with policies; `games` seeded with all 5 divisions (`202610151200:67-72`); wireframe officers seeded (`202610171600:257-260`); wireframe texts seeded (`:236-255`).

## Findings

- **`profiles`, `tournaments` and `tournament_registrations` are never created by any migration** — the documented schema cannot be rebuilt from `supabase/migrations/` alone. `create table` appears only for `games`, `teams`, `team_join_codes` (dropped in `202610161400:62`), `team_members`, `player_game_profiles`, `matches`, `announcements`, `streams`, `stream_views`, `feedback`, `analytics_reports`, `activity_logs`, `notifications`, `team_invites`, `match_checkins`, `match_result_submissions`, all D6/D7/D8/D9 tables and `gemini_calls`/`predictions`. The earliest migration already queries `public.profiles` (`202610151200_team_registration.sql:51`), and `202610161500_registration_approval.sql:39` comments "The link was created outside the migrations". CLAUDE.md documents these tables' full columns and policies (lines 85-96, 101-128) and says "All migrations are in `supabase/migrations/`" — true, but the base DDL (columns, `handle_new_user`'s original trigger creation is re-created in `202610161200:112`, yet the tables' CREATE TABLE, base constraints and original policies) exists only in the live Supabase project. For a capstone hand-off this is a reproducibility gap: a fresh Supabase project cannot run these migrations end-to-end.

- **Public side nav "Tournaments" dead-ends for logged-out visitors.** `app/(site)/layout.tsx:8` links the wireframe's "Tournaments" nav item (requirements.md:148) to `/tournaments`, but `app/tournaments/page.tsx:26-28` redirects any session-less user to `/auth/login`. Visitor-facing tournament browsing is documented (requirements.md:205, new-features Feature 7) and the public pages themselves exist at `/t/[id]` — but there is **no public tournament index**: a visitor can only reach `/t/[id]` via `/search` or a shared link. Either a public list page or a nav target change (e.g. `/search` or a `/t` index) is needed; the documented feature exists but the documented entry point does not.

- **Nit:** `docs/assessment/analysis-system-assessment-areas.md:13` says "23 migrations in `supabase/migrations/`" — there are now 25 files (202610151200 … 202610181100). CLAUDE.md doesn't state a count, so only the assessment doc drifts. *(Fixed in this branch.)*

- **Nit:** `tournament_registrations.team_name` is a legacy column kept for pre-teams rows; it's still read as a fallback in `utils/exports.ts:234`, `app/tournaments/[id]/registrations/page.tsx:172`, `app/tournaments/[id]/page.tsx:429` and `utils/activity.ts` — consistent with CLAUDE.md:124 ("only on old rows"), but the column will silently show "Unnamed Team" forever for old data. Cosmetic only.

- **FYI:** Privacy contact is still a documented placeholder — `utils/privacy.ts:12-14` (`TODO: replace with the organization's real contact`; email `its.molino@perpetualdalta.edu.ph` with a generic "DALTA Esports Data Privacy Officer" name). Both code and CLAUDE.md:56-59 flag it; it must be resolved before go-live.

- **FYI:** Email notifications are deliberately not built — documented in both CLAUDE.md:244-245 and new-features-summary (in-app only). Not a gap; listed for completeness.

- **FYI:** First-admin bootstrap and `games` edits are intentionally SQL-Editor-only operations (CLAUDE.md:73-75, 100). Matches the docs; no admin UI is required or present.

- **FYI:** Default Gemini model `gemini-3.5-flash-lite` (`utils/gemini.ts:9`, CLAUDE.md:32) is a real GA model per Google docs; `GEMINI_MODEL` overrides it. Verified — no issue.

## Unverifiable locally

- **End-to-end sentiment pipeline** — `/api/feedback` → `claim_gemini_call` → Gemini → `save_feedback_sentiment` requires live Supabase + `GEMINI_API_KEY` + the Vault secret `feedback_server_key` matching `FEEDBACK_SERVER_KEY` (`202610181000` setup steps at file top). Code path verified; runtime behavior not.
- **pg_cron job actually running** — `cron.schedule` exists in `202610171400:327-328` but whether `dalta-checkin-open-notifications` fired on the live DB (pg_cron extension enabled) needs a Supabase dashboard check.
- **Realtime delivery** — publication adds exist for `matches`, `match_checkins`, `match_result_submissions`, `notifications`, but live scoreboard/notification-bell updates and Presence "watching now" counts need a running instance.
- **RLS enforcement** — policies are read-only-verified in SQL; actual deny/allow behavior per role needs live probes (separate assessment area C).
- **Email flows** — confirmation/reset delivery, Site URL + redirect-URL config, custom SMTP, reset-template fix (CLAUDE.md:45-50) are Supabase-dashboard/Railway settings.
- **Facebook embeds & OG previews** — iframe embed requires a Public Facebook video; OG cards need a deployed URL crawled by Facebook/Messenger.
- **Mobile 375px rendering** — conventions are in the code (`px-4`, `overflow-x-auto`, `flex-wrap` throughout) but visual no-side-scroll confirmation needs a browser pass.
- **`/admin/website` `refreshSite()` cache invalidation** — `updateTag('site')` behavior depends on Next 16 Cache Components runtime.
