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

## Roles (stored in `profiles.role`)
| role value | Actor in the documents |
|------------|------------------------|
| `admin`    | Organizing Committee / Administrator |
| `staff`    | Tournament Staff / Game Administrator |
| `player`   | Players |
| `spectator` | Audience / Spectator |

Enforced by a CHECK constraint on `profiles.role` (migration `202610161200_role_security`).
- Sign-up can only create `player` or `spectator`. The `handle_new_user()` trigger creates the profile.
- Only an admin, or a change run in the SQL Editor, can change a role. Promote someone with:
  `update public.profiles set role = 'admin' where email = '...';`
- RLS policies check roles with `public.get_my_role()`.

## Current schema (public)
- `profiles`: id (uuid, = auth.users.id, deleted with the auth user), email, role, full_name, updated_at.
  Created by the `handle_new_user()` trigger on sign-up.
- `games`: id (text, e.g. `mlbb`), name, min_players, max_players. Edited only in the SQL Editor.
- `tournaments`: id, name, description, game (text name, kept for older pages), game_id (→ games),
  start_date, end_date, max_participants, registration_deadline, status (`upcoming`/`active`/`completed`/`cancelled`),
  created_by (→ profiles, set null when the user is deleted), created_at, updated_at
- `teams`: id, name, game_id (→ games), captain_id (→ profiles), created_at. UNIQUE (name, game_id)
- `team_members`: id, team_id, user_id, role (`captain`/`player`), joined_at. Players join via `join_team(code)`.
- `team_join_codes`: team_id, join_code. Only the captain can read it.
- `tournament_registrations`: id, tournament_id, user_id (who registered), team_id (→ teams),
  team_name (only on old rows), status, registered_at. UNIQUE (tournament_id, team_id)
- `player_game_profiles`: id, user_id, game_id (→ games), ign, in_game_role, rank, created_at. UNIQUE (user_id, game_id)

Database functions: `get_my_role()`, `current_user_role()` (older alias), `join_team(code)`,
`get_team_roster(team_id)`, `delete_own_account()`. Business rules (roster size, registration checks)
are enforced by triggers with readable error messages.

## Modules (from the business case)
1. Account Management: done. Registration, login, role-based access.
2. Registration and Tournament Management: in progress. Player registration, team registration,
   profile and in-game details (IGN, game, role), tournament scheduling, brackets.
3. Event Information and Announcements: event info, announcements, match schedule updates.
4. Live Streaming: staff configure Facebook Live URLs; audience watches embedded streams.
5. Feedback and Sentiment Analysis: audience submits feedback and ratings; Gemini classifies sentiment.
6. Administrative Reports: analytics and engagement reports with Chart.js.
7. Database: supporting tables for all of the above.

Supported games: MLBB, Valorant, Tekken 8, League of Legends, CODM.

## How to work
- Work on one module at a time. Don't change files outside the current module unless asked.
- For anything bigger than a small fix, show a plan (files to create or change, plus SQL) and wait for approval.
- After changes, run `npm run lint` and `npm run build` and fix the errors.
- This is a student project. Keep code simple and readable, avoid unnecessary libraries, and comment
  any logic that isn't obvious.
- At the end, summarize what changed and list any SQL migrations I need to run.
