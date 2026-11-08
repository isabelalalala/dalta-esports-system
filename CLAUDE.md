# DALTA Esports: Tournament Management System

Full requirements (business case, CFD, DFD, use cases, wireframes): see docs/requirements.md. Read it before starting a new module.
Everything added beyond the original 6 modules (actors, use cases, data flows, tables): docs/new-features-summary.md.
Keep both files in sync when a feature adds an actor, a use case, a data flow or a table.

Capstone system for DALTA Esports (UPHSD Molino) and AcadArena South Luzon Esports Conference (SLEC).
Full title: "DALTA Esports: Tournament Management System with AI-Powered Feedback Sentiment Analytics".

@AGENTS.md

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4: theme lives in `app/globals.css` under `@theme`. There is no `tailwind.config.js`.
- Supabase: auth, Postgres and RLS, accessed through `@supabase/ssr` (cookie-based sessions)
- Google Gemini API (sentiment, Module 5), Facebook Live embeds (streaming, Module 4), Chart.js (reports, Module 6)
- Deployment: Vercel (the `Dockerfile` still works for any container host). Version control: Git/GitHub.
- Auth emails: Supabase Auth sends them through Brevo (custom SMTP, set in the Supabase dashboard; no code or key in the app).
- Next.js 16 note: middleware is `proxy.ts` in the project root, not `middleware.ts`.
- Brand guide (colors, fonts, logo, voice): `docs/brand.md` — the `@theme` tokens in `app/globals.css` are the source of truth.

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
- `FEEDBACK_SERVER_KEY`: server only. Must equal the Vault secret `feedback_server_key` (see
  `202610181000_feedback_protection.sql`); lets the server read waiting comments/feedback, save sentiment and
  moderation results, and use the Gemini rate limit. Without it, comments and feedback are saved but stay
  "pending analysis" (comments stay visible, unmoderated).
- `NEXT_PUBLIC_SITE_URL`: the app's public address, e.g. `https://<app>.vercel.app` (no trailing slash). Used
  for link previews (metadataBase), shared links and calendar files. Falls back to Vercel's production domain
  (`NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`), then http://localhost:3000 (`utils/site-url.ts`).
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`, `NEXT_PUBLIC_PRIVACY_CONTACT_PERSON`: optional; the privacy notice's
  data protection contact. The fallbacks in `utils/privacy.ts` are placeholders: set the real ones before launch.
- All of them live in `.env` (git-ignored) and must also be set in Vercel (Project → Settings → Environment
  Variables) when deploying. `NEXT_PUBLIC_*` values are built into the app: redeploy after changing them.
- Vercel time limits: the API routes set `maxDuration` (feedback 30 s, exports 60 s) because Gemini can take 15 s.

## Auth pages and Supabase settings
- `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`.
- `/auth/callback` (route handler) turns email links into a session, then redirects to `?next=` (app paths only).
- After anything that changes what `proxy.ts` would decide (log in, log out, privacy consent, terms, weak-password
  change), navigate with `reloadTo(path)` from `utils/auth.ts` (a full page load), never `router.push`. The client
  router keeps prefetched pages, so `/dashboard` prefetched while logged out replays "redirect to login".
- Admin "Add account" on `/admin/users` signs people up with `utils/supabase/signup-client.ts`. This is a separate
  client that doesn't save a session, so the admin stays logged in. It's the only place not using the clients above.
- Supabase dashboard → Authentication → URL Configuration: Site URL = the app URL; Redirect URLs include
  `http://localhost:3000/**` and the Vercel domain `/**`.
