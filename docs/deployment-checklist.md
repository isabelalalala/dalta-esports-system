# Deployment checklist (Vercel + Supabase)

Do these in order. Tick each box. Nothing here runs automatically.

## 0. Before you start
- [ ] Back up the database: Supabase → Database → Backups (paid plans), or Project Settings →
      "Download backup" / `supabase db dump` (free plan). Keep the file until launch is done.
- [ ] Locally: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all pass.
- [ ] Push to `main` (production) only after the checks pass; the `test` GitHub Action must be green
      (`test / app` and `test / db`).

## 1. Supabase: database
- [ ] Run the migrations you haven't run yet, **in filename order**, in the SQL Editor
      (`supabase/migrations/`, oldest first). Each file is one transaction: if it fails, nothing
      changed; fix the cause and run it again. Current last file: `202611092000_announcements_feed.sql`.
- [ ] One-time Vault setup for the feedback/moderation key, if not done: steps at the top of
      `202610181000_feedback_protection.sql` (the secret must equal `FEEDBACK_SERVER_KEY`).
- [ ] Check the pg_cron jobs exist (SQL Editor: `select jobname, schedule from cron.job;`):
      `dalta-checkin-open-notifications`, `dalta-stream-presence-cleanup`, `dalta-publish-announcements`.
- [ ] Test-data cleanup: open `scripts/prelaunch-cleanup.sql`. Run **Part A** (read-only) and review
      every row. Edit **Part B** (delete lines for anything you want to keep), run it (it ends with
      `rollback;`, so nothing is saved), check the counts, then change the last line to `commit;` and
      run it again. Delete test accounts on `/admin/users`, test teams on `/admin/teams`.
- [ ] First admin (if this is a fresh project): register normally, confirm the email, then
      `update public.profiles set role = 'admin' where email = '...';`

## 2. Supabase: Authentication settings
- [ ] URL Configuration → **Site URL** = your production address (e.g. `https://dalta-esports.vercel.app`
      or your custom domain).
- [ ] URL Configuration → **Redirect URLs**: `https://<your-domain>/**`, `https://<project>.vercel.app/**`
      and keep `http://localhost:3000/**` for development. Optional for previews:
      `https://*-<your-team>.vercel.app/**`.
- [ ] Email → "Confirm email" **ON**; minimum password length **10**; requirements: lowercase,
      uppercase, digits and symbols.
- [ ] Password security → "Prevent use of leaked passwords" **ON** if your plan offers it.
- [ ] Multi-Factor → **TOTP enabled** (default) so organizers can turn on 2FA.
- [ ] Hooks → **Custom Access Token** → `public.custom_access_token_hook` (blocks banned accounts at login).
- [ ] Emails → SMTP Settings: Brevo SMTP (see README "Email (Brevo SMTP)"); Rate Limits → raise
      "emails per hour" to what Brevo allows.
- [ ] Email templates → Reset Password link:
      `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`

## 3. Vercel: project settings
- [ ] Project is connected to the GitHub repo (Settings → Git). Production branch = `main`.
- [ ] Settings → Build and Deployment → Node.js Version **22.x**.
- [ ] Settings → Functions → Function Region = closest to your Supabase project (e.g. Singapore → `sin1`).
- [ ] Settings → Deployment Protection: decide whether Preview deployments need a login (Vercel
      Authentication) so test builds aren't public.

## 4. Vercel: environment variables
Project → Settings → Environment Variables. Set for **Production** (and Preview if you use previews).
`NEXT_PUBLIC_*` values are built into the app: **redeploy** after changing them.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `GEMINI_API_KEY` | Google AI Studio key (server only) |
| `GEMINI_MODEL` | optional (default `gemini-3.5-flash-lite`) |
| `FEEDBACK_SERVER_KEY` | same value as the Vault secret `feedback_server_key` |
| `CRON_SECRET` | long random string (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_SITE_URL` | production address, no trailing slash |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` | real data-privacy contact email |
| `NEXT_PUBLIC_PRIVACY_CONTACT_PERSON` | real data-privacy contact person |

Never add the Supabase service role key anywhere.

## 5. Deploy
- [ ] Deploy (push to `main` or Vercel → Deployments → Redeploy). Watch the build log: it must end
      without errors.
- [ ] Settings → Cron Jobs shows `/api/cron/moderation` (daily).

## 6. Custom domain (optional)
- [ ] Vercel → Settings → Domains → Add `yourdomain` and follow the DNS records it shows
      (A record `76.76.21.21` for the apex, CNAME `cname.vercel-dns.com` for `www`).
- [ ] When it shows "Valid", update `NEXT_PUBLIC_SITE_URL`, Supabase **Site URL** and **Redirect URLs**
      to the new domain, then **redeploy**.
- [ ] Brevo: if emails should come from your domain, verify it in Brevo (SPF/DKIM records).

## 7. Smoke test after deploy
Use a laptop **and** a phone. On the phone, also open the link from **Facebook/Messenger** (tap the
link in a chat, so it opens in the in-app browser).

**Logged out (any device)**
- [ ] Home loads; logos in Game Divisions are whole and centered; the match ticker/live strip show (if any matches).
- [ ] A shared tournament link (`/t/...`) shows a preview card when pasted in Messenger.
- [ ] Search: type 2+ letters in the header: grouped results appear.
- [ ] Help & FAQ shows only spectator/player questions.
- [ ] Announcements opens without logging in; a post's link pasted in Messenger shows a preview card.
- [ ] Phone: nothing scrolls sideways; the bottom of the page isn't hidden behind the browser's bars.

**Spectator account**
- [ ] Register (consent + terms checkboxes) → confirmation email arrives → link opens and logs in.
- [ ] Bottom nav (phone): Home, Events, Live, Teams, More, labels fully visible.
- [ ] Watch Live: the Facebook video plays (or "Watch on Facebook" appears); post a comment; report another comment.
- [ ] Notifications → turn a kind off and on again.
- [ ] Pick'em: make a pick on an upcoming match.

**Player account**
- [ ] Profile: upload a profile picture (also from the Messenger browser); add a game profile.
- [ ] Teams: create a team, add a logo, set "Looking for", turn on recruiting; All teams shows the card.
- [ ] From a second player: Request to join → captain accepts.
- [ ] Register the team for a tournament → My Registrations shows Pending with steps.

**Staff account**
- [ ] Profile: turn on two-factor authentication; log out and in again → code asked → works.
- [ ] Match Control: set a time, go live, enter a result; the bracket updates live on another device.
- [ ] Moderation → Reported: the reported comment is there; Keep or Remove it.
- [ ] Leave it idle 30 minutes → warning, then logged out.

**Admin account**
- [ ] Approve and reject a registration (with a reason) → the captain sees the reason.
- [ ] Post an announcement scheduled 10 minutes ahead → players don't see it; after the time they do and get notified.
- [ ] Save a draft with a cover and a match link → a logged-out window doesn't see it; publish it → it appears live
      ("1 new post") and the link card shows the match. Mark another post Urgent → the banner appears site-wide.
- [ ] Generate a report → Export PDF and Download CSV work.
- [ ] Activity log shows the actions above.
- [ ] Website editor: change a text → it shows on the public page.

If something fails: Vercel → Logs (runtime errors), Supabase → Logs (database/auth errors). To undo a
bad deploy: Vercel → Deployments → last good one → Instant Rollback.
