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

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Supabase (auth, Postgres + RLS, Realtime, Storage, Vault, pg_cron)
- Google Gemini (feedback sentiment), Facebook Live embeds, Chart.js (reports)
- Deployed on Railway. Detailed architecture/rules: `CLAUDE.md`, requirements: `docs/`.

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
`supabase/migrations/` in filename order (`202610151100` … `202610181800`). The
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
  `http://localhost:3000/**` (and later your Railway domain `/**`)
- Email → keep "Confirm email" ON, minimum password length 8
- Email templates → Reset Password: change the link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
  so reset links work on any device
- Custom SMTP: the built-in sender allows only a few emails/hour; needed for demos

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
| `NEXT_PUBLIC_SITE_URL` | Public app URL, e.g. `https://<app>.up.railway.app`: OG images, shared links, calendar files. Defaults to `http://localhost:3000` |
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

Works on any container host: Railway (Dockerfile deploy), Render, Fly.io, Cloud Run,
DigitalOcean, a VPS with Coolify/Dokploy, or plain Docker. Remember `NEXT_PUBLIC_*`
changes need a rebuild; `GEMINI_API_KEY`/`FEEDBACK_SERVER_KEY` are runtime env vars.

## Deploying (Railway)

Set all env vars in Railway **before** the first build. `NEXT_PUBLIC_*` values are
inlined at build time, so changing `NEXT_PUBLIC_SITE_URL` later requires a rebuild.
Node is pinned to 22 LTS via `.nvmrc` and `engines` in `package.json`. No extra
builder config needed. Apply the same dashboard steps (migrations, Vault secret,
auth URLs with your Railway domain, SMTP).

## Troubleshooting

- **Every page 500s / `next build` fails with "URL and Key are required"**:
  `.env` is missing or in the wrong folder; it must sit next to `package.json`.
- **Migration fails at `cron.schedule`**: pg_cron is missing; the migration
  installs it itself since `202610171400`, but on very old snapshots enable it via
  Database → Extensions.
- **Sentiment stuck on "pending analysis"**: `FEEDBACK_SERVER_KEY` doesn't match
  the Vault secret, or `GEMINI_API_KEY` is missing.
- **Reset/confirmation emails don't arrive**: the built-in sender is rate-limited;
  configure custom SMTP. Reset links only work in the requesting browser unless the
  template is updated (step 5).
- **Asked to accept the privacy notice repeatedly**: `PRIVACY_NOTICE_VERSION` in
  `utils/privacy.ts` was bumped; every account must re-consent by design.

## Notes

- Privacy notice: `/privacy` is public; consent versioning lives in `utils/privacy.ts`.
- Schema changes go in new migration files under `supabase/migrations/`: never edit
  applied ones, and every new table needs RLS + policies in the same file.
- CI (`.github/workflows/test.yml`) runs typecheck + lint + vitest on every push and
  the pgTAP suite + generated-types drift check against a local Supabase stack.
