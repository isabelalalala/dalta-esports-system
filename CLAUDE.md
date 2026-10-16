# DALTA Esports – Tournament Management System

Full requirements (business case, CFD, DFD, use cases, wireframes): see docs/requirements.md. Read it before starting a new module.

Capstone system for DALTA Esports (UPHSD Molino) and AcadArena South Luzon Esports Conference (SLEC).
Full title: "DALTA Esports: Tournament Management System with AI-Powered Feedback Sentiment Analytics".

@AGENTS.md

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4: theme lives in `app/globals.css` under `@theme`. There is no `tailwind.config.js`.
- Supabase: auth, Postgres and RLS, accessed through `@supabase/ssr` (cookie-based sessions)
- Google Gemini API (sentiment, Module 5), Facebook Live embeds (streaming, Module 4), Chart.js (reports, Module 6)
- Deployment: Railway. Version control: Git/GitHub.
- Next.js 16 note: middleware is `proxy.ts` in the project root, not `middleware.ts`.

## Supabase rules
- Client components (`"use client"`) use `createClient()` from `@/utils/supabase/client`.
- Server components, route handlers and server actions use `await createClient()` from `@/utils/supabase/server`.
- Never use the service role key anywhere in this app.
- Never run SQL against the database yourself. For schema changes, write a file in
  `supabase/migrations/<YYYYMMDDHHMM>_<name>.sql`. I run it manually in the Supabase SQL Editor.
- Every new table must enable RLS and include its policies in the same migration.
- Security is enforced by RLS first. Hiding buttons in the UI is only for convenience.

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase (safe for the browser).
- `GEMINI_API_KEY`: server only, never `NEXT_PUBLIC_`. Free key from Google AI Studio.
- `GEMINI_MODEL`: optional, default `gemini-3.5-flash-lite`.
- `NEXT_PUBLIC_SITE_URL`: the app's public address, e.g. `https://<app>.up.railway.app` (no trailing slash). Used
  for link previews (metadataBase), shared links and calendar files. Defaults to http://localhost:3000.
- All of them live in `.env.local` (git-ignored) and must also be set in Railway when deploying.

## Auth pages and Supabase settings
- `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`.
- `/auth/callback` (route handler) turns email links into a session, then redirects to `?next=` (app paths only).
- Admin "Add account" on `/admin/users` signs people up with `utils/supabase/signup-client.ts`. This is a separate
  client that doesn't save a session, so the admin stays logged in. It's the only place not using the clients above.
- Supabase dashboard → Authentication → URL Configuration: Site URL = the app URL; Redirect URLs include
  `http://localhost:3000/**` and the Railway domain `/**`.
