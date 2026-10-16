# Findings — H: Reports, analytics, exports (Module 6)

## Verdict

Reports, analytics and exports are mostly correct — role gates, dedup, Manila-date handling and saved-report version drift are all handled properly. The one Required issue (`report_activity` mixing filtered and unfiltered numbers) and four of the nits below are resolved in `202610181600_report_consistency.sql` + `utils/reports.ts`; remaining nits are around the concerns aggregation cut-off and UX edges.

## Checked

- **Report functions** → `supabase/migrations/202610162300_admin_reports.sql:86-206` (`report_activity`), `:209-310` (`report_sentiment`), `:313-404` (`report_engagement` v1); latest `report_engagement` `supabase/migrations/202610181100_predictions.sql:250-381`. Grants/revokes `:406-411`, `202610181100:380-381`.
- **Engagement metrics** → `v` CTE `202610181100:282-290`, `pr` CTE `:302-311`, `audience` `:312-314`, totals `:316-335`; dedup source `stream_views` unique `202610162100_live_streaming.sql:82-89` + Manila `viewed_on` `202610162300:35-43`; recording `app/live/[id]/page.tsx:47-52`; presence `app/live/[id]/page.tsx:66-90` (admin/staff never track, `:76`) vs counting `app/analytics/engagement/page.tsx:59-77` (subscribes, never tracks).
- **Sentiment report** → totals `:240-251`, by_week `:253-265`, by_tournament `:267-280`, topics `:282-295`, negative_examples `:297-306`; UI "common concerns" filter `app/analytics/SentimentSection.tsx:16-19`, pending banner `:29-35`.
- **Saved reports** → table+policies `202610162300:50-76` (admin read/insert-as-self/delete, no update, `generated_by` set null `:56`); save `app/analytics/page.tsx:79-86`; list `:51-57`; view `app/analytics/reports/[id]/page.tsx` (RLS-not-found path `:30-37`, CSV `:54-67`); drift handling `app/analytics/EngagementSection.tsx:89-91`, `utils/reports.ts:110-139,316-327`.
- **Exports** → `utils/exports.ts` (role map `:16-22`, XLSX `:83-110`, CSV `:112-125`, pagination `:133-151`, 5 builders `:220-419`), `utils/csv.ts` (formula-escape `:11`, BOM `:21`), route `app/api/exports/[type]/route.ts` (type check `:11`, auth `:19-26`, log before send `:39-51`, no-store `:57`), `log_export` `202610171700_export_log.sql:9-38` (re-checks same role map `:18-25`).
- **UI** → `components/ReportFilters.tsx` (game→tournament cascade `:74-79`, presets `:50-55,112-119`), `components/ReportChart.tsx` (Chart.js lifecycle `:39-93`), `utils/reports.ts` (`toRpcArgs` `:26-33`, `validateFilters` `:36-41`, section renderers `app/analytics/{Activity,Sentiment,Engagement,ReportParts}*`), staff redirect `app/analytics/page.tsx:45-48`.
- **FKs/edges** → `stream_views` cascade both ways `202610162100:84-85`, `streams.tournament_id` cascade `:15`, `streams.match_id` set-null `:18`, `feedback.topics` `not null default '{}'` `202610162200:21` + insert policy pins `'{}'` `:39`, `predictions` cascade `202610181100:20-23`.

## Findings

**Critical:** none.

**Required:**

1. ~~**`report_activity` mixes date-filtered and all-time numbers in the same row and totals.**~~ **RESOLVED** — `approved_teams`/`pending_teams` now count from the date-filtered `r` CTE (`202610181600_report_consistency.sql`), so every tournament row and total uses the same range semantics. Verified live: a backdated out-of-range approved registration no longer inflates `approved_teams`.

**Nit:**

