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
All migrations are in `supabase/migrations/` and have been run, in filename order (202610151200 … 202610162200).
Readers: "anyone" = also logged out; "logged-in" = any role; "admin/staff" = organizers only.

**Accounts (Module 1)**
- `profiles`: id (uuid, = auth.users.id, deleted with the auth user), email, role, full_name, created_at (join date),
  updated_at. Created by the `handle_new_user()` trigger on sign-up. Read: own row; admin/staff read all.
  Update: own row (role, id and email are protected by a trigger); admins update any.

**Registration and tournaments (Module 2)**
- `games`: id (text, e.g. `mlbb`), name, min_players, max_players. Logged-in read. Edited only in the SQL Editor.
- `tournaments`: id, name, description, rules, game (one of the 5 game names), game_id (→ games, required),
  start_date, end_date, max_participants, registration_deadline (≤ start_date; end_date ≥ start_date),
  status (only `upcoming` or `cancelled` is stored), created_by (→ profiles, set null when the user is deleted),
  created_at, updated_at. Anyone reads; admin/staff create and edit; only admin deletes.
  The status shown in the app (upcoming / registration closed / ongoing / completed / cancelled) is calculated
  from the dates by `getTournamentStatus()` in `utils/tournaments.ts`.
- `player_game_profiles`: id, user_id, game_id (→ games), ign, in_game_role, rank, created_at.
  UNIQUE (user_id, game_id). Logged-in read; players write their own.
- `teams`: id, name, description, game_id (→ games), captain_id (→ profiles), created_at. UNIQUE (name, game_id).
  The captain can edit name and description; game and captain can't change. Teams in a bracket can't be deleted.
- `team_members`: id, team_id, user_id, role (`captain`/`player`), joined_at. The captain is added automatically;
  the captain adds players found with `search_players()`. Added players need a game profile for the team's game.
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
  only admin/staff read.

**Feedback and sentiment (Module 5)**, DFD store D4 "Feedback DB"
- `feedback`: id, user_id (set null when the account is deleted), tournament_id (empty = general; set null when the
  tournament is deleted), rating (1-5), comment (3-1000 chars), sentiment (`positive`/`neutral`/`negative`,
  empty until classified), sentiment_score (-1..1), topics (text[], max 3 short lowercase labels), classified_at,
  created_at. Users insert their own (without sentiment) and read their own; admin/staff read all and write ONLY the
  sentiment fields (trigger); admins delete.

**Database functions**: `get_my_role()`, `current_user_role()` (older alias of get_my_role), `search_players(game_id, search)`,
`get_team_roster(team_id)` (name, IGN, in-game role), `generate_bracket(tournament_id)`, `delete_own_account()`,
`admin_delete_user(target)`. Business rules (roster size, registration checks, match results) are enforced by
triggers with readable error messages.

## Pages and shared code
- Auth: `/auth/*` (see above). Account: `/profile` (name, game profiles, password, delete account).
- Players: `/teams`, `/teams/[id]`, `/registrations` (My Registrations), dashboard "My Matches".
- Tournaments: `/tournaments`, `/tournaments/create`, `/tournaments/[id]` (details, bracket, announcements,
  watch-live banner, Admin Panel), `/tournaments/[id]/edit`, `.../registrations`, `.../matches`, `.../streams`.
- Organizers: `/matches` (Match Management overview), `/admin/users` (admin only), `/admin/feedback` (admin/staff).
- Everyone logged in: `/announcements`, `/schedule`, `/live`, `/live/[id]`, `/feedback`.
- API: POST `/api/feedback/classify` (admin/staff) sends up to 20 unclassified comments to Gemini in one request
  (`utils/gemini.ts`, server only) and saves the results as the logged-in organizer.
- Shared: `components/` (AnnouncementCard, FacebookPlayer, StarRating); `utils/types.ts` (row types),
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
- New UI uses Tailwind classes, not inline styles.

## Modules (from the business case)
1. Account Management: done. Registration, login, role-based access, own and other-account actions.
2. Registration and Tournament Management: done. Player registration, team registration,
   profile and in-game details (IGN, game, role), tournament scheduling, brackets.
3. Event Information and Announcements: done. Event info, announcements, match schedule updates.
4. Live Streaming: done. Staff configure Facebook Live URLs; audience watches embedded streams;
   real-time scoreboard; viewership recorded in `stream_views`.
5. Feedback and Sentiment Analysis: done. Audience and players submit feedback and ratings; organizers classify
   sentiment with Gemini on `/admin/feedback`.
6. Administrative Reports: not started. Analytics and engagement reports with Chart.js.
The business case also lists a "Database Module". It is not a separate module: each module adds its own
tables and migrations (see Current schema).

### Notes for Module 6 (Administrative Reports)
- Use cases: the Organizing Committee **generates the analytics report**, extended by **view sentiment analysis**
  (shown after the report). Tournament Staff **view engagement stats**. Both include Login.
- DFD 6.0 reads these stores. All the data already exists:
  - D2 "Tournament & Schedule": `tournaments`, `tournament_registrations`, `teams`, `team_members`, `matches`
  - D3 "Streaming & Match Stat": `streams`, `stream_views`
  - D4 "Feedback": `feedback`
  - D1 "User Account": `profiles` (sign-ups over time, role counts)
- D5 "Analytics & Engagement DB" has no table yet. Calculating the reports from the tables above when the page opens
  is enough; only add a table if saved or exported report snapshots are needed.
- RLS already allows admin/staff to read everything reports need: all profiles, all feedback and all stream_views.
  Players and spectators get only their own rows, so report pages must be admin/staff only.
- Chart.js is not installed yet: `npm install chart.js`. Use it directly in a client component; it doesn't need a
  React wrapper. Remember to `destroy()` the chart when the component unmounts.
- The `/admin/feedback` page already calculates sentiment counts, average rating and top topics. Reuse that logic
  for the sentiment charts, or move it to `utils/` and use it in both places.
- The dashboard's "📊 Analytics" card (admin/staff) links to `/analytics`, which doesn't exist yet.
- Viewership is counted by the app, not by Facebook: one view per logged-in person per stream per day.
  Official Facebook viewer counts would need the Graph API (a Facebook App and page tokens). That isn't built.

After all 6 modules: restyle every page with Tailwind CSS. The home (`app/page.tsx`), login, register and dashboard pages
still use inline styles; the rest already use Tailwind classes.

Supported games: MLBB, Valorant, Tekken 8, League of Legends, CODM.

## How to work
- Work on one module at a time. Don't change files outside the current module unless asked.
- For anything bigger than a small fix, show a plan (files to create or change, plus SQL) and wait for approval.
- After changes, run `npm run lint` and `npm run build` and fix the errors.
- This is a student project. Keep code simple and readable, avoid unnecessary libraries, and comment
  any logic that isn't obvious.
- At the end, summarize what changed and list any SQL migrations I need to run.
