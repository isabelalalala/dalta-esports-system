# DALTA Esports – Tournament Management System

Capstone system for DALTA Esports (UPHSD Molino) and AcadArena South Luzon Esports Conference (SLEC).
Full title: "DALTA Esports: Tournament Management System with AI-Powered Feedback Sentiment Analytics".

@AGENTS.md

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4: theme lives in `app/globals.css` under `@theme`. There is no `tailwind.config.js`.
- Supabase: auth, Postgres and RLS, accessed through `@supabase/ssr` (cookie-based sessions)
- Later modules: Google Gemini API (sentiment), Chart.js (reports), Facebook Live embeds (streaming)
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
- `profiles`: id (uuid, = auth.users.id, deleted with the auth user), email, role, full_name, updated_at, created_at (join date).
  Created by the `handle_new_user()` trigger on sign-up.
- `games`: id (text, e.g. `mlbb`), name, min_players, max_players. Edited only in the SQL Editor.
- `tournaments`: id, name, description, rules, game (one of the 5 game names), game_id (→ games, required),
  start_date, end_date, max_participants, registration_deadline (≤ start_date; end_date ≥ start_date),
  status (only `upcoming` or `cancelled` is stored), created_by (→ profiles, set null when the user is deleted),
  created_at, updated_at. The status shown in the app (upcoming / registration closed / ongoing / completed /
  cancelled) is calculated from the dates by `getTournamentStatus()` in `utils/tournaments.ts`.
- `teams`: id, name, description, game_id (→ games), captain_id (→ profiles), created_at. UNIQUE (name, game_id).
  The captain can edit name and description; game and captain can't change.
- `team_members`: id, team_id, user_id, role (`captain`/`player`), joined_at. The captain is added automatically;
  the captain adds players found with `search_players()`. Added players need a game profile for the team's game.
- `tournament_registrations`: id, tournament_id, user_id (who registered), team_id (→ teams),
  team_name (only on old rows), status (`pending`/`approved`/`rejected`/`cancelled`, default pending), registered_at.
  UNIQUE (tournament_id, team_id). Only pending + approved count towards max_participants.
  Admin/staff approve or reject; the captain can cancel or delete only while pending; only admin deletes others.
  Tournaments: anyone reads, admin/staff create and edit, only admin deletes.
- `matches`: id, tournament_id, round, match_number, team_a_id, team_b_id, scheduled_at, status
  (`scheduled`/`live`/`completed`), score_a, score_b, winner_team_id, next_match_id, created_at, updated_at.
  Single elimination: match k of round r feeds match ceil(k/2) of round r+1 (team A if k is odd, B if even).
  A trigger moves the winner forward; results lock once the next match starts. Anyone reads; admin/staff write.
  Teams in a bracket can't be deleted.
- `player_game_profiles`: id, user_id, game_id (→ games), ign, in_game_role, rank, created_at. UNIQUE (user_id, game_id)
- `announcements`: id, title, body, tournament_id (empty = general; deleted with the tournament), pinned,
  created_by, created_at, updated_at. Logged-in users read; only admins post, edit and delete.
  Shown on `/announcements`, the tournament page and the dashboard (`components/AnnouncementCard.tsx`).
  `/schedule` (Schedule & Results) lists live, upcoming and finished matches from `matches`.
- `streams`: id, tournament_id, match_id (optional, set null when the match is deleted), title, facebook_url
  (must be https facebook.com, checked in the database), status (`scheduled`/`live`/`ended`), created_by,
  created_at, updated_at. Logged-in users read; admin/staff write. Configured on `/tournaments/[id]/streams`,
  watched on `/live` and `/live/[id]` with Facebook's embedded player (no API key; videos must be Public).
- `stream_views`: stream_id, user_id, viewed_on (date). One per person per stream per day; users insert their own,
  only admin/staff read (viewership stats for Module 6).
- `matches` is in the `supabase_realtime` publication: the watch page scoreboard updates without refreshing.

Database functions: `get_my_role()`, `current_user_role()` (older alias), `search_players(game_id, search)`,
`get_team_roster(team_id)` (name, IGN, in-game role), `delete_own_account()`, `admin_delete_user(target)`, `generate_bracket(tournament_id)`. Business rules (roster size, registration checks)
are enforced by triggers with readable error messages.

## Modules (from the business case)
1. Account Management: done. Registration, login, role-based access.
2. Registration and Tournament Management: done. Player registration, team registration,
   profile and in-game details (IGN, game, role), tournament scheduling, brackets.
3. Event Information and Announcements: done. Event info, announcements, match schedule updates.
4. Live Streaming: in progress. Staff configure Facebook Live URLs; audience watches embedded streams.
5. Feedback and Sentiment Analysis: audience submits feedback and ratings; Gemini classifies sentiment.
6. Administrative Reports: analytics and engagement reports with Chart.js.
The business case also lists a "Database Module". It is not a separate module: each module adds its own
tables and migrations (see Current schema).

After all 6 modules: restyle every page with Tailwind CSS (many pages still use inline styles).

Supported games: MLBB, Valorant, Tekken 8, League of Legends, CODM.

## How to work
- Work on one module at a time. Don't change files outside the current module unless asked.
- For anything bigger than a small fix, show a plan (files to create or change, plus SQL) and wait for approval.
- After changes, run `npm run lint` and `npm run build` and fix the errors.
- This is a student project. Keep code simple and readable, avoid unnecessary libraries, and comment
  any logic that isn't obvious.
- At the end, summarize what changed and list any SQL migrations I need to run.