- Reset links work only in the browser that requested them. To make them work on any device, change the
  "Reset Password" email template link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`.
- Supabase's built-in email sender allows only a few emails per hour; set up custom SMTP for demos.
- Email confirmation: keep Authentication → Sign In / Providers → Email → "Confirm email" ON, and set the minimum
  password length to 8 (the app checks 8 too). Register works either way: no session after `signUp()` = show
  "Check your email"; a session = go to the dashboard. The confirmation link goes through `/auth/callback` to
  `/auth/login?confirmed=1`. Login shows a "confirm your email first" message with a resend button
  (`utils/auth.ts`).
- Data Privacy Act (RA 10173): `/privacy` is the public Privacy Notice; its version, contact email and contact person
  are in `utils/privacy.ts` (the contact is still a placeholder). Register requires the consent checkbox
  (`components/PrivacyConsentCheckbox.tsx`). The dashboard sends users without consent to the current version
  to `/privacy/consent`. Changing `PRIVACY_NOTICE_VERSION` asks everyone to agree again.
  Keep the notice in sync when a feature changes what data is collected or who can see it.

## Roles (stored in `profiles.role`)
| role value | Actor in the documents |
|------------|------------------------|
| `admin`    | Organizing Committee / Administrator |
| `staff`    | Tournament Staff / Game Administrator |
| `player`   | Players |
| `spectator` | Audience / Spectator |

Enforced by a CHECK constraint on `profiles.role` (migration `202610161200_role_security`).
- Sign-up can only create `player` or `spectator`. The `handle_new_user()` trigger creates the profile.
- Only an admin, or a change run in the SQL Editor, can change a role. New organizers register normally,
  then an admin promotes them on `/admin/users`. Only the very first admin needs the SQL Editor:
  `update public.profiles set role = 'admin' where email = '...';`
- The last admin can't be demoted. Admins delete other users with `admin_delete_user(target)`.
- RLS policies check roles with `public.get_my_role()`.

## Current schema (public)
All migrations are in `supabase/migrations/` and have been run, in filename order (202610151200 … 202610171800).
Readers: "anyone" = also logged out; "logged-in" = any role; "admin/staff" = organizers only.

**Accounts (Module 1)**
- `profiles`: id (uuid, = auth.users.id, deleted with the auth user), email, role, full_name, created_at (join date),
  updated_at, privacy_consent_at, privacy_consent_version (null = not agreed yet; set at sign-up or only through
  `give_privacy_consent(version)`, never edited directly, not even by admins).
  Student verification (players): student_id, school, course_year (the player edits them on `/profile`),
  verification_status (`unsubmitted`/`pending`/`verified`/`rejected`), is_verified (generated from the status),
  verification_note (reason shown to the player), submitted_at, reviewed_by, reviewed_at. Saving complete details
  sets `pending`; changing them later resets to `pending` (trigger). Only admin/staff change the status, through
  `review_student_verification(user, approve, note)` (rejecting or revoking needs a reason). One account per
  student ID per school (unique index). Other users only see `is_verified` (roster, player search). Created by the `handle_new_user()` trigger on sign-up. Read: own row; admin/staff read all.
  Update: own row (role, id and email are protected by a trigger); admins update any.

**Registration and tournaments (Module 2)**
- `games`: id (text, e.g. `mlbb`), name, min_players, max_players. Logged-in read. Edited only in the SQL Editor.
- `tournaments`: id, name, description, rules, game (one of the 5 game names), game_id (→ games, required),
  start_date, end_date, max_participants, registration_deadline (≤ start_date; end_date ≥ start_date),
  requires_verification (default true; tournaments made before 202610171000 were set to false: every team member
  must be verified to register, to be approved, and to be added to a registered team),
  status (only `upcoming` or `cancelled` is stored), created_by (→ profiles, set null when the user is deleted),
  created_at, updated_at. Anyone reads; admin/staff create and edit; only admin deletes.
  The status shown in the app (upcoming / registration closed / ongoing / completed / cancelled) is calculated
  from the dates by `getTournamentStatus()` in `utils/tournaments.ts`.
- `player_game_profiles`: id, user_id, game_id (→ games), ign, in_game_role, rank, created_at.
  UNIQUE (user_id, game_id). Logged-in read; players write their own.
- `teams`: id, name, description, game_id (→ games), captain_id (→ profiles), created_at. UNIQUE (name, game_id).
  The captain can edit name and description; game and captain can't change. Teams in a bracket can't be deleted.
- `team_members`: id, team_id, user_id, role (`captain`/`player`), joined_at. The captain is added automatically;
  other players join only by accepting an invite (no insert policy). Members leave and the captain removes players
  (delete policy), except while the team is registered (pending/approved) for a tournament that hasn't ended
  (roster lock trigger; admin/staff are exempt). `transfer_team_captaincy(team, user)` hands over the team.
- `team_invites`: id, team_id, invited_user_id, invited_by, status (`pending`/`accepted`/`declined`/`cancelled`),
  created_at, responded_at. One pending invite per team+player. The captain inserts (trigger checks game profile,
  other team for the same game, roster size, solo games) and cancels; the player answers with
  `respond_to_team_invite(invite, accept)`, which adds them to `team_members` and cancels their other open invites
  for that game. Names for the UI come from `get_my_team_invites()` and `get_team_invites(team)`.
  Roster sizes are in `games` (MLBB/Valorant/LoL/CODM 5–6 incl. captain, Tekken 8 1–1 = no invites).
- `tournament_registrations`: id, tournament_id, user_id (who registered), team_id (→ teams),
  team_name (only on old rows), status (`pending`/`approved`/`rejected`/`cancelled`, default pending), registered_at.
  UNIQUE (tournament_id, team_id). Only pending + approved count towards max_participants.
  Logged-in read. Admin/staff approve or reject; the captain can cancel or delete only while pending;
  only admin deletes others.
- `matches`: id, tournament_id, round, match_number, team_a_id, team_b_id, scheduled_at, status
  (`scheduled`/`live`/`completed`), score_a, score_b, winner_team_id, next_match_id, created_at, updated_at.
  Single elimination: match k of round r feeds match ceil(k/2) of round r+1 (team A if k is odd, B if even).
  A trigger moves the winner forward; results lock once the next match starts. Byes = round-1 matches with one
  team, already completed. Anyone reads; admin/staff write. Built by `generate_bracket(tournament_id)`.
  In the `supabase_realtime` publication (live scoreboards).
  is_forfeit (set only by `declare_forfeit(match, winner)`, admin/staff, after scheduled_at; any other result
  change clears it), checkin_notified_at.
- Check-in: `tournaments.checkin_window_minutes` (default 30, 0 = off). Opens that many minutes before
  scheduled_at, closes at scheduled_at (database clock). `match_checkins` (match_id, team_id, checked_in_by,
  checked_in_at; one per team; logged-in read; in Realtime) is written only by `check_in_match(match)` (captain of
  either team, window open, match scheduled). Changing scheduled_at clears the check-ins.
  pg_cron job `dalta-checkin-open-notifications` runs `send_checkin_open_notifications()` every 5 minutes.
  `get_needs_attention()` (admin/staff) lists matches needing an organizer: `no_checkin`, `result_disputed`,
  `result_confirmed`, `result_pending`. `/matches/[id]` is the match page (check-in, forfeit, results);
  the dashboard "Needs attention" box (admin/staff) links to it.
- Results: `match_result_submissions` (match_id, team_id = submitting team, submitted_by, score_a, score_b,
  proof_path, status `pending`/`confirmed`/`disputed`/`approved`/`overridden`/`rejected`, dispute_reason,
  responded_by/at, review_note, final_score_a/b, reviewed_by/at, created_at). One open (pending/confirmed/disputed)
  per match. Readable by the two teams' members and staff (`can_view_match_results()`); in Realtime. Written only by
  `submit_match_result()` (either captain, match live or past its time, screenshot already uploaded),
  `respond_to_match_result()` (the OTHER captain; dispute needs a reason) and `review_match_result()` (admin/staff:
  approve / override with own score / reject with a note). Approve and override complete the match (winner advances).
- Storage: private bucket `match-proofs` (PNG/JPEG/WebP, 5 MB), paths `<match id>/<random>.<ext>`. Captains of the
  match upload; the two teams and staff read (signed URLs); no update/delete from the app. Deleting a match or
  tournament does NOT delete its files (remove them in Supabase Storage if needed).

**Event information (Module 3)**
- `announcements`: id, title, body, tournament_id (empty = general; deleted with the tournament), pinned,
  created_by, created_at, updated_at. Logged-in read; only admins post, edit and delete.
  `/schedule` (Schedule & Results) lists live, upcoming and finished matches from `matches` (no own table).

**Live streaming (Module 4)**, DFD store D3 "Streaming & Match Stat DB"
- `streams`: id, tournament_id, match_id (optional, set null when the match is deleted), title, facebook_url
  (must be https facebook.com, checked in the database), status (`scheduled`/`live`/`ended`), created_by,
  created_at, updated_at. Logged-in read; admin/staff write.
- `stream_views`: id, stream_id, user_id, viewed_on (date), created_at. UNIQUE (stream_id, user_id, viewed_on):
  one row per person per stream per day, recorded when the watch page opens. Users insert their own;
  only admin/staff read. `viewed_on` is the Philippine date (`Asia/Manila`) since 202610162300; older rows are UTC.
- Notes for reports: organizers' own visits are stored but left out of the reports. Views per match exist only when
  the stream has a `match_id`. `streams.status` is set by hand by staff and doesn't depend on `matches.status`.
- "Watching now" uses Supabase Realtime Presence, not a table: `/live/[id]` joins channel `viewers-<stream id>`
  (key = user id; players and spectators only) and `/analytics/engagement` counts who is in it.

**Feedback and sentiment (Module 5)**, DFD store D4 "Feedback DB"
- `feedback`: id, user_id (set null when the account is deleted), tournament_id (empty = general; set null when the
  tournament is deleted), rating (1-5), comment (3-1000 chars), sentiment (`positive`/`neutral`/`negative`,
  empty until classified), sentiment_score (-1..1), topics (text[], max 3 short lowercase labels), classified_at,
  created_at. Users insert their own (without sentiment) and read their own; admins read all and write ONLY the
  sentiment fields (trigger); admins delete. Staff can't read feedback (since 202610162300); they only get counts
  and average ratings through `report_engagement()`.
- Notes for reports: a user can send any number of feedback rows (no unique constraint). `topics` mix praise and
  complaints; "common concerns" = topics on negative feedback. Unclassified rows still have a rating.
  Opening `/admin/feedback` classifies one batch automatically.

**Administrative reports (Module 6)**, DFD store D5 "Analytics & Engagement DB"
- `analytics_reports`: id, filters (jsonb, readable names: tournament, game, from, to), data (jsonb:
  `{activity, sentiment, engagement}` exactly as the report functions return them), generated_by (set null when the
  user is deleted), generated_at. Admins read, insert (as themselves) and delete; nobody updates.
- Report functions take `(p_tournament_id, p_game_id, p_from, p_to)`; null = all, dates inclusive in Manila time.
  They are security definer and check the role first: `report_activity()` and `report_sentiment()` (admin),
  `report_engagement()` (admin/staff). Each returns one jsonb object; the shapes are typed in `utils/reports.ts`.
  Byes don't count as matches; general feedback is left out when a tournament or game is chosen.

**Activity log (audit)**
- `activity_logs`: id, actor_id (→ profiles, set null when deleted; null = SQL Editor or self-deleted account),
  action (e.g. `registration.approved`), entity_type, entity_id, details (jsonb: names as they were, incl.
  actor_name; never emails or student IDs), created_at. Only admins read; no insert/update/delete policies.
- Written only by AFTER triggers through `log_activity()` (not callable from the app): tournaments, registrations,
  matches (results + one `bracket.generated` entry when the final is inserted), profiles (role, student review,
  deletion), announcements, streams. Changes made by other triggers or FK cascades (`pg_trigger_depth() > 1`)
  aren't logged, except account deletion. When adding a new loggable action, add its label and sentence to
  `utils/activity.ts` (`ACTION_GROUPS`, `describeActivity()`).
- Kept 1 year (Privacy Notice): run `select public.purge_old_activity_logs();` in the SQL Editor; the app can't.

**Notifications**
- `notifications`: id, user_id (→ profiles, deleted with the user), type (CHECK list; `team_invite` is reserved for
  team invites), title, message, link (app path only), is_read, created_at. Users read their own and may update
  ONLY `is_read` (column grant); no insert/delete from the app. In the `supabase_realtime` publication.
- Created only by AFTER triggers through `notify_users()` (not callable from the app; skips the person who caused
  it): registration approved/rejected → captain; match time set/changed or match live → members of both teams;
  announcement → everyone (general) or members of teams registered for that tournament; team invite → the player;
  invite accepted/declined, member left → the captain; removed from a team → the player; made captain → the new
  captain; student verified/rejected/revoked → the player. (`team_added` is no longer sent.) Message texts are saved, so times are in PH time.
  New types need the CHECK list and `notificationIcons` in `utils/notifications.ts`.
- Cleanup: `select public.purge_old_notifications();` in the SQL Editor (read ones older than 90 days).
- Email notifications aren't built. Resend would need an API key (server only), a verified domain (DNS), a
  Database Webhook or Edge Function on inserts, a per-user opt-out, and a line in the Privacy Notice.

**Public website (editable by admins)**
- `site_content` (key, value, updated_by, updated_at): every text on the site; the editable keys, labels and
  fallbacks are `SITE_CONTENT_FIELDS` in `utils/site.ts` (+ `logo_path`, `about_image_path`). Anyone reads.
- `hero_images` (carousel), `campaigns`, `events` (+ optional tournament_id), `game_divisions` (one per game),
  `officers` (category `core_officer`/`division_head`/`coach`/`committee`, optional game_id),
  `official_teams` + `official_team_players` (the org's showcase teams, NOT the players' app teams; one captain
  per team). All have display_order; is_published decides visibility (players follow their team).
  Anyone (also logged out) reads published rows; admins read all and are the only writers.
- `games` is now readable by logged-out visitors too (division names).
- Storage: public bucket `site-images` (PNG/JPEG/WebP/GIF, 5 MB); admins upload/replace/delete.
- Public pages live in `app/(site)/` (layout = site header, side nav, search). They are server components that
  read through the cached functions in `utils/site-data.ts` (`'use cache'`, `cacheLife('minutes')`, tag `site`)
  with `createPublicClient()` from `utils/supabase/public.ts` (no login: cached code can't read cookies). That is
  the fourth Supabase client and it is read-only. After admin edits, call the server action `refreshSite()`
  (`app/admin/website/actions.ts`, admin-checked, `updateTag('site')`) so the change shows immediately.
- `/admin/website` (admin): tabs Site text (`SiteTextEditor`), Carousel, Campaigns, Events, Divisions, Officers,
  Official teams (+ players). Lists use the generic `ListEditor` (add, edit, ▲▼ order, publish, delete, images);
  images go through `utils/site-images.ts` (`<folder>/<random>.<ext>`), and replaced/removed files are deleted.
- Logo: `public/daltaesportslogo.jpg` unless one is uploaded on `/admin/website`.

**Database functions**: `get_my_role()`, `current_user_role()` (older alias of get_my_role), `search_players(game_id, search)`,
`get_team_roster(team_id)` (name, IGN, in-game role, is_verified), `generate_bracket(tournament_id)`, `delete_own_account()`,
`admin_delete_user(target)`, `report_activity/report_sentiment/report_engagement(...)` (Module 6), `give_privacy_consent(version)`, `review_student_verification(...)`, `activity_log_actors()` (admin filter list),
`purge_old_activity_logs()`, `purge_old_notifications()` (SQL Editor only), `respond_to_team_invite()`,
`transfer_team_captaincy()`, `get_my_team_invites()`, `get_team_invites()`, `check_in_match()`, `declare_forfeit()`,
`get_needs_attention()`, `log_export()`, `get_public_tournament()`, `get_public_calendar()`, `send_checkin_open_notifications()` (pg_cron only), `submit_match_result()`,
`respond_to_match_result()`, `review_match_result()`.
Business rules (roster size, registration checks, match results) are enforced by
triggers with readable error messages.

## Pages and shared code
- Auth: `/auth/*` (see above). Account: `/profile` (name, game profiles, password, delete account).
- Players: `/teams`, `/teams/[id]`, `/registrations` (My Registrations), dashboard "My Matches", `/matches/[id]`.
- Tournaments: `/tournaments`, `/tournaments/create`, `/tournaments/[id]` (details, bracket, announcements,
  watch-live banner, Admin Panel), `/tournaments/[id]/edit`, `.../registrations`, `.../matches`, `.../streams`.
- Organizers: `/matches` (Match Management overview), `/admin/users` (admin only), `/admin/feedback` (admin only),
  `/admin/verification` (admin/staff: pending / rejected / verified students), `/admin/website` (admin only: public site editor), `/admin/activity` (admin only:
  activity log, 50 per page, filters by action, user and date).
- Reports: `/analytics` (admin: filters, Generate report = calculate + save, saved reports list; staff are sent
  to engagement), `/analytics/reports/[id]` (a saved report: all three parts, Print / PDF via `window.print()`,
  Download CSV), `/analytics/engagement` (admin/staff: live stats, watching now, CSV, print).
  Report sections live in `app/analytics/` (ActivitySection, SentimentSection, EngagementSection, ReportParts).
- Public website (`app/(site)/`): `/` (home), `/about`, `/divisions`, `/divisions/[game]` (official teams),
  `/divisions/[game]/[team]`, `/events`, `/events/[id]`, `/campaigns`, `/campaigns/[id]`, `/community`,
  `/search?q=` (tournaments, events, campaigns). Shared pieces in `components/site/`. Pages that read params or
  searchParams put that part inside `<Suspense>`. Also public: `/privacy`.
- Public tournament pages: `/t/[id]` (info, rules, team names, bracket, schedule, results, live stream) and
  `/t/[id]/match/[matchId]`. Data from `get_public_tournament(id)` (`utils/public-tournament.ts`, team NAMES only;
  teams, registrations and streams stay closed to logged-out users). Not cached (scores must be current);
  `LiveRefresher` refreshes on match changes (Realtime) and every minute. Server-rendered times use
  `formatDateTime(value, 'Asia/Manila')` because the server clock is UTC. Link previews: `generateMetadata` +
  `opengraph-image.tsx` (drawn by `utils/og-card.tsx` with `next/og`).
- Calendar files: `/calendar/match|tournament|team/[id]` (route handler, `utils/ics.ts`, no library):
  Asia/Manila VTIMEZONE, fixed UID per match + SEQUENCE from updated_at (re-import updates), 1-hour events,
  `webcal://` subscribe links (`components/CalendarLinks.tsx`). Data from `get_public_calendar()`.
- `components/ShareButton.tsx`: native share sheet when available, Copy link, Share on Facebook.
- Every page (public and logged in) has the same header and footer, both in `app/layout.tsx`:
  `components/site/SiteHeader.tsx` (logo, search, and `SiteAuthButtons`: Log in / Sign up, or Dashboard +
  `NotificationBell` + Log out) and `components/Footer.tsx` (texts and social links from `site_content`).
- Everyone logged in: `/notifications`, `/privacy/consent`, `/announcements`, `/schedule`, `/live`, `/live/[id]`, `/feedback`.
- Exports: GET `/api/exports/[type]?format=xlsx|csv&tournament=&game=` (`utils/exports.ts`, server only).
  Types: registrations, rosters, matches (admin/staff), feedback (admin, anonymous), users (admin). Reads with the
  user's own session (RLS) after a role check, pages through 1000-row limits, logs via `log_export()` (action
  `export.<type>`) BEFORE sending; no log, no file. Excel via `write-excel-file` (text cells are always strings,
  so nothing becomes a formula); CSV via `utils/csv.ts`. Times in Philippine time (UTC+8, no DST).
  Buttons: `components/ExportButtons.tsx`.
- API: POST `/api/feedback/classify` (admin only) sends up to 20 unclassified comments to Gemini in one request
  (`utils/gemini.ts`, server only) and saves the results as the logged-in organizer.
- Shared: `components/` (AnnouncementCard, FacebookPlayer, StarRating, VerifiedBadge, PrivacyConsentCheckbox, TeamInvites, ReportChart (Chart.js), ReportFilters);
  `utils/types.ts` (row types), `utils/reports.ts` (report types, chart colors, CSV export),
  `utils/verification.ts` (status labels, school suggestions), `utils/activity.ts` (activity log sentences),
  `utils/notifications.ts` (notification types, icons, read/unread), `utils/checkin.ts` (check-in window),
  `utils/tournaments.ts` (dates, status, round labels), `utils/matches.ts` (team names, round counts),
  `utils/streams.ts` (Facebook link check and embed URL), `utils/errors.ts` (`getErrorMessage`).
- `proxy.ts` lists every page that requires login; add new protected pages there.

## Conventions that apply to every module
- Pages that use `useParams()` or `useSearchParams()` need a `layout.tsx` with `<Suspense>` (Cache Components is on).
  See `app/tournaments/[id]/layout.tsx`.
- Page files may only export the page; shared constants go in `utils/` or `components/`.
- When RLS blocks an update or delete, Supabase returns no error and no rows. Add `.select('id')` and check
  that a row came back, then show a clear message.
- Dates without a time (tournament dates) are stored as midnight UTC: use `toDateInput()` and `formatDate()`.
  Real moments (`created_at`, `scheduled_at`) are shown in the viewer's local time.
- New UI uses Tailwind classes, not inline styles (only exception: `utils/og-card.tsx`, because `next/og` can't
  use Tailwind).
- One look for the whole app, public and logged in: the logo's yellow and brown on a dark background (the
  client's wireframe style). Use the theme tokens from `app/globals.css`, never hex colors in classes:
  `bg-sitebg` (page), `bg-sitecard` (cards), `text-gold` / `bg-gold` + `hover:bg-golddark` (accents, buttons with
  `text-black`), `border-brownlight` / `border-brown` (lines), `shadow-[4px_4px_0_var(--color-brown)]` or `6px`
  (hard offset shadow), square corners (`rounded-full` only for pills and dots), `font-pixel` for page titles
  (`font-pixel text-xl sm:text-2xl leading-relaxed text-gold`). Red/green/yellow and the blue Verified badge are
  for meaning (errors, success, pending, verified), not decoration.
- The Supabase API returns at most 1000 rows per request by default, and anything beyond that is cut off without
  an error. Count or aggregate big tables (`stream_views`, `feedback`) in SQL instead of loading every row.

## Modules (from the business case)
1. Account Management: done. Registration, login, role-based access, own and other-account actions.
2. Registration and Tournament Management: done. Player registration, team registration,
   profile and in-game details (IGN, game, role), tournament scheduling, brackets.
3. Event Information and Announcements: done. Event info, announcements, match schedule updates.
4. Live Streaming: done. Staff configure Facebook Live URLs; audience watches embedded streams;
   real-time scoreboard; viewership recorded in `stream_views`.
5. Feedback and Sentiment Analysis: done. Audience and players submit feedback and ratings; admins classify
   sentiment with Gemini on `/admin/feedback`.
6. Administrative Reports: done. Admins generate a saved report (activity, sentiment, engagement) with Chart.js
   charts, print/PDF and CSV; staff view engagement stats. Filters: tournament, game, date range.
The business case also lists a "Database Module". It is not a separate module: each module adds its own
tables and migrations (see Current schema).

### Notes on reports (Module 6)
- Chart colors are in `utils/reports.ts` and were checked for color-blind safety on the card color `#1f1714`.
  Sentiment uses blue (positive) / gray (neutral) / red (negative); other charts use `categoryColors` in order.
- Viewership is counted by the app, not by Facebook: one view per logged-in person per stream per day.
  Official Facebook viewer counts would need the Graph API (a Facebook App and page tokens). That isn't built.
- Realtime Presence needs Realtime enabled for the project (it is, for `matches`); public channels must be allowed.

Restyle: done. Every page uses Tailwind and the yellow/brown theme (no inline styles left).

Supported games: MLBB, Valorant, Tekken 8, League of Legends, CODM.

## How to work
- Work on one module at a time. Don't change files outside the current module unless asked.
- For anything bigger than a small fix, show a plan (files to create or change, plus SQL) and wait for approval.
- After changes, run `npm run lint` and `npm run build` and fix the errors.
- This is a student project. Keep code simple and readable, avoid unnecessary libraries, and comment
  any logic that isn't obvious.
- At the end, summarize what changed and list any SQL migrations I need to run.