2. ~~**Prediction participation divides a filtered numerator by an unfiltered denominator.**~~ **RESOLVED** — `audience` now counts player/spectator accounts that existed by `p_to` (or today when no range is set), so `prediction_participation` divides in-range predictors by the accounts that could have picked. (`202610181600`.)
3. **"Common concerns" can drop negative topics.** SQL caps topics at `limit 20` ordered by *total* mentions (`202610162300:284-293`); the UI then filters `negative > 0` (`SentimentSection.tsx:16-19`). With >20 distinct topics, a rarely-mentioned but purely-negative topic is cut before the negative filter sees it — the chart then reports "No negative topics" while one exists.
4. ~~**CSV filenames use the UTC date while everything else uses Manila.**~~ **RESOLVED** — both filenames now use `todayInManila()`/`dateInManila()` from `utils/reports.ts` (client-safe Manila helpers matching `utils/exports.ts`).
5. ~~**Date-range presets use the viewer's time zone, not Manila.**~~ **RESOLVED** — `daysAgo()` now computes Philippine dates, matching how the RPCs interpret from/to.
6. **Organizer exclusion is evaluated by current role at report time.** `v`/`pr` join `profiles` and exclude `role in ('admin','staff')` (`202610181100:287,308`) — correct for "organizers' own visits don't count", but a viewer promoted to staff later loses their historical views/picks retroactively, and a demoted organizer's old views reappear.
7. **Export buttons render for roles that can never use them.** `/tournaments/[id]/registrations` has no role gate (logged-in read is allowed; `app/tournaments/[id]/registrations/page.tsx:137-138`), so players/spectators see "⬇ Excel / CSV" that always 403s into an error line. Route is safe (`route.ts:24-26`); it's a UX nit only.
8. **Generating while filter options fail to load saves wrong filter labels.** If `useFilterOptions` errors, `filterNames` resolves `tournament`/`game` to `undefined` (`ReportFilters.tsx:40-47`) and the saved report permanently displays "All tournaments · All games" even when ids were set — `handleGenerate` doesn't block on `optionsError` (`app/analytics/page.tsx:67-91`).
9. **Saved-report CSV omits the negative-feedback examples.** `sentimentCsv` exports totals/by-week/by-tournament/topics (`utils/reports.ts:265-290`) but not `negative_examples`, which the page renders (`SentimentSection.tsx:97-112`) — the CSV is not a complete copy of the saved snapshot.
10. ~~**`stream_views.viewed_on` range scans have no index.**~~ **RESOLVED** — `stream_views_viewed_on_idx` added in `202610181600`.
11. **Pending feedback is invisible in the stacked charts.** `sentimentSeries` only plots positive/neutral/negative (`SentimentSection.tsx:22-23`); a week or tournament with only pending rows shows a label with a zero-height bar, though `pending` is exported to CSV. Cosmetic. *(Also in findings-f nit 7.)*

**FYI:**

