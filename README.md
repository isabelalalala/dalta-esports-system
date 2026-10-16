# DALTA Esports — Tournament Management System

Capstone system for DALTA Esports (UPHSD Molino) and the AcadArena South Luzon Esports
Conference (SLEC). Full title: *"DALTA Esports: Tournament Management System with
AI-Powered Feedback Sentiment Analytics"*.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Supabase (auth, Postgres + RLS, Realtime, Storage, Vault, pg_cron)
- Google Gemini (feedback sentiment), Facebook Live embeds, Chart.js (reports)
- Deployed on Railway. Detailed architecture/rules: `CLAUDE.md`, requirements: `docs/`.

## Setup — step by step

**1. Install Node.js ≥ 20.9.** Next.js 16 requires it. (Railway Nixpacks defaults to
Node 18, which cannot build this project — pin Node on the host too; see Deploying.)

**2. Clone and install.**

```bash
git clone <repo-url>
cd dalta-esports-system
npm install
```

**3. Create a Supabase project** (any region, free tier is fine).

**4. Create the three base tables.** `profiles`, `tournaments` and
`tournament_registrations` were created by hand and are **not** in any migration —
run their `CREATE TABLE` + RLS policies in the SQL Editor first (column definitions:
schema section of `CLAUDE.md`). Skipping this makes the very first migration fail.

**5. Enable `pg_cron`** — Database → Extensions → enable `pg_cron`. The check-in
migration (`202610171400`) calls `cron.schedule` and fails without it.

**6. Run the migrations.** In the Supabase SQL Editor, run every file in
`supabase/migrations/` in filename order (`202610151200` … `202610181100`). There is
no `supabase/config.toml` — migrations are run manually, not pushed via CLI.

**7. Create the Vault secret.** Run `vault.create_secret` to add `feedback_server_key`
— the exact steps are at the top of `supabase/migrations/202610181000_feedback_protection.sql`.
Its value must equal `FEEDBACK_SERVER_KEY` below. Without it, feedback is saved but
sentiment stays "pending analysis".

**8. Configure Authentication** (Supabase dashboard):

- URL Configuration → Site URL = `http://localhost:3000`; Redirect URLs: add
  `http://localhost:3000/**` (and later your Railway domain `/**`)
- Email → keep "Confirm email" ON, minimum password length 8
- Email templates → Reset Password: change the link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
  so reset links work on any device
- Custom SMTP — the built-in sender allows only a few emails/hour; needed for demos

**9. Create `.env.local`.** Copy `.env.example` and fill in the values:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — safe for the browser |
| `GEMINI_API_KEY` | Server-only, free key from Google AI Studio. Without it, feedback stays "pending analysis" |
| `GEMINI_MODEL` | Optional, defaults to `gemini-3.5-flash-lite` |
| `FEEDBACK_SERVER_KEY` | Server-only, must equal the Vault secret from step 7 |
| `NEXT_PUBLIC_SITE_URL` | Public app URL, e.g. `https://<app>.up.railway.app` — OG images, shared links, calendar files. Defaults to `http://localhost:3000` |

The two `NEXT_PUBLIC_*` Supabase vars are **required at both build time and runtime** —
a missing URL/key crashes every route and fails `next build` during prerender.

**10. Start the app.**

```bash
npm run dev    # http://localhost:3000
```

**11. Create the first admin.** Sign up through `/auth/register`, confirm the email,
then promote the account in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

**12. Smoke-check.** Log in, open `/dashboard` (accept the privacy consent), create a
tournament, and submit a test feedback entry at `/feedback` — it should appear under
`/admin/feedback` (as "pending analysis" until Gemini is configured and classified).

## Commands

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build (needs the env vars above)
npm start      # production server
npm run lint   # eslint
```

## Deploying (Railway)

Set all env vars in Railway **before** the first build — `NEXT_PUBLIC_*` values are
inlined at build time, so changing `NEXT_PUBLIC_SITE_URL` later requires a rebuild.
Pin Node to ≥ 20.9 (via `engines` in package.json or a `.nvmrc`) if your builder
defaults to Node 18.

## Notes

- Privacy notice: `/privacy` is public; consent versioning lives in `utils/privacy.ts`.
- Schema changes go in new migration files under `supabase/migrations/` — never edit
  applied ones, and every new table needs RLS + policies in the same file.
