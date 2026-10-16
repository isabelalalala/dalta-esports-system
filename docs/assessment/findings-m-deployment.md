# Findings — M: Deployment and runtime readiness

## Verdict

Deployable on Railway but **not turnkey**: the two repo-level blockers are both resolved (Node now pinned via `.nvmrc` + `engines`; base tables via `202610151100_base_schema.sql`) — what remains is several dashboard-only prerequisites (pg_cron before `202610171400`, Vault secret, SMTP, auth redirect URLs) that are documented but must be executed manually and in order.

## Checked

**Build/runtime config** (`package.json`, `next.config.ts`, `tsconfig.json`, `.gitignore`, `proxy.ts`, all 25 migration files, all `process.env` sites, all `app/api/*` routes, error boundaries, metadata exports).

### Env-var table

| Var | Used where | Missing = |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `proxy.ts:29`, `utils/supabase/server.ts:10`, `client.ts:8`, `public.ts:8`, `signup-client.ts:12`, `utils/site.ts:119` (public bucket URL) | **Crash.** `createServerClient`/`createClient` throw at construction on a missing URL; `proxy.ts` runs on every matched request → whole site 500s (before any error boundary can render). Also inlined at build time → must exist before `next build`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same files as above | Same crash. |
| `NEXT_PUBLIC_SITE_URL` | `utils/site-url.ts:4` → `app/layout.tsx:27` (`metadataBase`), `utils/ics.ts:89` (ICS links), `site-url.ts:21` (`webcal://`) | **Degrade.** Falls back to `http://localhost:3000` → OG/canonical URLs, calendar links point at localhost. Inlined at build → changing it on Railway requires a rebuild. |
| `GEMINI_API_KEY` | `utils/gemini.ts:45` | **Degrade.** Throws a clear error (`gemini.ts:47`), caught in `feedback-analysis.ts:51–53` → feedback saved, stays "pending" with reason. Verified. |
| `GEMINI_MODEL` | `utils/gemini.ts:49` | Optional — defaults to `gemini-3.5-flash-lite`. |
| `FEEDBACK_SERVER_KEY` | `utils/feedback-analysis.ts:27` | **Degrade.** Early return `pendingReason: 'FEEDBACK_SERVER_KEY is not set on the server.'` (:30) → feedback stays pending. Verified. |

Auth redirects do **not** depend on `NEXT_PUBLIC_SITE_URL` — they use `window.location.origin` (`utils/auth.ts:8`, `forgot-password/page.tsx:24`, `admin/users/page.tsx:322`), so they are domain-agnostic on Railway.

### Deploy-dependency table

| Dependency | Where | Missing = |
|---|---|---|
| `match-proofs` bucket (private) | **Created by migration** `202610171500_match_results.sql:75–80` (idempotent `on conflict do update`) + storage policies `:82–98` | none — automated, no dashboard step |
| `site-images` bucket (public) | **Created by migration** `202610171600_public_website.sql:201–206` + policies `:208–231` | none — automated |
| Vault secret `feedback_server_key` | manual `vault.create_secret(...)`, header `202610181000:13–19`; checked by `feedback_server_key_ok` `:158–169` | `claim_gemini_call` raises `:188–189` → RPC error → stored as `pendingReason` (silent pending). If `vault` schema/ext absent the function errors at call → same pending path. Degrades, not crash. |
| pg_cron extension + job `dalta-checkin-open-notifications` | `202610171400:328–332`, inside `begin;`(:13)…`commit;`(:388); prerequisite noted only in comment `:327` | **Whole migration file rolls back** if pg_cron isn't enabled first (fresh project can't pass `202610171400`). If the job is later dropped → `checkin_open` notifications silently never send. |
| `supabase_realtime` publication | guarded `do` blocks (`202610171400:49–57`, `…1200:55–63`, `…1500:143–151`, `…2100:109–117`) | exists by default on Supabase; would error only off-platform |
| ~~Base tables `profiles`, `tournaments`, `tournament_registrations`~~ | **RESOLVED** — created by `202610151100_base_schema.sql` (idempotent `if not exists`) | none — automated |
| `handle_new_user` trigger on `auth.users` | recreated in `202610161200:112–114` (old triggers dropped `:95–110`) + backfill `:117` | covered by migrations — no base trigger needed |
| Supabase Auth URL config (Site URL, redirect allowlist) | dashboard only; documented in CLAUDE.md | email confirm/reset links point at wrong domain or get rejected |
| SMTP for auth emails | dashboard only; CLAUDE.md notes built-in sender allows only a few emails/hr | sign-up/reset emails unreliable in a demo |
| Recovery email template edit | dashboard only; CLAUDE.md | reset links work only in the requesting browser |
| First admin promotion (`update profiles set role='admin'`) | SQL Editor; CLAUDE.md | no admin exists → admin functions unreachable |
| Retention jobs `purge_old_activity_logs()` / `purge_old_notifications()` | manual SQL Editor; CLAUDE.md:227,243 | logs grow past stated retention (privacy-notice claims) |

