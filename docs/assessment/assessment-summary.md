# Consolidated System Assessment — DALTA Esports TMS

Full title: *"DALTA Esports: Tournament Management System with AI-Powered Feedback
Sentiment Analytics"*. Capstone for UPHSD Molino / AcadArena SLEC.

**Scope:** equal-depth audit of 15 areas (A–O) across 4 parallel-agent waves, grounded
in the repository at `docs/assessment/findings-*.md`, plus a limited runtime pass.
Static-code audit: complete. Runtime audit: build/lint/typecheck + missing-env paths
verified; interactive flows (bracket gen, check-in, predictions, live) remain
unverified — no `.env.local`, no active Supabase project in the connected account,
and the documented Railway URL `dalta-esports.up.railway.app` returns 404.

## Overall verdict

The system is **functionally complete and architecturally solid**: every documented
use case traces to code, RLS coverage is broad and correct, security hygiene is
genuinely good (no service-role usage, secrets server-side, storage policies
airtight, no XSS sinks), the Gemini pipeline degrades gracefully at every failure
point, and the docs are unusually accurate for a student project. It is **not
deploy-ready as a repo** (no Node pin, base tables not in migrations) and has real
integrity, privacy, and accessibility gaps that a panel or handover reviewer will
find.

## Critical findings

| # | Area | Finding | Evidence |
|---|------|---------|----------|
| 1 | B | **Open redirect in `/auth/callback`** — `next=/\evil.com` passes the `startsWith('/')` + `!startsWith('//')` check; WHATWG URL parsing treats `\` as a separator → off-site redirect after any email link. | `app/auth/callback/route.ts:21,33` — findings-b |
| 2 | M | ~~Fresh Supabase project cannot run this repo~~ — **RESOLVED** (`202610151100_base_schema.sql` bootstrap migration creates the three base tables). | — |
| 3 | M | **No Node.js pin** — Nixpacks defaults to Node 18; Next 16 requires ≥20.9 → Railway build fails. | `package.json` (no engines/.nvmrc) — findings-m |
| 4 | O | **Zero test infrastructure** — no test runner, no CI, no seed/harness; all tournament-integrity logic (bracket gen, winner advance, result lock, pick'em, RLS) lives in untested Postgres. Five TS functions duplicate DB rules with only a comment as contract. | `package.json`; findings-o |
| 5 | N | ~~README boilerplate~~ — **RESOLVED** (rewritten with real setup). | — |

## Required findings (condensed — details in area files)

**Data integrity & races** (C, D1, D2)
- NULL-boolean args bypass "reason required" in `review_student_verification` and
  `respond_to_match_result` (`p_approve`/`p_confirm` NULL skips the guard).
- `review_match_result` checks submission status but not `matches.status` — a stale
  submission can overwrite a forfeited/completed match.
- Bracket regeneration silently deletes unreviewed submitted results;
  `next_match_id` has no integrity checks (cross-tournament/self-feeds possible).
- One-team-per-game is racy across different teams; team name uniqueness is
  case/whitespace-sensitive; `registered_at`/`predictions.created_at` client-writable.
- `tournaments.status` nullable; `topics ≤3` no CHECK; `give_privacy_consent`
  accepts any version string; `unverified_team_members()` leaks member emails in
  exception text; approved registration vanishes if its team is deleted pre-bracket.

**Live/engagement** (G, F)
- Presence "Watching now" is spoofable: public `viewers-<id>` channel, client-supplied
  key — anyone can inflate the organizer-facing count and enumerate real viewer IDs.
- Facebook URL validation accepts `facebook.com/<anything>`; `plugins/video.php`
  can't render non-video links → validates "✓ Valid" then embeds broken.
- `analysis_attempts` never read — unclassifiable feedback retries forever, burning
  Gemini claim slots.

**Notifications & audit** (I)
- Tournament cancelled → registrants get no notification (no trigger, no type).
- Admin-deleted registration → captain never told.
- Reschedule/status edits (which wipe check-ins) leave no `activity_logs` entry;
  result submit/confirm/dispute/reject decisions only half-audited.

**Reports** (H)
- `report_activity` per-tournament team counts are unfiltered lifetime numbers next
  to date-filtered match counts — internally inconsistent rows under a date range.

**Auth/accounts** (B)
- Admin-created accounts' confirm links point at `/auth/login`, skipping
  `/auth/callback` (session never established from the link).
- `profiles.updated_at` referenced by code but maintained by no migration.

**Privacy** (L)
- DPO contact is an explicit placeholder (`utils/privacy.ts`).
- Consent gate is dashboard-only — other authenticated routes collect data without
  checking current-version consent.
- Match-proof screenshots retained indefinitely, not deletable, undisclosed;
  officers'/players' names+photos published outside the notice; export scope
  understated.

**Accessibility** (J)
- ~30 unlabeled inputs across auth/teams/tournaments/admin forms (placeholder-only);
  "ghost" labels (no htmlFor/wrap); hidden file inputs keyboard-unreachable.
- Form errors never announced (~15 sites missing `role="alert"`).
- No skip link; no `<main>` on any logged-in page; two pages missing `<h1>`; all
  client pages share the tab title; 3 contrast combos fail WCAG AA; carousel
  auto-advances with no keyboard/touch pause.

**Performance** (K)
- Every authenticated page is a client component with a 4–9-query serial waterfall.
- `proxy.ts` runs a remote `auth.getUser()` on every request incl. public pages/API.
- All site images ship unoptimized up to 5 MB.

**Deploy** (M)
- pg_cron must be enabled before `202610171400` (whole migration rolls back otherwise).
- `NEXT_PUBLIC_*` vars inlined at build — `NEXT_PUBLIC_SITE_URL` changes need rebuild.
- Missing Supabase env = 500 on every route **and** build failure (both verified).

**Docs** (N)
- ~~No doc admits the base tables aren't in migrations~~ — resolved outright by the `202610151100_base_schema.sql` bootstrap migration.
- `AGENTS.md` is a stub — the real rules live only in CLAUDE.md.

**Testing** (O)
- Hand-maintained `utils/types.ts` is a silent-drift risk across 25 migrations.
- Recommendation recorded: Vitest covers ~10 pure-function utils with zero mocking;
  pgTAP/`supabase test db` for bracket math is the highest-value DB coverage.

## Verified strengths

- **Security (E):** zero Critical/Required. No service-role anywhere; secrets
  server-only; storage paths prevent cross-match uploads; route handlers auth before
  data; no XSS sinks; CSV formula escaping; ICS escaping; PostgREST metachar sanitizing.
- **RLS (C):** coverage broad and faithful to the access matrix; security-definer
  functions use `search_path=''`; internal helpers revoked.
- **Sentiment pipeline (F):** three-layer validation (schema→JS→DB); every failure
  degrades to "pending analysis"; staff provably cannot read comment text.
- **Registration capacity** (D2): properly serialized with tournament row locks.
- **Notifications types** (I): every emitted type is inside the CHECK constraint —
  no runtime crash path.
- **Public site performance** (K): `'use cache'` + `cacheTag` invalidation done right.
- **Docs (N):** CLAUDE.md verified against code — ~33 RPCs, 18 tables, realtime list,
  model defaults all accurate.

## Runtime verification results

| Check | Result |
|---|---|
| `npm install` | Clean, 382 pkgs; 5 high-sev audit findings — all dev-only transitive (`braces`/`micromatch` inside eslint tooling); no autofix without breaking eslint-config-next |
| `npx tsc --noEmit` (after `next typegen`) | **Zero errors** |
| `npm run lint` | **Zero warnings** |
| `next dev` without env | 500 on every route — `createServerClient` throws at `proxy.ts:28` (findings-m R5 verified) |
| `npm run build` without env | Fails at prerender — `supabaseUrl is required` (findings-m FYI verified) |
| `https://dalta-esports.up.railway.app` | **404** — deployment down/decommissioned |
| Supabase MCP project list | 8 projects, all INACTIVE, none matching this app |

