# DALTA Esports: Tournament Management System

Capstone system for DALTA Esports (UPHSD Molino) and the AcadArena South Luzon Esports
Conference (SLEC). Full title: *"DALTA Esports: Tournament Management System with
AI-Powered Feedback Sentiment Analytics"*.

## What it does

- **Accounts & roles**: email sign-up with student verification; admin / staff /
  player / spectator roles enforced by Postgres RLS
- **Tournaments**: registration and approval, single-elimination bracket
  generation (byes, winner auto-advance), scheduling, check-in, results with
  screenshot proofs and dispute/review flow
- **Event info**: announcements, schedule, live/upcoming/finished match listings
- **Streaming**: Facebook Live embeds, watch pages, "watching now" presence,
  per-day view counts
- **Feedback**: 1–5 star ratings + comments, Google Gemini sentiment
  classification with topics, retry-safe backlog
- **Analytics**: activity/sentiment/engagement reports, Chart.js dashboards,
  CSV/XLSX exports, Pick'em audience predictions
- **Public website**: cached public pages (teams, posts, results), OG images,
  calendar (.ics/webcal) downloads

## Glossary (one name per thing)

The app calls each thing by one name in the menu, page title, breadcrumb, browser tab and
dashboard shortcut. The names and icons live in `NAV_ITEMS` (`utils/navigation.ts`) and
`NAV_ICONS` (`components/nav-icons.ts`); the dashboard cards, footer and breadcrumbs read them from
there. Use these words in new screens, help text and messages.

| Term | Means | Icon |
|------|-------|------|
| **Home** | The public homepage (`/`). Visitors' first menu item; logged-in users reach it through the logo or More. | house |
| **Dashboard** | Your logged-in start page (`/dashboard`). First bottom-bar tab and first breadcrumb for every logged-in role. | grid |
| **Tournament** | A competition run in the app: teams register, get approved, play a bracket (`/tournaments`). | trophy |
| **Event** | Something the org announces on the public site (`/events`): a game night, a LAN, a launch. It can link to a tournament but has no bracket or registration of its own. | calendar |
| **Live Streams** | Facebook Live matches (`/live`). The bottom bar shortens it to "Live"; buttons on a live stream say "Watch". | TV |
| **Schedule & Results** | Every upcoming, live and finished match (`/schedule`). "My Matches" is only the dashboard box with your own team's matches. | calendar + clock |
| **Teams** / **My Teams** | All teams (`/teams?tab=all`) / the teams you are on, with invites and join requests (`/teams?tab=mine`). | users / shield |
| **Team Management** | The organizers' list of teams with Remove (`/admin/teams`). | users |
| **Match Control** | Organizers' match overview: check-ins, results, forfeits (`/matches`). A tournament's own match list is "Matches". | crossed swords |
| **Feedback** | Ratings and comments anyone can send (`/feedback`). Organizers read them in **Feedback & Sentiment** (`/admin/feedback`). | message / brain |
| **Reports** / **Engagement Stats** | Admin reports (`/analytics`) / viewer and audience numbers (`/analytics/engagement`). | column chart / line chart |
| **Users** | Admins' account list (`/admin/users`). | user + gear |
| **My Profile** | Your name, picture, game profiles and student details (`/profile`). | user circle |
| **Log in / Log out / Sign up** | Account actions. Never "Sign in", "Sign out" or "Register" for accounts. | — |
| **Register** | Only for signing a team up for a tournament ("Register Team", "My Registrations"). | clipboard |

Casing: menu items, buttons, badges and titles are shown in capitals by CSS; write them in Title
Case in code ("My Teams") and sentence case for body text. The one exception is the phone bottom
bar: sentence case at 11px, so "Dashboard" fits at 360px without an ellipsis. Dates are "Nov 9, 2026 · 7:00 PM" in
Philippine time (`formatDateTime()` / `formatMomentDate()` in `utils/tournaments.ts`); never the
browser's locale.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Supabase (auth, Postgres + RLS, Realtime, Storage, Vault, pg_cron)
- Google Gemini (feedback sentiment), Facebook Live embeds, Chart.js (reports)
- Deployed on Vercel; auth emails sent through Brevo (SMTP). Detailed architecture/rules: `CLAUDE.md`, requirements: `docs/`.

## Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | ≥ 20.9 (repo pins 22 LTS via `.nvmrc`) | running/building the app (Next.js 16 requires it; `nvm use` picks the pin automatically) |
| npm | bundled with Node | installs dependencies |
| Supabase account | free tier is fine | the whole backend (auth, DB, storage, realtime) |
| Google AI Studio key | free | only for Gemini sentiment: the app works without it (feedback stays "pending analysis") |
| Docker Desktop | any recent | **only** for `npm run db:test` / `db:types` (the local Supabase stack + pgTAP); not needed to run the app |

