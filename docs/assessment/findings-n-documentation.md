# Findings — N: Documentation accuracy

## Verdict

Docs are unusually accurate — every schema table, column, RPC, policy, flag, bucket, realtime publication, cron job and file-path claim traced in CLAUDE.md matched the migrations and code exactly. The one serious doc problem is setup documentation: README.md is untouched create-next-app boilerplate, and no doc tells a fresh dev that the three base tables aren't in any migration.

## Checked

| Doc | Result |
|---|---|
| `CLAUDE.md` (~450 lines) | **Accurate.** Verified: schema columns for all 18 tables; all ~33 listed RPCs exist; realtime list (matches/match_checkins/match_result_submissions/notifications) matches `alter publication` calls (`202610162100:115`, `202610171400:55`, `202610171500:149`, `202610171200:61`); `GEMINI_MODEL` default `gemini-3.5-flash-lite` = `utils/gemini.ts:9,49`; `NEXT_PUBLIC_SITE_URL` default `http://localhost:3000` = `utils/site-url.ts:4`; `proxy.ts` claim correct (file exists, no `middleware.ts`); pg_cron job `dalta-checkin-open-notifications` `*/5` = `202610171400:328-332`; `match-proofs` (private, 5 MB, PNG/JPEG/WebP, no update/delete) = `202610171500:75-99`; `site-images` (public, +GIF) = `202610171600:201-206`; "latest version" function pointers all correct; module/page lists match the `app/` tree. Two small gaps, below. |
| `AGENTS.md` | **Empty of project rules** — contains only the auto-generated `nextjs-agent-rules` block (lines 1–9). The actual rules ("never use service role", client/server client split, RLS-first, migrations-only schema changes) live in CLAUDE.md:20–27 and are **all honored in code**: `utils/supabase/{client,server,public,signup-client}.ts` match the described pattern exactly; grep `SERVICE_ROLE|service_role` → 0 code hits; every `create table` in migrations is followed by `enable row level security`. |
| `docs/requirements.md` | **Spec + changelog hybrid, no contradictions.** Original 6-module spec is annotated `(added)` and ends with "Final system: additions" (D6–D9 stores, processes 7.0/8.0, new use cases) — all match code (D7=`notifications`, D8=`activity_logs`, D9=`predictions`, D6=8 site tables). Role table matches `profiles_role_check` (`202610161200:36-37`). "Admin: post announcements" matches admin-only policies (`202610162000:32-46`). |
| `docs/new-features-summary.md` | **Accurate; no overclaims found.** Sampled every feature: migration names/tables/columns/functions all exist as described; pick'em rules match `202610181100` verbatim; retention claims match (`gemini_calls` 1-day purge `:196`; notifications 90 d `202610171200:320`; activity 1 yr `202610171100:388`); check-in 30-min default ✓; "no service role key" ✓. |
| `README.md` | **Wrong — stock boilerplate.** See Findings. |
| Migration headers | All headers accurately describe their own contents and manual steps. `202610181000:13-19` documents the Vault `feedback_server_key` setup; `202610171400:327` documents enabling pg_cron. |

## Findings

**Critical:**

1. **README.md is untouched `create-next-app` boilerplate — a fresh dev cannot set up the project from it.** Claims "start editing … `app/page.tsx`" (README:19) but no such file exists — the root page is `app/(site)/page.tsx`. "Deploy on Vercel" section (README:32-36) contradicts CLAUDE.md:17 ("Deployment: Railway"). It omits: all env vars (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `FEEDBACK_SERVER_KEY`, `NEXT_PUBLIC_SITE_URL` — CLAUDE.md:29-38), the manual SQL-Editor migration workflow (CLAUDE.md:24-25), the one-time Vault `feedback_server_key` setup (`202610181000_feedback_protection.sql:13-19`), enabling pg_cron (`202610171400:327`), Supabase dashboard settings (site/redirect URLs, SMTP — CLAUDE.md:45-50), and that the base tables aren't in any migration (below). Even the font claim is accidental: Geist happens to be imported at `app/layout.tsx:2`. **Resolved:** README rewritten with real setup instructions covering all of the above (env table, base-tables caveat, ordered migration/Vault/pg_cron steps, dashboard settings, Railway notes).

**Required:**