- Reset links work only in the browser that requested them. To make them work on any device, change the
  "Reset Password" email template link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`.
- Emails go through Brevo (Supabase → Authentication → Emails → SMTP Settings); the per-hour limit is under
  Authentication → Rate Limits. Without custom SMTP, Supabase's built-in sender allows only a few emails per
  hour for the whole project. When a limit is hit, Supabase returns `over_email_send_rate_limit`: the auth pages
  explain it (`isEmailRateLimited()`, `emailRateLimitMessage()` in `utils/auth.ts`) and every button that sends
  an email waits 60 s afterwards (`useCooldown()` in `utils/use-cooldown.ts`). Register also blocks double submits.
- Email confirmation: keep Authentication → Sign In / Providers → Email → "Confirm email" ON, and set the minimum
  password length to 10 and "Password requirements" to lowercase, uppercase, digits and symbols (the app checks
  the same rules, plus no common password and no name/email, in `utils/password.ts` with `components/PasswordField.tsx`;
  login flags users whose old password breaks them (`user_metadata.weak_password`) and `proxy.ts` keeps sending
  them to `/profile?weak=1` until they change it; changing or resetting the password clears the flag). Email fields use `components/EmailField.tsx`
  (`isValidEmail()` in `utils/auth.ts`). Register works either way: no session after `signUp()` = show
  "Check your email"; a session = go to the dashboard. The confirmation link goes through `/auth/callback` to
  `/auth/login?confirmed=1`. Login shows a "confirm your email first" message with a resend button
  (`app/auth/login/page.tsx`, using helpers from `utils/auth.ts`).
- Data Privacy Act (RA 10173): `/privacy` is the public Privacy Notice; its version, contact email and contact person
  are in `utils/privacy.ts` (the contact fallbacks are placeholders; set `NEXT_PUBLIC_PRIVACY_CONTACT_*`). Register
  requires the consent checkbox (`components/PrivacyConsentCheckbox.tsx`). `proxy.ts` sends logged-in users
  without current-version consent to `/privacy/consent` on every protected page (not just the dashboard).
  Changing `PRIVACY_NOTICE_VERSION` asks everyone to agree again.
  Keep the notice in sync when a feature changes what data is collected or who can see it.
- Terms of Service: `/terms` (public draft pending org review), `/conduct` (Code of Conduct, part of the terms),
  `/cookies`, `/security`. Same acceptance pattern as privacy: version in `utils/terms.ts` (`TOS_VERSION`),
  `profiles.tos_version`/`tos_accepted_at`, `accept_tos(version)` RPC, register checkbox
  (`components/TermsCheckbox.tsx` — also carries the 18+/guardian-consent declaration), `proxy.ts` gate to
  `/terms/accept`. Changing `TOS_VERSION` asks everyone to accept again.

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
All migrations are in `supabase/migrations/`, run in filename order (202610151100 … 202611081700). `202610151100_base_schema` creates the three pre-migration base tables (`profiles`, `tournaments`, `tournament_registrations`). It is `if not exists`, so it is a no-op on databases that already have them.
`202610181000_feedback_protection` also needs its one-time Vault key setup (the `feedback_server_key` secret +
`FEEDBACK_SERVER_KEY`); the steps are at the top of that file.
Readers: "anyone" = also logged out; "logged-in" = any role; "admin/staff" = organizers only.

**Accounts (Module 1)**
- `profiles`: id (uuid, = auth.users.id, deleted with the auth user), email, role, full_name, created_at (join date),
  updated_at, privacy_consent_at, privacy_consent_version (null = not agreed yet; set at sign-up or only through
  `give_privacy_consent(version)`, never edited directly, not even by admins),
  avatar_url (202611081400: public address in the `avatars` bucket; CHECK = the user's own folder; only the owner
  changes it, admins only remove it via `admin_remove_avatar(user, reason)` (logged `user.avatar_removed`, notifies
  `avatar_removed`); trigger `protect_avatar()`, flag `removing_avatar`), tour_dismissed_at (quick tour finished/skipped),
  tos_version, tos_accepted_at (Terms of Service acceptance — also records the 18+/guardian declaration;
  set at sign-up or only through `accept_tos(version)`).
  Student verification (players): student_id, school, course_year (the player edits them on `/profile`),
  verification_status (`unsubmitted`/`pending`/`verified`/`rejected`), is_verified (generated from the status),
  verification_note (reason shown to the player), submitted_at, reviewed_by, reviewed_at. Saving complete details
  sets `pending`; emptying any of the three fields later resets to `unsubmitted` (trigger). Only admin/staff change the status, through
  `review_student_verification(user, approve, note)` (rejecting or revoking needs a reason). One account per
  student ID per school (unique index). Other users only see `is_verified` (roster, player search).
  Created by the `handle_new_user()` trigger on sign-up (it also saves the privacy consent from the register form).
  Read: own row; admin/staff read all. Update: own row (role, id, email, consent and verification fields are
  protected by triggers); admins update any.

**Registration and tournaments (Module 2)**
- `games`: id (text, e.g. `mlbb`), name, min_players, max_players, min_participants, max_participants (allowed
  tournament size: MLBB/CODM 4–64 teams, Valorant/LoL 4–32, Tekken 8 8–128 players; 202610251000). Anyone reads
  (also logged out, since 202610171600). Edited only in the SQL Editor.
- `tournaments`: id, name, description, rules, game (one of the 5 game names), game_id (→ games, required),
  start_date, end_date, max_participants (inside the game's range, trigger `check_tournament_participants()`, checked
  only on insert or when game/limit change; can't go below active registrations), registration_deadline (≤ start_date; end_date ≥ start_date),
  requires_verification (default true; tournaments made before 202610171000 were set to false: every team member
  must be verified to register, to be approved, and to be added to a registered team),
  status (only `upcoming` or `cancelled` is stored), created_by (→ profiles, set null when the user is deleted),
  created_at, updated_at. Anyone reads; admin/staff create and edit; only admin deletes.
  The status shown in the app (upcoming / registration closed / ongoing / completed / cancelled) is calculated
  from the dates by `getTournamentStatus()` in `utils/tournaments.ts`.
- `player_game_profiles`: id, user_id, game_id (→ games), ign, in_game_role, rank, created_at.
  UNIQUE (user_id, game_id). Logged-in read; players write their own. Can't be deleted (or moved to another game)
  while its owner is on a team for that game (202611011100); editing IGN/role/rank is fine.
- `teams`: id, name, description, game_id (→ games), captain_id (→ profiles), recruiting (open to join requests,
  202611011300; changed by the captain or through `set_team_recruiting()`, which admin/staff may also call),
  created_at, is_removed / removed_by / removed_at (soft delete, 202611081000). UNIQUE (name, game_id).
  Removal: `remove_team(team, reason)` (admin/staff) withdraws pending/approved registrations for tournaments that
  haven't ended, cancels open invites/join requests, gives every unfinished match to the opponent as a walkover
  (`apply_removed_team_walkover()`; an unknown opponent gets it as soon as they arrive, trigger
  `matches_removed_team_walkover`), saves the roster in `team_removals` and deletes the `team_members` rows (members
  are free to join other teams), notifies members (`team_removed`) and logs `team.removed`. `restore_team(team)`
  (admin) brings back the captain + former members who are still free (`team_restored`, `team.restored`); it doesn't
  undo withdrawals or walkovers. A removed team can't be edited, deleted, invited to, asked to join or registered
  (`protect_team_removal()`, `refuse_removed_team()`); `list_teams()` leaves it out; brackets show "(removed)"
  (`teamLabel()` in `utils/matches.ts`). The flag `app.removing_team` lets the two functions past the roster lock
  and captain guard.
- `team_removals` (202611081000): id, team_id, removed_by, removed_at, reason (5–500), roster (jsonb: user_id,
  full_name, role), tournaments (jsonb names withdrawn), walkovers, restored_by, restored_at. Admin/staff read;
  written only by `remove_team()`/`restore_team()`. Kept apart from `teams` because every logged-in user reads teams.
  The captain needs a game profile for the team's game, on create and on captaincy transfer (202611011100).
  The captain can edit name and description; game and captain can't change. Teams in a bracket can't be deleted,
  and neither can teams with a pending/approved registration for a tournament that hasn't ended
  (remove the registration first: 202610181200). Team names are unique per game ignoring case/whitespace.
- `team_members`: id, team_id, user_id, role (`captain`/`player`), joined_at. The captain is added automatically;
  other players join only by accepting an invite (no insert policy). Members leave and the captain removes players
  (delete policy), except while the team is registered (pending/approved) for a tournament that hasn't ended
  (roster lock trigger; admin/staff are exempt). Nobody, not even admin/staff, removes the captain row (202611011000): transfer the captaincy or delete the team. `transfer_team_captaincy(team, user)` hands over the team.
- `team_invites`: id, team_id, invited_user_id, invited_by, status (`pending`/`accepted`/`declined`/`cancelled`),
  created_at, responded_at. One pending invite per team+player. The captain inserts (trigger checks game profile,
  other team for the same game, roster size, solo games) and cancels; the player answers with
  `respond_to_team_invite(invite, accept)`, which adds them to `team_members` and cancels their other open invites
  for that game. Names for the UI come from `get_my_team_invites()` and `get_team_invites(team)`.
  Roster sizes are in `games` (MLBB/Valorant/LoL/CODM 5–6 incl. captain, Tekken 8 1–1 = no invites).
- `team_join_requests` (202611011300): id, team_id, user_id, message (≤ 300), status
  (`pending`/`accepted`/`declined`/`cancelled`), created_at, responded_at. One open request per player per team.
  A player inserts their own (trigger checks: team recruiting, player role, game profile, not on a team for that
  game, no open invite from that team, roster not full, not solo) and cancels by deleting it while pending.
  Read: the player, the team's captain, admin/staff. No update policy: only `respond_to_join_request(request,
  accept)` (captain) changes the status; accepting inserts into `team_members` (normal roster checks) and cancels
  the player's other open requests and invites for that game. Names for the captain come from
  `get_team_join_requests(team)`. The "All teams" directory reads `list_teams(search, game, recruiting_only,
  limit, offset)` (captain name + roster count, logged-in only).
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
- `match_drafts` (202611081300, League of Legends only): id, match_id (cascade), game_number (1–7, UNIQUE with
  match_id), team_a_bans, team_a_picks, team_b_bans, team_b_picks (text[], ≤ 5 each, names trimmed ≤ 30 chars,
  no champion twice per game: trigger `check_match_draft()`), updated_by, created_at, updated_at. Anyone reads
  (also logged out); admin/staff write. In Realtime. UI `components/MatchDraftSection.tsx` on `/matches/[id]`
  (staff edit) and `/t/[id]/match/[matchId]` (read-only); champion suggestions in `utils/lol-champions.ts`
  (autocomplete only, any name is accepted).
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
  Since 202610181200: approve/override are refused once the match is completed (reject stays, so stale rows can
  be cleared), a forfeit auto-rejects open submissions, and generate_bracket refuses while submissions are open.
- Storage: private bucket `match-proofs` (PNG/JPEG/WebP, 5 MB), paths `<match id>/<random>.<ext>`. Captains of the
  match upload; the two teams and staff read (signed URLs); no update/delete from the app. Deleting a match or
  tournament does NOT delete its files (remove them in Supabase Storage if needed).

**Pick'em predictions** (audience engagement, `202610181100_predictions`)
- `predictions`: id, user_id (→ profiles, cascade), match_id (→ matches, cascade: regenerating a bracket deletes
  its picks), predicted_winner_team_id (→ teams), is_correct (null until the match has a winner), created_at,
  updated_at. UNIQUE (user_id, match_id). Users read/insert/update/delete only their own rows.
- `check_prediction()` trigger: picks lock when the match is not `scheduled` OR scheduled_at has passed; both teams
  must be known; the pick must be team A or B; admin/staff can't pick; players can't pick their own team's match;
  users never set is_correct.
- `mark_predictions()` (AFTER UPDATE OF winner_team_id on matches, flag `app.marking_predictions`) marks every pick
  of the match when a winner is set/changed (approve, override, forfeit, direct edit) and clears it when removed.
- `get_prediction_split(match_ids[])` (anon + authenticated): totals per match and team only.
  `get_prediction_leaderboard(tournament)` (logged-in): top 20 + your row, names as "first name + initial",
  ranked by correct desc, then decided asc.
- UI: `components/PredictionsProvider.tsx` (loads splits + own picks for many matches at once) and
  `components/PredictionPicker.tsx` (full on `/matches/[id]` and `/t/[id]/match/[matchId]`, `compact` under each
  bracket box through `Bracket`'s `renderBelow`), leaderboard `app/tournaments/[id]/PickemLeaderboard.tsx`
  (top 3 on `/tournaments/[id]`, full on `/tournaments/[id]/predictions`). Types/rules in `utils/predictions.ts`.

**Event information (Module 3)**
- `announcements`: id, title, body, tournament_id (empty = general; deleted with the tournament), pinned,
  created_by, created_at, updated_at. Logged-in read; only admins post, edit and delete.
  `/schedule` (Schedule & Results) lists live, upcoming and finished matches from `matches` (no own table).

**Live streaming (Module 4)**, DFD store D3 "Streaming & Match Stat DB"
- `streams`: id, tournament_id, match_id (optional, set null when the match is deleted), title, facebook_url
  (must be an https facebook.com video link (/watch, /videos/, /reel/, /<page>/live or story.php?), checked in
  the database because the embed only renders video posts), status (`scheduled`/`live`/`ended`), created_by,
  created_at, updated_at. Logged-in read; admin/staff write.
  Since 202611081100: facebook_url holds the canonical address (`https://www.facebook.com/<page>/videos/<id>/` or
  `https://www.facebook.com/watch/?v=<id>`) and facebook_video_id the id (null for older id-less forms).
  `parseFacebookInput()` in `utils/streams.ts` handles every pasted form (/watch, /watch/live, /videos/, /reel/,
  embed code); share links (/share/v/, /share/r/, fb.watch) go to POST `/api/streams/resolve-url` (admin/staff),
  which follows the redirect (only to facebook.com/fb.watch: `utils/facebook-resolve.ts`, server only; login walls
  are read through `?next=`) and asks Facebook's embed page whether the video plays (`embeddable: false` = Facebook
  shows "Video unavailable / no permission": a warning in the form, not a block). `FacebookPlayer` always embeds the
  canonical address and swaps in a "Watch on Facebook" card when the frame doesn't load within 15 s (a
  cross-origin frame's "no permission" text can't be read, so the link under the player stays).