## Setup: step by step

**1. Clone and install.**

```bash
git clone <repo-url>
cd dalta-esports-system
npm install
```

**2. Create a Supabase project** (any region).

**3. Run the migrations.** In the Supabase SQL Editor, run every file in
`supabase/migrations/` in filename order (`202610151100` … `202611092000`). The
first file, `202610151100_base_schema.sql`, creates the three base tables the rest
build on. Everything is automatic from here, including pg_cron (the check-in
migration installs the extension itself). Migrations are run manually, not pushed
via CLI (`supabase/config.toml` exists only for the local test stack).

**4. Create the Vault secret.** Run `vault.create_secret` to add `feedback_server_key`.
The exact steps are at the top of `supabase/migrations/202610181000_feedback_protection.sql`.
Its value must equal `FEEDBACK_SERVER_KEY` below. Without it, feedback is saved but
sentiment stays "pending analysis".

**5. Configure Authentication** (Supabase dashboard):

- URL Configuration → Site URL = `http://localhost:3000`; Redirect URLs: add
  `http://localhost:3000/**` (and later your Vercel domain `/**`)
- Email → keep "Confirm email" ON, minimum password length 10, password requirements:
  lowercase, uppercase, digits and symbols (the app checks the same rules)
- Email templates → Reset Password: change the link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
  so reset links work on any device
- Custom SMTP (Brevo): the built-in sender allows only a few emails per hour for the
  whole project, so a handful of people registering at once fails with "email rate
  limit exceeded". See "Email (Brevo SMTP)" below.
- Multi-Factor → TOTP: keep it enabled (it is by default). Organizers can then turn on
  two-factor authentication on My Profile.
- Password security → "Prevent use of leaked passwords": turn it on if your plan offers it
  (it may need a paid plan; the app's own checks still block common passwords).
- Hooks → Custom Access Token: switch on `custom_access_token_hook` so banned accounts can't
  log in (see `202611081500_comments_moderation.sql`).

**6. Create `.env` in the repository root** (the same folder as
`package.json` / `next.config.ts`). Next.js only loads env files from the project
root; a file in a parent folder or your home directory is silently ignored. It is
git-ignored, so it will not show up in `git status`. Check for it with
`ls .env` if unsure. Copy `.env.example` and fill in the values:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for the browser) |
| `GEMINI_API_KEY` | Server-only, free key from Google AI Studio. Without it, feedback stays "pending analysis" |
| `GEMINI_MODEL` | Optional, defaults to `gemini-3.5-flash-lite` |
| `FEEDBACK_SERVER_KEY` | Server-only, must equal the Vault secret from step 4 |
| `CRON_SECRET` | Server-only, any long random string (`openssl rand -hex 32`). Protects `/api/cron/moderation`; Vercel Cron sends it automatically |
| `NEXT_PUBLIC_SITE_URL` | Public app URL, e.g. `https://<app>.vercel.app`: OG images, shared links, calendar files. Falls back to Vercel's production domain, then `http://localhost:3000` |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` / `NEXT_PUBLIC_PRIVACY_CONTACT_PERSON` | Data-privacy contact shown on `/privacy` (placeholder fallback until set) |

The two `NEXT_PUBLIC_*` Supabase vars are **required at both build time and runtime**:
a missing URL/key crashes every route and fails `next build` during prerender.

**7. Start the app.**

```bash
npm run dev    # http://localhost:3000
```

**8. Create the first admin.** Sign up through `/auth/register`, confirm the email,
then promote the account in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

**9. Smoke-check.** Log in, open `/dashboard` (accept the privacy consent), create a
tournament, and submit a test feedback entry at `/feedback`. It should appear under
`/admin/feedback` (as "pending analysis" until Gemini is configured and classified).

## Commands

```bash
npm run dev    # dev server: http://localhost:3000
npm run build  # production build (needs the env vars above)
npm start      # production server
npm run lint   # eslint
npm test       # vitest (utils/*.test.ts)
npm run db:test   # pgTAP tests: needs Docker + `npx supabase start` first
npm run db:types  # regenerate utils/database.types.ts from the local schema
```

## Project structure