2. **No doc states that `profiles`, `tournaments` and `tournament_registrations` are not created by any migration.** CLAUDE.md:79 says "All migrations are in `supabase/migrations/`, run in filename order (202610151200 … 202610181100)" — true, but running them on an empty project fails: the first migration already fails at `create or replace function public.current_user_role()` (`202610151200:44-52` — a `language sql` function selecting `public.profiles`, validated at CREATE under `check_function_bodies`) before even reaching the `alter table` at `:88`; `create table` never appears for these three (grep `create table` across all 25 migrations — they only ever get `alter table`). The migrations themselves admit it: `202610161300:48-49` "These foreign keys were created outside the migrations" and `202610161500:38-39` "The link was created outside the migrations". Combined with the boilerplate README, the base schema is documented nowhere in the repo. *(Same root issue as findings-a Required 1 and findings-m Critical 1.)*

3. **AGENTS.md contains no rules at all.** It is only the auto-generated Next.js block (AGENTS.md:1-9). The instruction premise "AGENTS.md says never use service role" is misplaced — that rule is at CLAUDE.md:23. If AGENTS.md is intended as the agent-rules file, it's a stub; today agents only get the rules via CLAUDE.md's `@AGENTS.md` include *into* CLAUDE.md, not the reverse.

**Nit:**

4. **"Flags in use" list is incomplete.** CLAUDE.md:414 lists 5 transaction flags but omits `app.marking_predictions`, used at `202610181100_predictions.sql:82,155,162` (the flag *is* mentioned inline at CLAUDE.md:162, so this is a completeness gap in the canonical list, not undocumented behavior).
5. **Student-verification reset wording slightly wrong.** CLAUDE.md:90-92 says "Saving complete details sets `pending`; changing them later resets to `pending`" — code sets `'unsubmitted'` (not `pending`) when any of the three fields is emptied (`202610171000:93-98`).
6. **Resend-button attribution imprecise.** CLAUDE.md:54-55 credits `utils/auth.ts`; the actual resend handler/button lives in `app/auth/login/page.tsx:57-64,89-91`. `utils/auth.ts` only holds `isEmailNotConfirmed`/`confirmEmailRedirect` (`utils/auth.ts:6-16`).
7. **`202610162200_feedback.sql:3-4` header is stale in isolation** ("Admin/staff classify the sentiment", "Admin/staff read all feedback") — staff access was revoked by `202610162300:17-29`. Acceptable as point-in-time history, but misleading if someone audits policies file-by-file.

**FYI:**

- Known-drift items resolved: docs correctly say `proxy.ts` not `middleware.ts` (CLAUDE.md:18, `proxy.ts` exists); no migration-count claims remain in non-assessment docs (25 files present); the dropped `team_join_codes`/`join_team()` (created `202610151200:137,268`, dropped `202610161400:61-62`) and `team_added` notification (kept in the CHECK list for old rows, trigger dropped `202610171300:444-445`) are correctly *not* in the CLAUDE.md schema/RPC lists.
- All 31 RPCs named at CLAUDE.md:274-281 exist in migrations; all "latest version" pointers at :416-423 verified (`check_tournament_registration`/`check_registration_update`/`check_team_member`/`get_team_roster` → `202610171000`; `search_players`/`protect_team_fields` → `202610171300`; `protect_profile_role`/`handle_new_user` → `202610170900`; `log_match` → `202610171400`; `get_needs_attention`/`notifications_type_check` → `202610171500`; `report_engagement` → `202610181100`; `protect_feedback` → `202610181000`).

## Unverifiable locally

- Live Supabase project state: whether pg_cron is actually enabled and the `dalta-checkin-open-notifications` job exists, the Vault secret is set, the four tables are actually in `supabase_realtime`, custom SMTP/redirect-URL/"Confirm email" dashboard settings — migrations cover DB-side state idempotently but dashboard/extension state can't be checked from the repo.
- Base-table DDL for `profiles`/`tournaments`/`tournament_registrations` (e.g., whether `profiles.updated_at` — typed at `utils/types.ts:8` — and NOT NULLs like `tournaments.end_date` actually exist as CLAUDE.md describes); the CREATE TABLEs exist nowhere in the repo.
- Railway deployment config — no railway config file in the repo; only doc claims.
- Whether `gemini-3.5-flash-lite` is a valid upstream model name — doc and code agree (`utils/gemini.ts:9`); validity against Google's catalog is external.