- `stream_views`: id, stream_id, user_id, viewed_on (date), created_at. UNIQUE (stream_id, user_id, viewed_on):
  one row per person per stream per day, recorded when the watch page opens. Users insert their own;
  only admin/staff read. `viewed_on` is the Philippine date (`Asia/Manila`) since 202610162300; older rows are UTC.
- `stream_presence` (`202610181300`): stream_id, user_id, last_seen (server-pinned). "Watching now": `/live/[id]`
  upserts its row every 45 s and deletes it on close; rows older than 90 s stop counting. Players/spectators
  write their own row only; nobody can select the table (viewer ids stay in the DB); `/analytics/engagement`
  polls `get_live_viewer_counts(stream_ids)` (admin/staff-only RPC) every 30 s. pg_cron job
  `dalta-stream-presence-cleanup` deletes rows older than 15 min.
- Notes for reports: organizers' own visits are stored but left out of the reports. Views per match exist only when
  the stream has a `match_id`. `streams.status` is set by hand by staff and doesn't depend on `matches.status`.

**Feedback and sentiment (Module 5)**, DFD store D4 "Feedback DB"
- `feedback`: id, user_id (set null when the account is deleted), tournament_id (empty = general; set null when the
  tournament is deleted), rating (1-5), comment (3-1000 chars), sentiment (`positive`/`neutral`/`negative`,
  empty until classified), sentiment_score (-1..1), topics (text[], max 3 short lowercase labels), classified_at,
  created_at. Users insert their own (without sentiment) and read their own; admins read all and write ONLY the
  sentiment fields (trigger); admins delete. Staff can't read feedback (since 202610162300); they only get counts
  and average ratings through `report_engagement()`.
- Since 202610181000: match_id (optional, → matches, set null; the tournament is filled in from the match),
  target_removed (set when its tournament/match is deleted), analysis_attempts, analysis_error, analysis_attempted_at.
  One feedback per user per tournament, per match, and one general (unique index `feedback_one_per_target`,
  nulls not distinct, ignores target_removed rows).
