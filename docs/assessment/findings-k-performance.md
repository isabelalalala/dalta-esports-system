# Findings — K: Performance

## Verdict

Public site is well-architected (cached `'use cache'` data, Suspense boundaries, per-request dedupe), but the entire authenticated app is client-only with serial Supabase waterfalls of 4–9 round-trips per page, every site image ships unoptimized (up to 5 MB originals), and `proxy.ts` makes a remote Supabase Auth call on every request including public pages and API routes.

## Checked

- Rendering: every `page.tsx` / layout (`'use client'` grep — all authenticated pages are client components; `(site)` pages + Suspense wrappers are server)
- Data fetching: all pages' load effects, `utils/{matches,notifications,public-tournament,site-data,exports,reports}.ts`
- Client bundle: `components/ReportChart.tsx`, `utils/exports.ts`, `utils/gemini.ts`, `next.config.ts`, `package.json`
- Images: all `next/image` usages (`unoptimized` grep), `utils/site-images.ts`, `utils/site.ts:117-120`
- Realtime/intervals: `LiveRefresher`, `NotificationBell`, `PredictionsProvider`, `matches/[id]`, `live/[id]`, `analytics/engagement`, `HeroCarousel`
- Caching: `next.config.ts` (`cacheComponents`, `partialPrefetching`), `'use cache'`/`cacheTag`/`cacheLife`, `React.cache`, `proxy.ts`, route `Cache-Control` headers
- Fonts/assets: `app/layout.tsx`, `app/globals.css`, `public/`

## Findings

**Critical:** none.

**Required:**

1. **Every authenticated page is a full client component with a serial `await` waterfall.** No SSR/RSC data loading exists outside `(site)`; each page renders a spinner, then fetches after mount in sequence:
   - `app/tournaments/[id]/page.tsx:55-146` — session → profile → tournament → registrations → matches → team names → announcements → live streams → my captain teams = **~8 sequential round-trips** per load (and again on every `reloadCount` bump, e.g. after registering or generating a bracket). Queries from `:69` onward are independent of each other and could run in one `Promise.all` after the session.
   - `app/tournaments/[id]/matches/page.tsx:37-89` — profile → tournament → matches → team names → check-ins; the last two are independent of each other.
   - `app/tournaments/[id]/streams/page.tsx:43-77` — profile → tournament → streams → matches → `fetchTeamNames`; streams and matches could be parallel.
   - `app/announcements/page.tsx:34-58`, `app/admin/feedback/page.tsx:51-75`, `app/feedback/page.tsx:50-65`, `app/teams/page.tsx:28-43`, `app/profile/page.tsx:45-67` — same pattern; the last 2 queries in each are independent.
   - Contrast with `app/schedule/page.tsx:46-60`, `app/matches/[id]/page.tsx:64-73`, `components/PredictionsProvider.tsx:66-70`, `utils/reports.ts:167` (3 report RPCs in `Promise.all`) — the parallel pattern already exists in the codebase. Cheap fix: `Promise.all` the independent queries; the heavier fix (server components + small client islands) removes the spinner-then-fetch entirely but is a big rewrite — the waterfall fix alone is worth doing.

2. **`proxy.ts` calls `supabase.auth.getUser()` on every request — a remote Supabase Auth round-trip per page view, on public pages and API routes too.** `proxy.ts:50-52` runs unconditionally; the matcher (`:69`) only excludes static files, so `/`, `/t/[id]`, `/about`, search, and the `/api/*` handlers all pay the call. Route handlers then call `getUser()` again (`app/api/feedback/route.ts:16`, `app/api/exports/[type]/route.ts:19`, `classify/route.ts:14`) — double auth verification per API request. It also partially negates `cacheComponents`/`'use cache'` on public pages since the proxy still executes per request. Fix: skip `getUser()` when the request has no `sb-` auth cookie and the path isn't protected (anonymous visitors never need a refresh); optionally run it only for protected paths.