## Findings

**Critical:**

1. ~~**Fresh Supabase project cannot run this repo end-to-end.**~~ **RESOLVED** — `supabase/migrations/202610151100_base_schema.sql` now creates the three base tables (`profiles`, `tournaments`, `tournament_registrations`) ahead of every migration; `if not exists` makes it a no-op on existing databases. Original finding: no `CREATE TABLE` anywhere; the first migration died at `202610151200:44` (`language sql` function selecting `public.profiles`, validated at CREATE under `check_function_bodies`, inside `begin;`/`commit;` → full rollback). *(Core fact also recorded in findings-a.)*

2. ~~**No Node.js version pin — Railway Nixpacks will install Node 18, which cannot build Next 16.**~~ **RESOLVED** — `"engines": {"node": ">=20.9.0"}` added to `package.json` and `.nvmrc` pins 22. Original finding: no pin anywhere, Nixpacks' `DEFAULT_NODE_VERSION` is 18, Next 16 requires ≥20.9 — build would have failed on the Nixpacks builder (survives only under Railpack, which defaults to Node 22).

**Required:**

3. **pg_cron must be enabled before migration `202610171400`** — `cron.schedule` (`:328–332`) runs inside the file's single transaction; without the extension the entire check-in migration rolls back. The requirement exists only as a SQL comment (`:327`) — a one-line pre-flight checklist item.

4. **`NEXT_PUBLIC_*` vars are inlined at build time.** They must be set on Railway *before* `next build` runs; a later change to `NEXT_PUBLIC_SITE_URL` (e.g. assigning a custom domain) silently keeps the old value until rebuild (`utils/site-url.ts:4`, `app/layout.tsx:27`).

5. **Missing Supabase env = total outage, not degradation.** `createServerClient` in `proxy.ts:28–30` runs per request on the matcher (`:69` — everything except static assets); a missing URL/key throws at client construction → 500 on every route, bypassing `error.tsx`/`global-error.tsx` (proxy fails before the React tree renders). No guard exists. **Verified at runtime:** `next dev` with no env returns 500 on `/`, `/tournaments`, `/auth/login` — all throwing `"Your project's URL and Key are required"` at `proxy.ts:28`. `npm run build` also fails at prerender on the same throw from `utils/supabase/public.ts:7` (empirically confirming the FYI below).

**Nit:**

6. ~~**No `.env.example`**~~ — **resolved:** `.env.example` added, mirroring the README env table with the build-time/Vault caveats inline. `.gitignore:34` correctly covers `.env*`; no committed secrets found (only doc mentions and package-lock hashes).

7. **No `robots.txt`/`robots.ts`, `sitemap.xml`/`sitemap.ts`, or `manifest`** for the public site. `app/favicon.ico` and `public/daltaesportslogo.jpg` exist; OG images are generated via `opengraph-image.tsx` + `utils/og-card.tsx` (node `next/og`).

8. **No security headers/CSP** — verified: `next.config.ts:3–18` contains only `experimental.agentFeedback`, `cacheComponents`, `partialPrefetching`, turbopack CSS rules. No `headers()` at all (exports route sets its own `Cache-Control: no-store` correctly, `app/api/exports/[type]/route.ts:57`). *(Also recorded in findings-e.)*