- Sending: POST `/api/feedback` saves as the user (refused for flagged/banned accounts: `can_post()` in the insert
  policy), then analyses right away with the shared moderation pipeline (see "Comments and moderation").
  ("pending analysis" = sentiment is null). Since 202611081500 feedback also has is_profane, is_offensive,
  offense_type, moderation_status (`pending`/`approved`/`hidden`/`restored`/`removed`), moderation_reason,
  reviewed_by/at; offensive feedback is hidden for review on `/admin/moderation`. "Retry pending analysis"
  (POST `/api/feedback/classify` admin, or `/api/moderation/retry` admin/staff) runs the next batch of 20,
  skipping rows that already failed `MAX_FEEDBACK_ANALYSIS_ATTEMPTS` (5, `utils/feedback.ts`): "Gave up".
  `save_feedback_sentiment()` / `mark_feedback_pending()` still exist but the app no longer uses them.
- Notes for reports: `topics` mix praise and complaints; "common concerns" = topics on negative feedback.
  Pending rows still have a rating.

**Comments and moderation (Phase 4)**, `202611081500_comments_moderation`
- `stream_comments`: id, stream_id (cascade), user_id (cascade), content (1–300, trimmed), created_at,
  sentiment_label, sentiment_score, topics, is_profane, is_offensive, offense_type (`none`/`bullying`/
  `harassment`/`hate_speech`/`threat`/`sexual`), moderation_status (`pending` shown, `approved` shown, `hidden`,
  `restored` shown, `removed`), moderation_reason, analysis_attempts/error/attempted_at, analysed_at,
  reviewed_by/at. Trigger `check_stream_comment()`: 1 per 3 s per user, users can't set moderation fields,
  no edits (flag `moderating`). Insert: own + `can_post()`. Delete: author, only approved/restored.
  Select: visible rows, own rows, admin/staff all. Everyone else (also logged out) reads through
  `get_stream_comments(stream, limit, before)` (visible only + the caller's own hidden ones; names as
  `short_name()` "Juan C." + avatar).