3. **All site images are served unoptimized at original size.** Every `<Image>` pointing at the site-images bucket uses `unoptimized` (`components/site/HeroCarousel.tsx:29`, `SiteParts.tsx:51`, `Posts.tsx:41`, `PostCard.tsx:17`, `SiteHeader.tsx:24`, `Footer.tsx:28`, `app/(site)/about/page.tsx:18`, `divisions/page.tsx:29`, `divisions/[game]/page.tsx:53`, `divisions/[game]/[team]/page.tsx:36`, `admin/website/ImageField.tsx:45`, `ListEditor.tsx:295`), and `next.config.ts` has no `images.remotePatterns`, so the optimizer can't be used anyway. Uploads allow up to 5 MB (`utils/site-images.ts:7`) with no client-side resize — the home-page hero carousel and post cards serve multi-MB originals to every visitor, and `unoptimized` + `fill` (no `sizes`) means no responsive variants. Fix: add `images.remotePatterns` for `*.supabase.co` storage URLs and drop `unoptimized` (keep it only for the signed match-proof URL in `ResultSection.tsx:191`, which is a private bucket).

**Nit:**

4. **Unbounded list pages** (fine at university scale today, but no ceiling): `/announcements` loads all announcements with a join (`app/announcements/page.tsx:54-58`); `/admin/feedback` loads all feedback with two joins (`app/admin/feedback/page.tsx:72-75` — needs the full set for its summary, so a server-side aggregate would be the real fix); `/admin/users` loads all profiles (`:42-45`, self-acknowledged "fine for a school-sized number" `:72-73`); `/admin/verification` loads all players per status tab — the `verified`/`rejected` tabs grow forever (`:46-51`); `/live` loads all streams ever created including replays (`app/live/page.tsx:21-24`); `/tournaments` loads all tournaments (`app/tournaments/page.tsx:42-49`); `/campaigns`/`/events` render every post (`utils/site-data.ts:43-53` without `limit`). Paginated correctly: `/notifications` (30/page + load more, `app/notifications/page.tsx:13,47`), `/admin/activity` (50/page, `app/admin/activity/page.tsx:11,39`), saved reports list capped at 50 (`app/analytics/page.tsx:55`), `/schedule` at 30 (`app/schedule/page.tsx:15`).

5. **Realtime reloads lack the debounce that `LiveRefresher` has.** `watch-<tournamentId>` (`app/live/[id]/page.tsx:122-129`) runs `loadMatches()` — 3 queries (`:100-112`) — on *every* match row write; advancing a winner writes 2+ rows → 6+ queries per save. `match-<id>` (`app/matches/[id]/page.tsx:103-107`) fires a full 6-query reload per event across three tables; a result approval writes to matches + submissions near-simultaneously → duplicate reloads. A 500 ms coalescing timer like `LiveRefresher.tsx:16-20` would halve the traffic.

6. **`getSession()` gates each page's first fetch unnecessarily.** ~20 pages do `await supabase.auth.getSession()` before querying (`dashboard/page.tsx:100`, etc.). It's local (cookie read, no network) so it isn't expensive — but it serializes the waterfall start by one microtask and duplicates the role/identity fetch every page could get from the server. Also, several pages call `profiles.select('*')` or `rpc('get_my_role')` purely for a role check — `matches/page.tsx:29-35`, `tournaments/[id]/page.tsx:61-65`, `tournaments/page.tsx:32-38` fetch `*` when only `role` is needed.

7. **Chart.js is a static `chart.js/auto` top-level import.** `components/ReportChart.tsx:5` registers every chart type (~200 KB min+gzip ~70 KB). It only lands in the `/analytics` route chunks (used only by `Activity/Sentiment/EngagementSection`, admin/staff pages), so blast radius is small — but named registration or `next/dynamic` (absent everywhere; no `next/dynamic` in the repo) would trim it.