9. **`images.remotePatterns` absent — but correct as-is:** every `<Image>` uses `unoptimized` (13 sites, e.g. `components/site/SiteParts.tsx:51`, `ResultSection.tsx:191`), so remote Supabase/Facebook-hosted URLs bypass the optimizer; no config needed. *(Performance impact assessed in findings-k Required 3.)*

10. **`output: 'standalone'` not set** — fine here since Railway keeps `node_modules` and runs `npm start` → `next start` (`package.json:8`); standalone would only matter for Docker slimming.

11. **No health-check route** — `app/api/` has only `exports/[type]` and `feedback*`; Railway health checks can point at `/` (works). `next start` binds `0.0.0.0` and honors `$PORT` — Railway-compatible by default.

12. **`proxy.ts` session handling is deploy-correct** — cookies are host-only (no `Domain`), correct on `*.up.railway.app` (a public suffix anyway); refreshed cookies are propagated to redirect responses (`:57–61`). Supabase-down behavior: `auth.getUser()` returns `{error}` → `user=null` → protected routes redirect to login rather than crash; public `'use cache'` readers fall back to defaults/empty by design (`utils/site-data.ts:5–6`, `:22–23`); client pages surface errors via `getErrorMessage`/`PageError` (`dashboard/page.tsx:117`, `tournaments/page.tsx:53`). Mostly graceful; the env-missing path above is the only white-screen risk.

13. **No `supabase/config.toml`** — migrations can't be `supabase db push`ed; they are run manually in the SQL Editor per CLAUDE.md. Filename ordering is the only sequencing guarantee.

14. ~~**README is create-next-app boilerplate**~~ — **resolved:** README rewritten with real setup instructions (env table, base-tables caveat, migration order, pg_cron/Vault/SMTP/redirect config, Railway notes). *(Was findings-n Critical 1.)*

15. **`npm audit`: 5 high-severity vulnerabilities** — all transitive dev-deps (`braces`/`micromatch`/`fast-glob` inside `eslint-config-next`→`@next/eslint-plugin-next`; GHSA-vfj7-8cjw-p6xm stack-exhaustion DoS in lint tooling). Not shipped to production, but flag for dependency hygiene. `npm audit fix --force` would break eslint-config-next (downgrades to v14) — needs a proper version bump, not autofix.

16. **`alter publication` guards check table membership, not publication existence** (`202610171400:51–56` pattern) — safe on Supabase (publication always exists), would error on self-hosted Postgres. FYI only.

17. Unused boilerplate assets in `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) — cosmetic.

**FYI:** error coverage is complete — `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` all branded with Next 16's `error`/`retry` props; server code returns `{error}` objects rather than throwing; `auth/callback` deliberately swallows exchange failures (`route.ts:30–32`). `cacheComponents: true` prerenders `'use cache'` site data at build; with Supabase env present but DB unreachable it degrades to `DEFAULT_SITE_CONTENT` (`site-data.ts:23`) — build survives; with env absent it **fails at prerender** (verified: `npm run build` exits 1 on `supabaseUrl is required` at `utils/supabase/public.ts:7` during `/matches/[id]` + `/analytics` prerender — same crash class as finding 5).

## Unverifiable locally

- Actual Railway builder in use (Nixpacks vs Railpack) and its real Node selection; whether `next build`/`next start` succeed on Railway infra.
- Live Supabase dashboard: whether Vault secret `feedback_server_key` exists and equals `FEEDBACK_SERVER_KEY`; whether pg_cron is enabled and `dalta-checkin-open-notifications` is scheduled; SMTP provider configured; Site URL / Redirect URLs; email-confirm toggle and template edits.
- Exact thrown error from `@supabase/ssr`/`supabase-js` on missing URL (no `node_modules` in repo to inspect) — direction (throw at construction → 500) is certain, message text is not.
- Whether the three base tables' live DDL matches what migrations and the app assume (no dump to compare).
- Realtime authorization enforcement on `supabase_realtime` tables at runtime.