## Still unverifiable

Interactive demo-critical flows (bracket generation, check-in, result submission,
predictions, live pages, realtime presence) — requires `.env.local` + seeded test
data. Also: live Vault secret, pg_cron enabled state, deployed migration order, RLS
enforcement on `postgres_changes`, Realtime channel privacy config, SMTP/email
delivery, Gemini API behavior, Railway builder (Nixpacks vs Railpack), screen-reader
behavior, actual DB query plans/row counts.

## Remediation priority (recommended order)

1. **Deploy blockers** — add `engines` or `.nvmrc` (Node ≥20.9). ~~document or migrate
   the three base tables~~ — done: `202610151100_base_schema.sql` bootstrap migration.
2. **Security fix** — tighten the `/auth/callback` `next` allowlist (reject `\`,
   or parse+compare `URL` origin).
3. **Data-integrity races** — NULL-guard the boolean RPC params; check `m.status`
   in `review_match_result`; add CHECK/constraints for `next_match_id`,
   `topics ≤3`, `tournaments.status`.
4. **Privacy compliance** — real DPO contact; consent gate on all authenticated
   routes (or accept documented scope); disclose match-proof retention + public
   rosters/officers in the notice.
5. **Notification/audit gaps** — `tournament_cancelled` notification + type;
   DELETE-side registration notify; log reschedules and review decisions.
6. **A11y quick wins** — wrap/form labels (copy FeedbackPage pattern), `role="alert"`
   on the shared error style, skip link + `<main>`, contrast bump (gray-500→400,
   green-600→700/#ff4444→red-600).
7. **Perf** — `Promise.all` the independent page queries; skip `getUser()` in
   `proxy.ts` for cookie-less/public requests; `images.remotePatterns` + drop
   `unoptimized` for the public bucket.
8. **Test floor** — Vitest on the pure utils; `supabase gen types` to replace
   hand-maintained `types.ts`; pgTAP for `generate_bracket`.

## File index

| File | Area |
|---|---|
| `analysis-system-assessment-areas.md` | Scope overview |
| `findings-a-functional-coverage.md` | A: requirements coverage |
| `findings-b-auth-lifecycle.md` | B: auth lifecycle |
| `findings-c-database-integrity.md` | C: schema/RLS integrity |
| `findings-d1-bracket-results.md` | D1: bracket & results |
| `findings-d2-registration-teams.md` | D2: registration/teams/predictions |
| `findings-e-security.md` | E: application security |
| `findings-f-sentiment.md` | F: Gemini sentiment pipeline |
| `findings-g-realtime-live.md` | G: realtime & live |
| `findings-h-reports-exports.md` | H: reports & exports |
| `findings-i-notifications-activity.md` | I: notifications & audit log |
| `findings-j-ux-accessibility.md` | J: UX & accessibility |
| `findings-k-performance.md` | K: performance |
| `findings-l-privacy.md` | L: privacy (RA 10173) |
| `findings-m-deployment.md` | M: deploy/runtime readiness |
| `findings-n-documentation.md` | N: documentation accuracy |
| `findings-o-testing.md` | O: testing infrastructure |