- `stream_comment_activity` (stream_id, version, changed_at): bumped on every comment change; the ONLY comment
  table in Realtime (anyone reads). Viewers reload through the function, so hidden comments disappear for
  everyone (Realtime can't tell viewers about rows they may no longer read).
- Pipeline (`utils/moderation.ts`, server only; same for comments and feedback): `claim_moderation_batch()`
  (oldest 20 waiting, the new item first) → `claim_gemini_call()` (10/min, 500/day, 5 per user per 10 min; a
  rate-limited batch doesn't count as an attempt) → `analyzeTexts()` in `utils/gemini.ts` (one call, strict JSON
  checked by `parseAnalysis()` in `utils/moderation-rules.ts`, asked once more if unparsable; Taglish prompt) →
  `save_moderation_result()` (profanity: visible + 1 warning; offensive: hidden + 1 warning; 5 active warnings →
  `check_ban_threshold()` flags the account, notifies user + admins) or `mark_moderation_pending()`. All need
  FEEDBACK_SERVER_KEY. POST `/api/comments` saves as the user and runs the batch in `after()` (posting is
  instant); every new comment/feedback also retries older waiting items.
- `user_warnings`: id, user_id, source (`comment`/`feedback`), source_id, type (`profanity`/`offensive`), reason,
  created_at, issued_by (null = AI), removed_at/by, removal_reason (soft removal). User reads own, admin all;
  written only by functions. `active_warning_count()`.
- `profiles.ban_status` (`none`/`pending`/`banned`), ban_flagged_at, banned_at, banned_by, ban_reason: changed
  only by the functions (trigger `protect_ban_fields()`, flag `moderating_user`). Pending/banned can't comment or
  send feedback (`can_post()`); banned → `/banned` (proxy.ts) and, with the Supabase Auth hook
  `custom_access_token_hook` switched on (dashboard → Authentication → Hooks), no login/refresh.
  `components/FlaggedAccountNotice.tsx` shows flagged users a notice once per session.
- Moderator functions (all logged): `moderate_comment(id, restore|remove, note, warn)` (admin/staff; restore
  drops the AI's warning), `moderate_feedback()` (admin), `remove_warning(id, reason)`, `ban_user(user, reason)`
  (not admins, not self), `dismiss_ban(user, note)` and `unban_user(user, note)` (both reset active warnings).
  `/admin/moderation` (admin/staff; tabs for admins: hidden content, pending bans, flagged users).
- `report_comment_sentiment(tournament, from, to)` (admin): totals, flagged, per stream/tournament/day, top
  topics; shown on `/admin/feedback` (`app/admin/feedback/CommentSentiment.tsx`).
- UI: `components/StreamComments.tsx` on `/live/[id]` (sidebar), `/t/[id]` and `/t/[id]/match/[matchId]`
  (logged out: read + "Log in to comment"; moderators can remove from the panel). `/profile#warnings`
  (`components/MyWarnings.tsx`).

**Administrative reports (Module 6)**, DFD store D5 "Analytics & Engagement DB"
- `analytics_reports`: id, filters (jsonb, readable names: tournament, game, from, to, source), data (jsonb:
  `{activity, sentiment, engagement, comments, moderation, insights}`: the report functions' results plus the
  written text; reports saved before 202611081700 have only the first three), generated_by (set null when the
  user is deleted), generated_at. Admins read, insert (as themselves) and delete; nobody updates. Generating and
  deleting are logged (`report.generated` / `report.deleted`, trigger `analytics_reports_log`).
- Report functions take `(p_tournament_id, p_game_id, p_from, p_to)`; null = all, dates inclusive in Manila time.
  They are security definer and check the role first: `report_activity()` (+ `registrations_by_day` since
  202611081700), `report_sentiment()`, `report_comments()` (comment sentiment in the same shape as
  report_sentiment + `by_stream`; negative examples only from visible comments) and `report_moderation()`
  (warnings, hidden/removed/restored comments and feedback, offense types, bans from the activity log) (admin),
  `report_engagement()` (admin/staff). Each returns one jsonb object; the shapes are typed in `utils/reports.ts`.
  Byes don't count as matches; general feedback is left out when a tournament or game is chosen.
- Written interpretations (Phase 5, `utils/report-insights.ts`): POST `/api/reports/generate` (admin) runs the
  report functions as the admin, `buildInsightRequest()` computes facts per chart + rule-based findings and
  recommendations, Gemini (`writeReportInsights()` in `utils/gemini.ts`, through `claim_gemini_call()`) only
  rewords them, `acceptDraft()` keeps a sentence only if every number in it is in the facts (else the computed
  sentence). No Gemini key / rate limit / error → computed sentences (`rulesInsights()`, also used for old
  saved reports). Data source filter (`all`/`feedback`/`comments`): `sentimentForSource()` /
  `combineSentiment()` in `utils/reports.ts`. Charts: `components/ReportChart.tsx` (axis titles, legend,
  tooltips, "Show data table", palette per theme from `chartPalettes`, light when printing).

**Activity log (audit)**
- `activity_logs`: id, actor_id (→ profiles, set null when deleted; null = SQL Editor or self-deleted account),
  action (e.g. `registration.approved`), entity_type, entity_id, details (jsonb: names as they were, incl.
  actor_name; never emails or student IDs), created_at. Only admins read; no insert/update/delete policies.
- Written only by AFTER triggers through `log_activity()` (not callable from the app): tournaments, registrations,
  matches (results, `match.edited` field changes, and one `bracket.generated` entry when the final is inserted),
  team join request answers (`team.join_request.accepted/declined`),
  match_result_submissions (`result.<status>` for every decision), profiles (role, student review,
  deletion), announcements, streams. Changes made by other triggers or FK cascades (`pg_trigger_depth() > 1`)
  aren't logged, except account deletion. When adding a new loggable action, add its label and sentence to
  `utils/activity.ts` (`ACTION_GROUPS`, `describeActivity()`).
- Kept 1 year (Privacy Notice): run `select public.purge_old_activity_logs();` in the SQL Editor; the app can't.

**Notifications**
- `notifications`: id, user_id (→ profiles, deleted with the user), type (CHECK list; the latest full list is in
  `202611081500_comments_moderation.sql`), title, message, link (app path only), is_read, created_at. Users read their own and may update
  ONLY `is_read` (column grant); no insert/delete from the app. In the `supabase_realtime` publication.
- Created only by AFTER triggers through `notify_users()` (not callable from the app; skips the person who caused
  it): registration approved/rejected → captain, registration removed (admin delete) → captain; tournament
  cancelled → members of registered teams; match time set/changed or match live → members of both teams
  (finished matches send nothing; a reschedule warns check-ins were reset);
  announcement → everyone (general) or members of teams registered for that tournament; team invite → the player;
  invite accepted/declined, member left → the captain; removed from a team → the player; made captain → the new
  captain; student verified/rejected/revoked → the player; check-in open → both captains (pg_cron); forfeit →
  both teams; result submitted → other captain, confirmed/disputed → staff (+ submitter), approved/rejected →
  teams/captains; new registration (or re-sent after rejection) and a captain withdrawing → all admins/staff;
  student details sent for review → all admins/staff; role changed → that person; Pick'em pick marked right/wrong →
  the picker (`202611011200_more_notifications`); join request → captain, accepted/declined → the player
  (`202611011300_team_join_requests`). Some are sent from the functions themselves (`transfer_team_captaincy`, `declare_forfeit`,
  `submit/respond/review_match_result`, `send_checkin_open_notifications`). (`team_added` is no longer sent.)
  Message texts are saved, so times are in PH time.
  New types need the CHECK list and `notificationIcons` (a Lucide icon per type) in `utils/notifications.ts`.
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
- Public pages live in `app/(site)/` (layout = the wireframe's side nav; the header is global, see Pages). They are server components that
  read through the cached functions in `utils/site-data.ts` (`'use cache'`, `cacheLife('minutes')`, tag `site`)
  with `createPublicClient()` from `utils/supabase/public.ts` (no login: cached code can't read cookies). That is
  the fourth Supabase client and it is read-only. After admin edits, call the server action `refreshSite()`
  (`app/admin/website/actions.ts`, admin-checked, `updateTag('site')`) so the change shows immediately.
- `/admin/website` (admin): tabs Site text (`SiteTextEditor`), Carousel, Campaigns, Events, Divisions, Officers,
  Official teams (+ players). Lists use the generic `ListEditor` (add, edit, ▲▼ order, publish, delete, images);
  images go through `utils/site-images.ts` (`<folder>/<random>.<ext>`), and replaced/removed files are deleted.
- Logo: `public/DALTA ESPORTS LOGO TRNPRNT.png` unless one is uploaded on `/admin/website`.

**Storage buckets**
- `match-proofs` (private): result screenshots, `<match id>/<random>.<ext>`, PNG/JPEG/WebP, 5 MB. Captains of the
  match upload; the two teams and staff read through signed URLs. No update/delete from the app.
- `site-images` (public): website images (logo, carousel, campaigns, events, divisions, officers, teams,
  players), `<folder>/<random>.<ext>`, PNG/JPEG/WebP/GIF, 5 MB. Anyone views; only admins write.
- `avatars` (public, 202611081400): profile pictures, `<user id>/<random>.webp`, JPG/PNG/WebP, 2 MB. Users write
  only in their own folder; admins may delete any file (after `admin_remove_avatar()`).
- Bucket settings and policies are created in the migrations (storage.buckets / storage.objects).

**Database functions**: `get_my_role()`, `current_user_role()` (older alias of get_my_role), `search_players(game_id, search)`,
`get_team_roster(team_id)` (name, IGN, in-game role, is_verified), `generate_bracket(tournament_id)`, `delete_own_account()`,
`admin_delete_user(target)`, `report_activity/report_sentiment/report_engagement(...)` (Module 6), `give_privacy_consent(version)`, `review_student_verification(...)`, `activity_log_actors()` (admin filter list),
`purge_old_activity_logs()`, `purge_old_notifications()` (SQL Editor only), `respond_to_team_invite()`,
`transfer_team_captaincy()`, `get_my_team_invites()`, `get_team_invites()`, `check_in_match()`, `declare_forfeit()`,
`get_needs_attention()`, `log_export()`, `get_public_tournament()`, `get_public_calendar()`, `send_checkin_open_notifications()` (pg_cron only), `submit_match_result()`,
`respond_to_match_result()`, `review_match_result()`, `claim_gemini_call()`, `save_feedback_sentiment()`,
`mark_feedback_pending()` (server key only), `get_prediction_split()`, `get_prediction_leaderboard()`.
Business rules (roster size, registration checks, match results) are enforced by
triggers with readable error messages.

## Pages and shared code
- Auth: `/auth/*` (see above). Account: `/profile` (picture, name, game profiles, password, delete account).
- Players: `/teams` (tabs My teams / All teams; organizers open on All teams), `/teams/[id]` (Recruiting + join
  requests for the captain and organizers, "Ask to join" for other players), `/registrations` (My Registrations), dashboard "My Matches", `/matches/[id]`.
- Tournaments: `/tournaments`, `/tournaments/create`, `/tournaments/[id]` (details, bracket, announcements,
  watch-live banner, Admin Panel), `/tournaments/[id]/edit`, `.../registrations`, `.../matches`, `.../streams`, `.../predictions` (pick'em leaderboard).
- Organizers: `/matches` (Match Management overview), `/admin/teams` (admin/staff: active teams with Remove, removed
  teams with reason), `/admin/users` (admin only), `/admin/feedback` (admin only),
  `/admin/verification` (admin/staff: pending / rejected / verified students), `/admin/website` (admin only: public site editor), `/admin/activity` (admin only:
  activity log, 50 per page, filters by action, user and date).
- Reports: `/analytics` (admin: filters incl. data source, Generate report = POST `/api/reports/generate`,
  saved reports list, delete with ConfirmDialog; staff are sent to engagement), `/analytics/reports/[id]` (a
  saved report: Summary, then activity, sentiment, engagement and moderation with an interpretation under each
  chart; Export PDF via `window.print()` (page title = file name), Download CSV), `/analytics/engagement`
  (admin/staff: live stats, watching now, CSV, print). Report sections live in `app/analytics/`
  (SummarySection, ActivitySection, SentimentSection, EngagementSection, ModerationSection, ReportParts).
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
  `components/site/SiteHeader.tsx` (logo, search, and `SiteAuthButtons`: theme toggle + Log in / Sign up, or
  theme toggle + Dashboard + `NotificationBell` + your avatar (→ /profile) + Log out) and `components/Footer.tsx`.
- Navigation (Phase 3): `components/site/SiteNavLayout.tsx` wraps every section (public `(site)`, dashboard,
  tournaments, teams, matches, live, schedule, profile, registrations, admin, analytics, ...). The menu per role is
  `navFor(role, loggedIn)` in `utils/navigation.ts` (logged out = spectator menu; Moderation is added with Phase 4):
  sidebar on large screens, bottom tab bar (4 items + More) on phones when logged in, Menu bar when logged out;
  one highlighted item (`activeItem()`); breadcrumbs + Back on inner pages (`breadcrumbsFor()`, names via
  `useBreadcrumbName()` in `utils/breadcrumb-names.ts`); `<main>` is keyed by path for a fade-in.
  Who is viewing comes from `useViewer()` (`utils/use-viewer.ts`, one shared copy; call `refreshViewer()` after
  changing your own name or picture). Hints: `components/Tooltip.tsx` (hover/keyboard focus after 300 ms,
  long press; the bubble is a `position: fixed` portal, so parent overflow can't clip it) and
  `components/SectionHint.tsx`. Sidebar widths (Phase 6): icon rail between 1024 and 1279px (expand = the menu
  floats over the page), saved open/collapsed choice from 1280px; no sideways scroll, long labels get an
  ellipsis and the tooltip repeats the label. First-login tour: `components/QuickTour.tsx` (steps in `utils/tour.ts`) on the
  dashboard until `profiles.tour_dismissed_at` is set.
- Theme: `utils/theme.ts` + `components/ThemeToggle.tsx` + the DARK THEME block in `app/globals.css`
  (see docs/brand.md "Dark mode"). Profile pictures: `components/Avatar.tsx`, `components/AvatarUploader.tsx`
  (square crop on a canvas, 512px WebP, no library), helpers in `utils/avatars.ts`; storage bucket `avatars`.
- Everyone logged in: `/notifications`, `/privacy/consent`, `/announcements`, `/schedule`, `/live`, `/live/[id]`, `/feedback`.
- Exports: GET `/api/exports/[type]?format=xlsx|csv&tournament=&game=` (`utils/exports.ts`, server only).
  Types: registrations, rosters, matches (admin/staff), feedback (admin, anonymous), users (admin). Reads with the
  user's own session (RLS) after a role check, pages through 1000-row limits, logs via `log_export()` (action
  `export.<type>`) BEFORE sending; no log, no file. Excel via `write-excel-file` (text cells are always strings,
  so nothing becomes a formula); CSV via `utils/csv.ts`. Times in Philippine time (UTC+8, no DST).
  Buttons: `components/ExportButtons.tsx`.
- API: POST `/api/reports/generate` (admin: report + written interpretations, saved),
  POST `/api/feedback` (send + analyse), POST `/api/comments` (post; analysis after the response),
  POST `/api/feedback/classify` (admin) and `/api/moderation/retry` (admin/staff) retry the next waiting batch,
  POST `/api/streams/resolve-url`. `utils/gemini.ts`, `utils/moderation.ts` and `utils/facebook-resolve.ts`
  start with `import 'server-only'` (build fails if a client file imports them). `utils/report-insights.ts` is
  plain code (shared by the route, the report page and the tests).
- Shared: `components/` (TeamDirectory, AskToJoin, TeamJoinRequests, AnnouncementCard, FacebookPlayer, StarRating, VerifiedBadge, PrivacyConsentCheckbox, TeamInvites, ReportChart (Chart.js), ReportFilters, ConfirmDialog (native `<dialog>` confirm modal), RemoveTeamDialog, RemovedTeamPanel, GameLogo, MatchDraftSection);
  `utils/permissions.ts` (`can()`, role → permissions map),
  `utils/types.ts` (row types), `utils/reports.ts` (report types, chart colors, CSV export),
  `utils/verification.ts` (status labels, school suggestions), `utils/activity.ts` (activity log sentences),
  `utils/notifications.ts` (notification types, icons, read/unread), `utils/checkin.ts` (check-in window),
  `utils/tournaments.ts` (dates, status, round labels), `utils/matches.ts` (team names, round counts),
  `utils/streams.ts` (Facebook link check and embed URL), `utils/errors.ts` (`getErrorMessage`), `utils/game-logos.ts` (`getGameLogo()`, `gameInitials()`, logos in `public/` incl. `LOL LOGO.png`; render with `GameLogo`),
  `utils/use-realtime-refresh.ts` (live reloads), `utils/lol-champions.ts` (LoL draft limits + suggestions).
- `proxy.ts` lists every page that requires login; add new protected pages there.
- States: `components/PageLoading.tsx` (`PageLoading` full page, `SectionLoading` inline), `components/PageError.tsx`
  (page couldn't load), `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` (Next 16: props `error, retry`).
  `getErrorMessage()` turns raw Postgres/PostgREST/network errors into plain sentences and keeps our own trigger
  messages. Show the error instead of "No X yet" when a list failed to load.

## Conventions that apply to every module
- **Role checks go through `can(role, action)`** (`utils/permissions.ts`; `isOrganizer()` for "admin or staff").
  A control the role can't use is not rendered at all. Every action must also be enforced in RLS / a function /
  the API: the table of where each rule lives is `docs/permissions.md` (keep it in sync). Relationship checks
  (captain of this team) stay local. Destructive actions use `components/ConfirmDialog.tsx` and are logged.
- Pages that use `useParams()` or `useSearchParams()` need a `layout.tsx` with `<Suspense>` (Cache Components is on).
  See `app/tournaments/[id]/layout.tsx`.
- Page files may only export the page; shared constants go in `utils/` or `components/`.
- PostgREST embeds need a relationship hint when two tables are linked more than once, e.g. teams → profiles
  (captain_id and removed_by): `captain:profiles!teams_captain_id_fkey(...)`. Adding a second FK between two tables
  breaks every un-hinted embed between them, so search for embeds when adding one.
- In PL/pgSQL triggers shared by several tables, read a column that only some of them have (e.g. `new.status`) only
  inside an `if tg_table_name = ...` branch: a combined `and` condition still resolves the column and fails.
- When RLS blocks an update or delete, Supabase returns no error and no rows. Add `.select('id')` and check
  that a row came back, then show a clear message.
- Dates without a time (tournament dates) are stored as midnight UTC: use `toDateInput()` and `formatDate()`.
  Real moments (`created_at`, `scheduled_at`) are shown in the viewer's local time.
- **Breakpoints inside pages are container breakpoints** (Phase 6): `<main>` in `SiteNavLayout` is an `@container`,
  so page content uses `@3xl:` / `@5xl:` / `@7xl:` (48/64/80rem of CONTENT width) instead of `md:` / `lg:` / `xl:`.
  `sm:` stays a screen breakpoint (phone padding/text). Only the header, footer, sidebar/bottom bar, the standalone
  auth and legal pages (outside `SiteNavLayout`) and `PageLoading` use `md:`/`lg:`/`xl:`. Card lists use
  `grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]`-style grids; filter bars `flex-wrap`. Hero titles
  use the fluid sizes `text-hero` / `text-page-hero` / `text-display` (`clamp()` with `cqi`, in `@theme`).
- Focused fields: `focus:bg-surface`, never `focus:bg-white` (it stays pure white in dark mode; `surface` is
  white in light mode and dark grey in dark mode).
- Mobile (375px): no page may scroll sideways. Page padding `px-4` (`sm:p-6/8`), cards `p-4 sm:p-6`, rows with
  buttons use `flex-col sm:flex-row` or `flex-wrap`, long names get `break-words` (emails `break-all`), wide content
  (bracket, tables) scrolls inside its own `overflow-x-auto` box.
- Game logos: always `components/GameLogo.tsx` (logo, or the game's initials when there is none or the image fails);
  never `getGameLogo()` + a conditional layout. A layout column that depends on a logo existing broke the LoL page.
  Grid columns get `min-w-0` (or a min width) so their content can't be squeezed letter by letter.
- Mobile text: `app/globals.css` has an unlayered phone-only rule that makes small body paragraphs 16px / 1.5 line
  height / normal letter spacing and form fields 16px (no iOS zoom). Uppercase labels are left alone.
- New UI uses Tailwind classes, not inline styles (exceptions: `utils/og-card.tsx`, because `next/og` can't
  use Tailwind, and the crop window in `components/AvatarUploader.tsx`, whose positions are computed while dragging; the
  Tooltip bubble's position is also set from JS).
- One look for the whole app, public and logged in (the redesign): white page, Montserrat (uppercase only for titles, buttons and labels), rounded white
  cards (`bg-white border border-stone-200/90 rounded-2xl shadow-xs`), a dark photo hero at the top of each page
  (`PageHeroBackground`), and the logo's gold and maroon as accents. Full rules: `docs/brand.md`. Use the theme
  tokens from `app/globals.css`, never hex colors in classes or inline styles: `text-maroon` for accents on white,
  `text-gold` / `bg-gold` + `hover:bg-golddark` (buttons with `text-stone-950`, gold text only on dark),
  `bg-ink`, `bg-logo-stage`, `text-glow-gold`. Body text `text-stone-950`, muted `text-stone-500`/`600`; no
  light grays on white. Pages inside `SiteNavLayout` start with a `<div>` (the layout renders `<main>`).
  Red/emerald/yellow and the blue Verified badge are for meaning (errors, success, pending, verified), not decoration.
- The Supabase API returns at most 1000 rows per request by default, and anything beyond that is cut off without
  an error. Count or aggregate big tables (`stream_views`, `feedback`) in SQL instead of loading every row.

## Modules (from the business case)
1. Account Management: done. Registration, login, role-based access, own and other-account actions.
2. Registration and Tournament Management: done. Player registration, team registration,
   profile and in-game details (IGN, game, role), tournament scheduling, brackets.
3. Event Information and Announcements: done. Event info, announcements, match schedule updates.
4. Live Streaming: done. Staff configure Facebook Live URLs; audience watches embedded streams;
   real-time scoreboard; viewership recorded in `stream_views`.
5. Feedback and Sentiment Analysis: done. Audience and players submit feedback and ratings (one per tournament,
   per match and one general); Gemini classifies sentiment and topics when it's sent (rate-limited); failures stay
   "pending analysis" and admins retry them on `/admin/feedback`.
6. Administrative Reports: done. Admins generate a saved report (summary with findings and recommendations,
   activity, sentiment, engagement incl. pick'em, moderation) with Chart.js charts, a written interpretation under
   each chart (Phase 5), PDF and CSV; staff view engagement stats. Filters: tournament, game, date range, data source.
   Also: activity (audit) log and Excel/CSV exports.
7. (added) Public Website & Content Management: done. `app/(site)/`, edited on `/admin/website` (DFD 7.0, store D6).
8. (added) Audience Engagement (Pick'em Predictions): done. Picks, community split, leaderboard (DFD 8.0, store D9).
In the updated diagrams, notifications are store D7 and the activity log store D8 (see docs/requirements.md).
The business case also lists a "Database Module". It is not a separate module: each module adds its own
tables and migrations (see Current schema).

## Extra features (after the 6 modules)
All extra features are done (the prompts file itself isn't in `docs/`):
1. Account security and privacy: password reset, email confirmation screens, Data Privacy Act consent
   (`/privacy`, `/privacy/consent`, `202610170900_privacy_consent`).
2. Student verification (`/profile` student details, `/admin/verification`, `requires_verification` on
   tournaments, Verified badges; `202610171000_student_verification`).
3. Activity (audit) log (`/admin/activity`; `202610171100_activity_log`).
4. In-app notifications (bell in the header, `/notifications`, Realtime; `202610171200_notifications`).
5. Team invites (invite/accept/decline, leave, remove, transfer captaincy, roster lock;
   `202610171300_team_invites`).
6. Match check-in and result submission (`/matches/[id]`, forfeits, screenshots, confirm/dispute, staff review,
   "Needs attention"; `202610171400_match_checkin`, `202610171500_match_results`).
7. Admin-editable public website (`app/(site)/`, `/admin/website`; `202610171600_public_website`).
8. Exports to Excel/CSV (`/api/exports/[type]`; `202610171700_export_log`).
9. Public tournament pages, link previews (Open Graph), "Add to calendar" (.ics) and Share (`/t/[id]`,
   `/t/[id]/match/[matchId]`, `/calendar/...`; `202610171800_public_tournaments`).
10. Final quality pass: mobile layout at 375px, shared loading/empty/error states, friendly error messages,
    404/error pages; feedback protection with Gemini rate limit and "pending analysis" retry
    (`202610181000_feedback_protection`).
11. Pick'em predictions and leaderboard (`202610181100_predictions`).
Also done: the light redesign of every page (one look for public and logged-in pages; `docs/brand.md`).
The final feature list for the documents is docs/new-features-summary.md.

## How things work (read before adding a feature)
- **Notifications are created only in the database**: an AFTER trigger (or a security definer function) calls
  `notify_users(user_ids[], type, title, message, link)`. The app never inserts notifications. A new type needs:
  a migration that drops and re-adds `notifications_type_check` with the FULL list (copy the latest one), the type
  and an icon in `utils/notifications.ts`, and the trigger. Links must be app paths (`/...`).
- **Activity log entries are created only in the database**: AFTER triggers call `log_activity(action,
  entity_type, entity_id, details)`, which adds the actor's name. Put names (not ids only) in `details` so entries
  stay readable after deletions; never emails or student IDs. Skip `pg_trigger_depth() > 1` (cascades/other
  triggers). Add the action to `ACTION_GROUPS` and `describeActivity()` in `utils/activity.ts`. App-side actions
  that need logging go through a role-checked function like `log_export()`.
- **"Only through a function" rules**: some columns may only change inside one security definer function. The
  function sets a transaction flag with `set_config('app.<flag>', 'on', true)` and a BEFORE trigger refuses the
  change without it (`auth.uid() is null` = SQL Editor is always allowed). Flags in use: `giving_privacy_consent`,
  `reviewing_student`, `answering_invite`, `transferring_captain`, `declaring_forfeit`,
  `marking_predictions`, `removing_team`, `removing_avatar`, `moderating` (comments), `moderating_user` (bans).
- **Live updates** use `useRealtimeRefresh(key, sources, onChange)` (`utils/use-realtime-refresh.ts`): it
  subscribes to the listed tables, coalesces bursts into one reload and unsubscribes on unmount. A new table must
  be added to the `supabase_realtime` publication in a migration (current list: matches, match_checkins,
  match_result_submissions, notifications, teams, team_members, team_invites, team_join_requests, match_drafts).
  Supabase can't filter DELETE events, so filtered sources also get that table's deletes unfiltered.
- **Redefining an existing function or trigger function**: always start from its LATEST version (create or
  replace keeps only what you write). Latest versions: `check_tournament_registration`, `check_registration_update`
  → `202610171000_student_verification`; `check_team_member` → `202610171000`; `check_team_member_leave`, `notify_team_member_left`, `list_teams` → `202611081000_team_removal`; `get_team_roster`,
  `search_players`, `get_team_join_requests` → `202611081400_avatars_and_tour` (they return avatar_url); `protect_team_fields` → `202610171300`; `protect_profile_role`,
  `handle_new_user` → `202610170900_privacy_consent`; `log_match` → `202610171400_match_checkin`;
  `get_needs_attention` → `202610171500_match_results`; `notifications_type_check` → `202611081500_comments_moderation`;
  `report_engagement` → `202610181100_predictions` (adds predictions, predictors, prediction_accuracy,
  audience_accounts, prediction_participation and predictions_by_tournament; older saved reports lack them);
  `refuse_removed_team` → `202611081600_fix_refuse_removed_team`; `report_activity` → `202611081700_report_insights`; `protect_feedback` → `202610181000_feedback_protection`; feedback insert policy → `202611081500_comments_moderation`; `generate_bracket` → `202610181800_bracket_seed_pairing`.
- **Testing**: `npm test` runs Vitest on `utils/*.test.ts`. `npm run db:test` runs the pgTAP files in
  `supabase/tests/` against the local stack (`supabase start` first: needs Docker; `supabase/config.toml`
  exists for the local stack only, production migrations stay manual). `npm run db:types` regenerates
  `utils/database.types.ts` from the local schema; CI diffs it to catch drift.
- **Scheduled jobs (pg_cron, enabled)**: `dalta-checkin-open-notifications` every 5 minutes. Manual cleanups run in
  the SQL Editor: `purge_old_activity_logs()` (1 year), `purge_old_notifications()` (read, 90 days).
- **Privacy Notice**: current version `2026-11-08.2` (`utils/privacy.ts`; profile pictures, then comments, AI moderation,
  warnings and bans). Terms of Service: `2026-11-08` (Code of Conduct moderation rules). A new kind of personal data, or a new
  group who can see it, means updating `/privacy` and the version (everyone agrees again); small clarifications
  don't change the version.
- **Logged-out data** comes only from published website rows and the `get_public_tournament()` /
  `get_public_calendar()` functions (team names only). Don't open teams, registrations, streams or profiles to
  `anon`; add a security definer function that returns just what the public page needs.
- **New protected pages** go in `proxy.ts`. Public pages (website, `/t`, `/calendar`, `/privacy`) must not.

### Notes on reports (Module 6)
- Chart colors are `chartPalettes` in `utils/reports.ts`: one palette for light and one for dark, each validated
  for color-blind safety against its own card surface (recheck with a palette validator if a color changes).
  Sentiment uses blue (positive) / gray (neutral) / red (negative); other charts use the category slots in fixed
  order (`slot` on a series keeps a color fixed). Every chart needs a title, `categoryTitle`/`valueTitle` with
  units, and an interpretation (a facts function in `utils/report-insights.ts` + `insight` on its ReportCard).
- Viewership is counted by the app, not by Facebook: one view per logged-in person per stream per day.
  Official Facebook viewer counts would need the Graph API (a Facebook App and page tokens). That isn't built.
- Realtime Presence needs Realtime enabled for the project (it is, for `matches`); public channels must be allowed.

Restyle: done. Every page uses Tailwind and the light gold/maroon theme tokens (no inline styles or hex classes left).

Supported games: MLBB, Valorant, Tekken 8, League of Legends, CODM.

## How to work
- Work on one module at a time. Don't change files outside the current module unless asked.
- For anything bigger than a small fix, show a plan (files to create or change, plus SQL) and wait for approval.
- After changes, run `npm run lint` and `npm run build` and fix the errors.
- This is a student project. Keep code simple and readable, avoid unnecessary libraries, and comment
  any logic that isn't obvious.
- At the end, summarize what changed and list any SQL migrations I need to run.
