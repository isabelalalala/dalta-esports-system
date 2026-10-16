# Findings — O: Testing and verification infrastructure

## Verdict

Zero automated tests, zero CI, no seed/harness — every safety-critical behavior (bracket generation, winner advancement, result locking, pick'em rules, RLS) lives in untested SQL and is verifiable only by manual live probing; TS-side hygiene is clean but nothing enforces it.

## Checked

- File tree: `*.test.*`, `*.spec.*`, `**/__tests__/**` — 0 hits anywhere in the repo
- `package.json` (all 33 lines): scripts = `dev`/`build`/`start`/`lint` only; deps = supabase/ssr, supabase-js, chart.js, next 16.4.0, react 19.3.0, write-excel-file; devDeps = eslint 9, eslint-config-next, tailwind, typescript, @types — **no vitest/jest/playwright/cypress/testing-library, no test runner of any kind**
- `.github/` — directory does not exist → no CI workflow runs lint/typecheck/tests
- `eslint.config.mjs` — exists, flat config (`core-web-vitals` + `typescript`, default ignores only, no custom rules)
- `tsconfig.json` — `strict: true`, `noEmit: true`; `allowJs: true` (only `postcss.config.js` is JS)
- Suppressions: `ts-ignore`/`ts-expect-error`/`ts-nocheck` = **0**; `eslint-disable` = **1** (justified: `utils/og-card.tsx:39` for `next/og` img); `any` in TS source = **0** (the 3 grep hits are SQL comments + an assessment doc)
- `supabase/` — only `migrations/` (25 files); **no `config.toml`, no `seed.sql`** → no local Supabase harness
- `scripts/` — does not exist
- `utils/types.ts` — hand-written ("Keep these in sync with the database schema", line 1); no generated `database.types.ts`
- `README.md` — stock create-next-app boilerplate, no test/UAT docs; `docs/requirements.md` — no test plan
- Spot-checked ~10 of 43 `.rpc()` call sites in `app/`/`components/`/`utils/` for error handling
- **Could not run** `npx tsc --noEmit` or `npm run lint`: `node_modules` is not installed in this checkout (no `node_modules/next/package.json`, no `next-env.d.ts`) and the audit environment had no shell exec tool

## Findings

**Critical:** No test infrastructure exists — the codebase's highest-risk logic is 100% unverifiable except live.

- All tournament-integrity logic is in Postgres, unreachable by any JS test runner even if one were added: `generate_bracket` (`supabase/migrations/202610161800_generate_bracket.sql` — shuffle, power-of-2 bracket, byes), winner-advance trigger + result lock (`202610161700_matches.sql`), `check_in_match`/`declare_forfeit` (`202610171400_match_checkin.sql`), `submit_match_result`/`respond_to_match_result`/`review_match_result` (`202610171500_match_results.sql`), `check_prediction`/`mark_predictions` (`202610181100_predictions.sql`), `claim_gemini_call` rate limit (`202610181000_feedback_protection.sql`). There is no `supabase/config.toml`, no `seed.sql`, no pgTAP — so even a Supabase-local DB test harness could not start without authoring one.
- No `.github/` → nothing gates a push; CLAUDE.md:448 instructs "run `npm run lint` and `npm run build`" manually — the only documented verification step.

**Critical (capstone-defense risk):** Client/DB rule duplication with no test to keep them honest. Five places implement "the same rule as the database" in TS with only a comment as the contract:

- `getTournamentStatus` `utils/tournaments.ts:56-72` vs DB status rules
- `getCheckinState` `utils/checkin.ts:18-25` vs `check_in_match()`
- `picksOpen`/`canBePicked` `utils/predictions.ts:31-40` vs `check_prediction()` trigger
- `validateFacebookUrl` `utils/streams.ts:10-19` vs the `streams.facebook_url` CHECK
- `validateTournamentDates` `utils/tournaments.ts:76-84` vs DB date constraints

A migration-side rule change silently desyncs the UI. These are also the cheapest functions to unit-test.

**Required:** Hand-maintained `utils/types.ts` is a drift risk across 25 migrations. No `supabase gen types typescript` output exists; e.g. `Match.checkin_notified_at`/`is_forfeit` (types.ts:167-168), `EngagementReport.predictions_*` optional fields (reports.ts:111-115, "missing in reports saved before that") rely on human sync. A drifted field produces silent `undefined`s, not compile errors, because all DB rows are cast (`data as EngagementReport`, reports.ts:161; `(data || []) as NeedsAttentionItem[]`, NeedsAttention.tsx:39).

**Required:** Lint/typecheck — **now verified.** After `npm install` + `npx next typegen`: `npx tsc --noEmit` passes with zero errors; `npm run lint` exits 0 with zero warnings. (First `tsc` run before `typegen` reported 28 `PageProps`/`LayoutProps`/`RouteContext` errors — all generated-route-type artifacts of `.next/types`, not real defects.) `npm audit` reports 5 high-severity vulnerabilities, all transitive dev-dependencies inside `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob`/`micromatch`/`braces` (GHSA-vfj7-8cjw-p6xm, stack-exhaustion DoS in lint tooling) — not shipped to production; `npm audit fix --force` would downgrade `eslint-config-next` to v14, don't take it.

**Required:** Minimal harness that WOULD work here — Vitest (node env, no DOM) covers a large pure-function surface with zero mocking:

- `utils/csv.ts` — `csvCell` formula-injection prefixing (`=+-@`, line 11) and quoting/BOM in `csvFile` — security-relevant, trivially testable
- `utils/tournaments.ts` — `getTournamentStatus` boundary cases, `roundLabel`, `isBye`, `toDateInput`, `validateTournamentDates` (note: `today()` is module-private at :48 — needs `vi.useFakeTimers` or a `now` param like `getCheckinState` already takes)
- `utils/checkin.ts` — `getCheckinWindow`/`getCheckinState`/`formatCountdown` (`now` already injected — designed for tests)
- `utils/predictions.ts` — `picksOpen`, `canBePicked`, `splitPercents` rounding-adds-to-100 (:55-61)
- `utils/streams.ts` — `validateFacebookUrl` regex parity with the CHECK constraint
- `utils/errors.ts` — `getErrorMessage` code→message map (:7-40)
- `utils/reports.ts` — `toRpcArgs`, `validateFilters`, `buildCsv`, `activityCsv`/`sentimentCsv`/`engagementCsv` transforms (:220-329)
- `utils/ics.ts` — `buildCalendar`/`calendarFileName` (escaping/folding internals testable via output)
- `utils/exports.ts` — `isExportType`/`EXPORT_ROLES` (:12-26) vs `log_export` grants — a role-matrix test would catch an export-permission regression
- Gemini response sanitizing (`utils/gemini.ts:109-125` — id whitelist, score clamp, topic normalization) is pure logic worth extracting/testing; it's the only defense against malformed LLM output reaching the DB
- DB layer (separate effort): `supabase start` + `supabase test db` (pgTAP) for `generate_bracket` math (k→⌈k/2⌉ feeding rule, bye completion, result lock) — the single most demo-fragile code path

**FYI:** RPC error handling in UI is consistent — the dominant pattern is `if (xError) throw xError` inside try/catch → `getErrorMessage` → visible error (`ResultSection.tsx:117-156`, `PickemLeaderboard.tsx:21-27`, `NeedsAttention.tsx:37-43`, `tournaments/[id]/page.tsx:223-230`, `reports.ts:159-175`, exports route `route.ts:34-50` which even gates the download on `log_export` success). Deliberate silent paths found (all commented/fail-closed, none dangerous): `get_my_role` errors ignored but fail closed at `app/live/[id]/page.tsx:75`, `app/api/exports/[type]/route.ts:23`, `app/admin/website/actions.ts:11`; `PredictionsProvider.tsx:77-79` swallows load errors by design ("Picks are extra"); `tournaments/[id]/page.tsx:164` ignores `get_team_roster` error (convenience-only, DB enforces). No empty `catch {}` blocks exist. One genuine gap a test would flag: `mark_feedback_pending` calls at `utils/feedback-analysis.ts:35,76` discard `{ error }` — if the pending-mark fails, feedback is stuck pending with no recorded reason. *(Also findings-f nit 3.)*

**Nit:** `Number(scoreA)`/`Number(scoreB)` at `ResultSection.tsx:119-120,151-152` can send `NaN` to `submit_match_result`/`review_match_result` if input is bypassed; relies on the DB CHECK — exactly the kind of edge a unit/integration test would pin down.

## Unverifiable locally

- ~~`npx tsc --noEmit` and `npm run lint`~~ — **verified 2026: clean.** `npm install` (382 packages) → `npx next typegen` → `tsc --noEmit` zero errors; `eslint` zero warnings. Remaining unverifiable items below.
- Whether all 25 migrations are applied in order on the live DB — TS types assume the latest versions.
- Runtime behavior of RLS policies, triggers, Realtime, pg_cron job — untestable without a live Supabase project; none of it has any automated coverage anywhere.