```
.agents/skills/   agent skills shared with everyone (AI-assistant workflows)
app/              Next.js App Router: pages, layouts, route handlers
  (site)/         public cached pages (home, teams, posts, public tournament view)
  admin/          organizer pages (users, feedback, verification, website editor)
  api/            route handlers (feedback classify, exports)
  auth/           login/register/reset + /auth/callback
components/       shared React components
utils/            pure helpers (the Vitest-covered layer) + supabase clients
supabase/
  migrations/     ordered SQL files: the whole schema + RLS + functions
  tests/          pgTAP files run by `npm run db:test`
docs/             requirements, UML, and the full system assessment (docs/assessment/)
proxy.ts          Next.js 16 middleware: session refresh, auth + privacy-consent gates
```

## Agent skills (for AI-assisted development)

The repo ships reusable **agent skills** under `.agents/skills/`, the vendor-neutral
location read by Devin, Cursor, VS Code Open Plugin hosts, and other AI coding tools.
Each folder is a self-contained skill (`SKILL.md` + supporting files); tools list them
automatically, or invoke one by name (e.g. `/ponytail`).

| Skill | Use it for |
|---|---|
| `using-agent-skills` | meta-skill (picks the right skill for the task) |
| `ponytail` | smallest-diff, no-over-engineering implementation mode |
| `code-review-and-quality` | multi-axis review before merging |
| `browser-testing-with-devtools` | real-browser checks via Chrome DevTools MCP |
| `webapp-testing` | Playwright-driven testing of the running app |
| `tdd` | test-first feature/bug work |
| `debugging-and-error-recovery` | systematic root-cause debugging |
| `git-workflow-and-versioning` | branching, atomic commits, PRs, releases |
| `security-review` | OWASP-style vulnerability review |
| `spec-driven-development` | spec/PRD before a large feature |
| `documentation-and-adrs` | record decisions, write docs |

To add another skill, drop a folder with a `SKILL.md` into `.agents/skills/`, or keep
it personal by installing it in your user-level skills dir instead of committing it.
Journeys for the testing skills above: `docs/browser-test-journeys.md`.

## Deploying with Docker (any host)

`Dockerfile` builds a minimal standalone image (`output: 'standalone'` in
`next.config.ts`) — the app only; Supabase stays hosted, so there is no DB service.

```bash
# one image per environment: NEXT_PUBLIC_* are baked in at build time
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.example \
  -t dalta-esports .

docker run -p 3000:3000 \
  -e GEMINI_API_KEY=... -e FEEDBACK_SERVER_KEY=... \
  dalta-esports
```

Or with compose — it reads the same `.env` automatically:

```bash
docker compose up --build   # serves http://localhost:3000
```

Works on any container host: Render, Fly.io, Railway, Cloud Run,
DigitalOcean, a VPS with Coolify/Dokploy, or plain Docker. Remember `NEXT_PUBLIC_*`
changes need a rebuild; `GEMINI_API_KEY`/`FEEDBACK_SERVER_KEY` are runtime env vars.

## Deploying (Vercel)

1. **Import the repo:** vercel.com → Add New → Project → import the GitHub repository.
   The framework is detected as Next.js; keep the default build command and output.
2. **Environment variables** (Project → Settings → Environment Variables, for
   Production and Preview): every variable from the table above. `NEXT_PUBLIC_*`
   values are built into the app, so **redeploy** after changing them.
   `NEXT_PUBLIC_SITE_URL` = your production URL, e.g. `https://dalta-esports.vercel.app`.
3. **Node version:** Settings → Build and Deployment → Node.js Version = 22.x
   (matches `.nvmrc` and `engines`).
4. **Function region:** Settings → Functions → Function Region = the region closest to
   your Supabase project (Supabase → Project Settings → General shows it; e.g.
   Singapore → `sin1`). Every page talks to Supabase, so this matters for speed.
5. **Supabase auth URLs:** Authentication → URL Configuration → Site URL = the Vercel
   URL; Redirect URLs: add `https://<your-app>.vercel.app/**` (keep the localhost one).
   Preview deployments get other URLs; add `https://*-<your-team>.vercel.app/**` if you
   want email links to work on previews too.
6. Deploy, then register a test account to check that the confirmation email arrives.

7. **Daily retry of "pending analysis":** `vercel.json` schedules `GET /api/cron/moderation`
   once a day (00:00 UTC = 8:00 PH; the free Hobby plan allows one run a day, Pro can use
   e.g. `0 * * * *`). It needs `CRON_SECRET` set in Vercel and the migration
   `202611091300_cron_moderation`. Check it under Project → Settings → Cron Jobs.

The full launch checklist (settings, migrations, cleanup, domain, smoke tests per role on laptop
and phone) is in [`docs/deployment-checklist.md`](docs/deployment-checklist.md).

### How deploys work
- **Push to `main` = production.** Every push to another branch (or a pull request) gets a
  Preview URL. Previews use the same environment variables you give the Preview environment,
  so they talk to the real Supabase project unless you point them at a test project.
