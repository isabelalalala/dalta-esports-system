# DALTA Esports — Tournament Management System

Capstone system for DALTA Esports (UPHSD Molino) and the AcadArena South Luzon Esports
Conference (SLEC). Full title: *"DALTA Esports: Tournament Management System with
AI-Powered Feedback Sentiment Analytics"*.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Supabase (auth, Postgres + RLS, Realtime, Storage, Vault, pg_cron)
- Google Gemini (feedback sentiment), Facebook Live embeds, Chart.js (reports)
- Deployed on Railway. Detailed architecture/rules: `CLAUDE.md`, requirements: `docs/`.

## Prerequisites

- **Node.js ≥ 20.9** (Next.js 16 requirement — set this on your host; Railway Nixpacks
  defaults to Node 18, which cannot build this project)
- A Supabase project

## Environment variables

Create `.env.local` (git-ignored):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for browser) |
| `GEMINI_API_KEY` | Server-only. Free key from Google AI Studio. Without it, feedback is saved but stays "pending analysis" |
| `GEMINI_MODEL` | Optional, defaults to `gemini-3.5-flash-lite` |
| `FEEDBACK_SERVER_KEY` | Server-only. Must equal the Vault secret `feedback_server_key` (see `supabase/migrations/202610181000_feedback_protection.sql`) |
| `NEXT_PUBLIC_SITE_URL` | Public app URL, e.g. `https://<app>.up.railway.app` — used for OG images, shared links, calendar files. Defaults to `http://localhost:3000` |

The two `NEXT_PUBLIC_*` Supabase vars are **required at both build time and runtime** —
a missing URL/key crashes every route and fails `next build` during prerender.

## Database setup (important)

The three base tables — `profiles`, `tournaments`, `tournament_registrations` — were
created by hand and are **not** in any migration file. On a fresh Supabase project you
must recreate them (plus their RLS policies) in the SQL Editor *before* running
migrations; the very first migration (`202610151200`) already alters them.

Then, in order:

1. Run all files in `supabase/migrations/` in filename order, in the Supabase SQL
   Editor (there is no `supabase/config.toml`; migrations are not pushed via CLI).
2. **Before `202610171400_match_checkin.sql`**: enable the `pg_cron` extension
   (Database → Extensions), or that migration fails.
3. After `202610181000_feedback_protection.sql`: create the Vault secret
   `feedback_server_key` with the same value as `FEEDBACK_SERVER_KEY` — steps are at
   the top of that file.

## Supabase dashboard settings

- **Authentication → URL Configuration**: Site URL = your app URL; add
  `http://localhost:3000/**` and your Railway domain `/**` to Redirect URLs.
- **Email → "Confirm email" ON**, minimum password length 8.
- **Custom SMTP**: the built-in sender only allows a few emails/hour — required for
  demos/production.
- **Reset Password email template**: change the link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
  so reset links work on any device/browser.
- **First admin**: after your first sign-up, promote it in the SQL Editor:
  `update public.profiles set role = 'admin' where email = 'you@example.com';`

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