8. **Geist Sans + Geist Mono are downloaded but essentially unused.** `app/layout.tsx:8-16` loads both via `next/font`, yet `body { font-family: Arial, Helvetica, sans-serif }` (`globals.css:39`) and `font-sans`/`font-mono` appear only 3 times total (`tournaments/page.tsx:68`, `global-error.tsx:16`, `profile/page.tsx:363`). Two font files ship to every visitor for near-zero use; either drop them or set `--font-sans` on `body`. (Press_Start_2P is genuinely used via `font-pixel` — fine.)

9. **Facebook iframes load eagerly.** `FacebookPlayer.tsx:9-15` has no `loading="lazy"`; on `/live/[id]` the embed mounts even when the stream is only `scheduled` (`:174` renders it unconditionally).

10. **`/analytics/engagement` re-runs `report_engagement` on every filter change** (`app/analytics/engagement/page.tsx:33-53` — `filters` in the effect deps; each select/date change = one jsonb-aggregation RPC). A short debounce or an explicit Apply button would halve calls during multi-filter setup.

11. **`fetchRoundCounts` pulls every match row to compute a max** (`utils/matches.ts:24-27` — `select('tournament_id, round').in(...)`, then a JS max loop). Trivial rows, but an aggregate query or the already-loaded match list would be free.

**FYI:**

- **`get_public_tournament` per-request cost is reasonable here.** `React.cache()` dedupes generateMetadata + page + OG image into one RPC per request (`utils/public-tournament.ts:21-27`), and `LiveRefresher`'s 60 s `router.refresh()` (`components/site/LiveRefresher.tsx:26`) only re-runs the dynamic Suspense segment — the layout's `getSiteContent` is `'use cache'` so it isn't refetched. Cost = 1 RPC + partial render per open viewer tab per minute; fine for a school tournament audience. Not caching it is deliberate (live scores) and correctly documented.
- **Site-data caching is well done**: `'use cache'` + `cacheTag('site')` + `cacheLife('minutes')` (`utils/site-data.ts:14-21`), invalidated on save via `updateTag` in `app/admin/website/actions.ts` — fresh-after-edit *and* cached otherwise. `/calendar/*` sets `Cache-Control: public, max-age=300` (`route.ts:38`); exports set `no-store` (`route.ts:57`).
- **No true N+1 loops found** — all "team names for matches" fetches batch via `.in('id', [...])` (`utils/matches.ts:15`, `tournaments/[id]/page.tsx:107-114`, `matches/page.tsx` equivalent, `exports.ts:322-329`), and `exports.ts` pages through results in chunks of 1000 with `fetchIn` batching of 100 (`:133-151`).
- **`write-excel-file` is correctly server-only** (`utils/exports.ts:5`, `/node` entry, only reachable from the exports route); `utils/gemini.ts:5` uses `import 'server-only'` (per instructions, not re-verified further).
- **`public/` is clean** — only the logo jpg and scaffold SVGs; no stray large assets.
- **Header auth flash**: `SiteAuthButtons` renders "Log in / Sign up" until client `getSession()` resolves (`components/site/SiteAuthButtons.tsx:17,43-52`) — deliberate to keep pages cached (comment `:10`), but logged-in users get a brief wrong-state flash on every public page.
- **Suspense usage is for Cache Components compliance, not streaming of slow data** — every boundary wraps the whole page (`app/(site)/t/[id]/page.tsx:42-44`, etc.), so there's no progressive reveal of independent sections; acceptable since each page makes one cached query.

## Unverifiable locally

- Real bundle sizes / whether Chart.js actually splits per-route (`next build` + analyzer output), Lighthouse scores, LCP impact of the unoptimized hero images.
- Actual latency added by `proxy.ts`'s `getUser()` on Railway→Supabase round-trip, and the `get_public_tournament` RPC duration under concurrent viewers.
- Whether queries like notifications-by-user, `tournament_registrations` joins, and `report_*` aggregations seq-scan on live data volumes (needs `EXPLAIN` on the real DB — index coverage was audited separately in findings-c).