- **Verified clean:** role gates — `report_activity`/`report_sentiment` raise unless admin (`202610162300:101,224`), `report_engagement` allows admin+staff (`202610181100:265`); all three revoked from public/anon. Staff get engagement only: `/analytics` redirects staff (`page.tsx:45-48`), `analytics_reports` select is admin-only (`:62-65`), `/analytics/reports/[id]` falls through to "not found or only admins" for staff (`:36`).
- **Dedup verified:** one view/person/stream/day via `unique(stream_id,user_id,viewed_on)` + `upsert ignoreDuplicates` (`app/live/[id]/page.tsx:47-52`); insert policy pins `viewed_on` to the Manila date (`202610162300:43`), so views can't be backdated. Orphan handling correct: stream delete cascades views; match delete only nulls `match_id` — matchless-stream views still count per-stream/in totals, match labels only exist when `match_id` set (`streamMatchLabel`, `utils/reports.ts:332-335`).
- **"Watching now" vs recorded views** correctly separated: presence keys = user ids (multi-tab counts once), only players/spectators track, nothing persisted; saved reports pass no `liveCounts` (`EngagementSection.tsx:22-33`).
- **Sentiment correctness:** counts/avg_score/pending split right (`avg()` skips NULLs), concerns = topics on negative feedback (UI-side filter on per-sentiment topic counts — the aggregation returns all topics, the display filters negative), pending rows counted + bannered but excluded from charts/avg_score. `topics` is `not null` so `.join`/`.length` are safe everywhere.
- **Saved reports:** snapshot survives version drift — pre-181100 reports render via `predictions_by_tournament === undefined` branch; deleted tournaments fine (filters are names-only jsonb, no FK); deleted generator shows "deleted user"; `generated_by` can't be spoofed (`generated_by = auth.uid()` check, `:70`).
- **Exports:** 5 types, columns sensible (registrations incl. member student fields per spec; feedback anonymous incl. 'Pending analysis'; users admin-only PII; matches excludes byes consistently via same rule as `isBye`); `EXPORT_ROLES` == `log_export` role map; per-download logging verified; filename slugged; XLSX all-text cells + CSV `'`-prefix neutralize formula injection; `Cache-Control: no-store`.
- **Date-filter semantics note:** `report_engagement` does **not** date-filter `streams`/`live_streams`/`audience_accounts` — "Live now" in a historical-range report reflects today. Old (pre-162300) `stream_views` rows keep UTC `viewed_on`, so `views_by_day` mixes day bases for legacy data (documented in migration).
- **Where the already-found issues hit report numbers:** `predictions.created_at` writable → date-filtered `predictions`, `predictors`, `prediction_accuracy`, `predictions_by_tournament`, `prediction_participation` (`202610181100:309-310`); `profiles.created_at` writable → `users`, `users_by_role`, `signups_by_month` (`202610162300:108-111`); organizers submitting feedback (E nit 3) → `f`/`feedback_by_tournament`/sentiment counts.
- **Deleted accounts erase historical metrics:** `stream_views`/`predictions`/`profiles` all cascade on user delete, so views, unique viewers, predictors and signups_by_month shrink retroactively; `signups_by_month` = "surviving accounts by join month". By design, but report history is not stable.
- **`matches` date bucket** uses `coalesce(scheduled_at, updated_at)` (`202610162300:137`) — unscheduled matches land on their last-edit day (`matches.updated_at` is maintained, `202610161700:74`), and any later edit (e.g., a score fix) re-buckets an unscheduled match. `teams`/`players_in_teams` filter on `teams.created_at`, so member joins count under team-creation day, not join day.
- Edge inputs handled: `log_export` casts/whitelists details (`202610171700:27-34`), `?format=` falls back to xlsx, missing tournament → clean 400 "Choose a tournament.", `getTournament` 404s unknown ids, empty exports return header-only files.

## Unverifiable locally

- **Real DB aggregates** — the `202610181600` fixes were verified against the dev project with in-range vs out-of-range fixtures. Other findings are still from SQL/code inspection; the full `jsonb` shapes and `date_trunc` bucket labels would benefit from richer sample data.
- **Whether `tournaments.start_date`/`end_date`/`registration_deadline` are NOT NULL** (tables created outside migrations — findings-a): if `end_date` can be NULL, `report_activity`'s `t` CTE (`tr.end_date::date >= p_from`, `202610162300:120`) silently drops those tournaments whenever a `from` date is set. App form requires both dates (`app/tournaments/create/page.tsx`), so impact only if API-written.
- **File downloads** — XLSX bytes, `write-excel-file` date rendering, Content-Disposition round-trip, and CSV in Excel can't be produced without running the route.
- **Chart rendering** — Chart.js output (stacked/horizontal/doughnut, print resize via `beforeprint`) and `window.print()` output are runtime-only.
- **Presence counts** — Realtime `viewers-<id>` sync behavior and whether staff subscribe cleanly needs a live project with Realtime enabled.
- **Migration order applied on the live DB** — `report_engagement` correctness assumes `202610181100` is the effective version (older saved reports are handled either way).