- **Roll back the app:** Vercel → Deployments → pick the last good deployment → ⋯ → **Instant Rollback**
  (or "Promote to Production"). This only rolls back the app; database migrations are not undone.
- **Roll back the database:** migrations have no automatic "down" step. Restore the backup you
  took before running it (Supabase → Database → Backups → Restore, or `psql` with your dump), then
  roll the app back to the deployment that matches. Small mistakes can also be fixed forward with a
  new migration. Every migration is wrapped in `begin; … commit;`, so a failed run changes nothing.
- **Before running a migration in production:** take a backup (Supabase → Database → Backups;
  daily backups are included on paid plans; on the free plan export with
  `supabase db dump` or Project Settings → "Download backup").
- **Security headers** (CSP, HSTS, nosniff, frame protection) are set in `next.config.ts`.
  A new outside service the BROWSER talks to (a new embed, CDN or API) must be added to the CSP there.
- After a deploy, check Vercel → Logs for errors while clicking through the main pages.

The API routes set `maxDuration` (feedback/comments/reports 40 s, exports 60 s) because Vercel can stop
a function after 10 s on the free plan and Gemini can take up to 15 s.
`output: 'standalone'` in `next.config.ts` is only used outside Vercel (Docker).

## Email (Brevo SMTP)

Supabase sends the sign-up confirmation and password reset emails. Its built-in sender
allows only a few emails per hour for the whole project; Brevo's free plan allows about
300 per day.

1. **Brevo account:** sign up at brevo.com (free plan).
2. **Sender:** Brevo → Senders, Domains & Dedicated IPs → Senders → Add a sender, e.g.
   `DALTA Esports` / `daltaesports@gmail.com`, then click the link Brevo emails you.
   (Optional, better delivery: verify your own domain under Domains, with the SPF/DKIM
   records Brevo gives you.)
3. **SMTP key:** Brevo → SMTP & API → SMTP tab → Generate a new SMTP key. Note the
   server `smtp-relay.brevo.com`, port `587`, and the **login** shown there (it is
   not your Brevo email address).
4. **Supabase:** Authentication → Emails → SMTP Settings → Enable custom SMTP:
   - Sender email = the verified sender from step 2; Sender name = `DALTA Esports`
   - Host = `smtp-relay.brevo.com`, Port = `587`
   - Username = the SMTP login from step 3; Password = the SMTP key
   - Save.
5. **Rate limits:** Authentication → Rate Limits (editable once custom SMTP is on):
   - Rate limit for sending emails: e.g. `100` per hour (stay under Brevo's daily cap).
   - Rate limit for sign-ups and sign-ins: everyone on campus Wi-Fi shares one IP
     address, so raise it before a registration event (e.g. `150` per 5 minutes).
6. **Per-address gap:** Authentication → Providers → Email: keep the minimum interval
   between emails to one address at 60 seconds (the app's "Resend" buttons wait the same).
7. **Test:** register a throwaway account and check the email arrives (also check spam).
   Brevo → Transactional → Logs shows every email it sent or rejected.

The Privacy Notice already lists Brevo and Vercel (version `2026-11-01`).

## Troubleshooting

- **Every page 500s / `next build` fails with "URL and Key are required"**:
  `.env` is missing or in the wrong folder; it must sit next to `package.json`.
- **Migration fails at `cron.schedule`**: pg_cron is missing; the migration
  installs it itself since `202610171400`, but on very old snapshots enable it via
  Database → Extensions.
- **Sentiment stuck on "pending analysis"**: `FEEDBACK_SERVER_KEY` doesn't match
  the Vault secret, or `GEMINI_API_KEY` is missing.
- **Reset/confirmation emails don't arrive, or "email rate limit exceeded"**: the
  built-in sender is rate-limited; set up Brevo SMTP and raise the limit (see above).
  If Brevo is set up, check Brevo → Transactional → Logs and that the sender is verified. Reset links only work in the requesting browser unless the
  template is updated (step 5).
- **Asked to accept the privacy notice repeatedly**: `PRIVACY_NOTICE_VERSION` in
  `utils/privacy.ts` was bumped; every account must re-consent by design.

## Notes

- Privacy notice: `/privacy` is public; consent versioning lives in `utils/privacy.ts`.
- Schema changes go in new migration files under `supabase/migrations/`: never edit
  applied ones, and every new table needs RLS + policies in the same file.
- CI (`.github/workflows/test.yml`) runs typecheck + lint + vitest on every push and
  the pgTAP suite + generated-types drift check against a local Supabase stack.
