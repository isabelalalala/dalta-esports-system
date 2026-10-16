# Findings — J: UX and accessibility

## Verdict

Solid UX engineering underneath (real buttons/links, confirm dialogs on every destructive action, helpful empty states, a genuinely accessible StarRating and report tables) but accessibility was clearly an afterthought on forms: placeholder-only labels are the dominant pattern, most error messages are never announced, there is no skip link and no `<main>` landmark on any logged-in page, and several contrast combos fail WCAG 2.2 AA. Nothing is a hard blocker for sighted mouse users; screen-reader and keyboard-only users will hit real walls.

## Checked

**Audited:** all of `app/` (auth ×4, dashboard + 3 widgets, profile + StudentDetails, teams + [id], tournaments + create/edit/[id]/matches/registrations/streams/predictions, matches + [id] + Checkin/ResultSection, live + [id], feedback, announcements, notifications, registrations, schedule, privacy/consent, admin/users + verification + feedback + activity + website editors, analytics + engagement + ReportParts, not-found, error, global-error, (site) layout + home + search + t/[id] + t/[id]/match) and all of `components/` (SiteHeader, SiteAuthButtons, SiteSearchBox, NotificationBell, Footer, HeroCarousel, PostCard, SiteParts, LiveRefresher, StarRating, PredictionPicker, PrivacyConsentCheckbox, AnnouncementCard, ShareButton, CalendarLinks, ExportButtons, ReportFilters, ReportChart, PageLoading, PageError, FacebookPlayer, TeamInvites, VerifiedBadge, Bracket).

**Essentially clean:** StarRating (input variant), PredictionPicker, ReportChart, ReportTable, ReportFilters, PageLoading/PageError/not-found/error/global-error, Bracket, CheckinSection, FeedbackPage (the best form in the codebase — wrapped labels + `role="alert"`/`role="status"`), FacebookPlayer, ShareButton, Footer/SiteHeader landmarks, (site) layout (`<main>` + `<nav>` + native `<details>` menu), destructive-action confirms everywhere.

**Has issues:** every auth page, profile (+ game profiles + change password), team create/edit/invite, tournament create/edit/register, announcements (compose + filter), streams form, admin/users, admin/feedback, schedule, live/[id], matches/[id], t/[id]/match, HeroCarousel, ImageField/ListEditor, NotificationBell, globals.css theme.

## Findings

**Critical:** none found — every interactive element is a real `<button>`/`<a>`/`<input>` (no clickable divs), and all destructive actions are confirmed.

### Required

**Forms — programmatic labels (WCAG 1.3.1 / 3.3.2 / 4.1.2)**

1. **Placeholder-only labels are the dominant pattern.** The following inputs/selects have no `<label>`, no `htmlFor`, no `aria-label` — the placeholder is the only name, and it disappears once text is entered:
   - Login email + password — `app/auth/login/page.tsx:96-99`
   - Register full name, email, password, confirm — `app/auth/register/page.tsx:126-133` (only the role select is labeled, `:136-137`)
   - Forgot-password email — `app/auth/forgot-password/page.tsx:51-58`
   - Reset-password both fields — `app/auth/reset-password/page.tsx:72-83`
   - Team create name/select/description — `app/teams/page.tsx:116-140`
   - Team edit + invite search — `app/teams/[id]/page.tsx:264-270, 376-379`
   - Announcement title/body/tournament select — `app/announcements/page.tsx:239-253`; the page's filter select has no label either — `:137`
   - Stream title/URL/match/status selects — `app/tournaments/[id]/streams/page.tsx:304-332`
   - Profile game-profile inputs + all 3 change-password inputs — `app/profile/page.tsx:267-282, 446-462`
   - Admin "Add account" all fields — `app/admin/users/page.tsx:383-400`; user search + role-filter selects — `:103-115`; inline name edit — `:219-221`
   - Admin verification search + reject reason — `app/admin/verification/page.tsx:138-143, 181-189`
   - Admin feedback both filter selects — `app/admin/feedback/page.tsx:187-200`
   - Schedule tournament-filter select — `app/schedule/page.tsx:142-151`
   - Result submit: dispute reason, staff reject note, **and the file input** (no label/aria-label at all) — `app/matches/[id]/ResultSection.tsx:206-207, 240-241, 265-271`

2. **"Ghost" labels**: many `<label>` elements sit next to the input inside a `<div>` without `htmlFor`/`id` and without wrapping — visible text but zero programmatic association: tournament create `app/tournaments/create/page.tsx:114-125, 128-155, 171-211` and edit `app/tournaments/[id]/edit/page.tsx:144-209, 240-276` (all fields except the two that do wrap), profile Full Name `app/profile/page.tsx:226-233`, tournament registration team select `app/tournaments/[id]/page.tsx:513-515`. Screen readers will not announce these labels; clicking the text doesn't focus the field.

3. **Hidden file inputs are unreachable by keyboard.** `app/admin/website/ImageField.tsx:47-56` and `app/admin/website/ListEditor.tsx:274-278` wrap `<input type="file" className="hidden">` (display:none) in a non-focusable `<label>` — the "Upload"/"+ Add photo" control cannot be tabbed to or activated by keyboard, and is invisible to the accessibility tree entirely.

**Status messages (WCAG 4.1.3)**

4. **Form errors are visually rendered but never announced.** The shared `bg-red-500/10 border border-red-500 text-red-300` error div has no `role="alert"`/`aria-live` in ~15 places — e.g. `app/tournaments/create/page.tsx:108`, `app/teams/page.tsx:108`, `app/profile/page.tsx:197`, `app/teams/[id]/page.tsx:303`, `app/announcements/page.tsx:125,237`, `app/tournaments/[id]/streams/page.tsx:172,302`, `app/matches/[id]/ResultSection.tsx:166`, `app/matches/[id]/CheckinSection.tsx:97`, `app/profile/StudentDetails.tsx:74,78`, `app/admin/users/page.tsx:97,285,379`, `app/admin/verification/page.tsx:121`, `app/schedule/page.tsx:153`. Success messages (`text-green-300`) likewise lack `role="status"` everywhere except `app/feedback/page.tsx:191-192` — the only page that gets this right. A screen-reader user who submits a failing form hears nothing.

**Structure (WCAG 2.4.1, 1.3.1)**

5. **No skip link anywhere** (grep for "skip" = zero hits). Keyboard users tab through the header (logo, search input + button, auth buttons/bell) plus the 6-link site nav on public pages before reaching content on every page load. Add a "Skip to content" link in `app/layout.tsx` before `<SiteHeader />` (line 46).

6. **No `<main>` landmark on any logged-in page.** `<main>` exists only in `app/(site)/layout.tsx:42`, `app/not-found.tsx:12`, `app/error.tsx:16`. Every app page opens with `<div className="min-h-screen bg-sitebg …">` (e.g. `app/dashboard/page.tsx:146`, `app/tournaments/page.tsx:68`) — screen-reader users cannot jump to main content.

7. **Missing `<h1>` on two pages**: `app/matches/[id]/page.tsx` (the match header uses `<p>` elements, `:139-150`; sections start at h2) and `app/(site)/t/[id]/match/[matchId]/page.tsx:82-86` (team names are `font-pixel` `<p>`s). All other audited pages have exactly one h1.

8. **Every client page shares the tab title "DALTA Esports"** (`app/layout.tsx:28`); only `/t/*` and `not-found` export `metadata`/`generateMetadata`. WCAG 2.4.2 — page titles don't describe each page's purpose.

**Contrast (WCAG 1.4.3)**

9. **`bg-[#ff4444]` + white error banners ≈ 3.4:1** — `app/auth/login/page.tsx:81`, `app/auth/register/page.tsx:124`, `app/auth/forgot-password/page.tsx:50`, `app/auth/reset-password/page.tsx:71`, `app/privacy/consent/page.tsx:54`. Fails 4.5:1 for normal text. (The `bg-red-500/10 + text-red-300` variant used elsewhere passes — use it consistently.)

10. **`text-gray-500` on sitebg/sitecard ≈ 3.9:1 — fails AA** and it carries real content, not just decoration: footer copyright `components/Footer.tsx:56`, member counts `app/teams/page.tsx:163`, empty states `components/site/SiteParts.tsx:33`, timestamps `components/NotificationBell.tsx:123`, "No picks yet" `components/PredictionPicker.tsx:75`, captain names `app/tournaments/[id]/page.tsx:433`, and `placeholder-gray-500` on most inputs. `text-gray-400` (~7:1) is fine — bump the 500s.

11. **Colored action buttons fail**: `bg-green-600` + white "Generate Bracket" ≈ 3.3:1 (`app/tournaments/[id]/page.tsx:482`); `bg-red-500` + white "Reject"/"Revoke" ≈ 3.8:1 (`app/admin/verification/page.tsx:191`). `bg-red-600` (~4.8:1) and `bg-purple-600` (~5.4:1) pass — swap to those shades.

**Keyboard/motion (WCAG 2.2.2, 2.1.1)**

12. **HeroCarousel auto-advances every 5 s and can only be paused by hover** — `components/site/HeroCarousel.tsx:40-41` (`onMouseEnter/Leave` only). Keyboard users tabbing to the ‹/›/dot controls get no pause, touch users can't pause at all, and there is no stop button or `prefers-reduced-motion` check. WCAG 2.2.2 Level A for auto-updating content.

### Nit

13. **NotificationBell dropdown**: no Escape-to-close (only click-outside via the invisible overlay button, `:94`), no focus management (focus isn't moved into the panel or returned to the bell on close), and the `aria-label="unread"` on a plain `<span>` (`:120`, same in `app/notifications/page.tsx:131`) is ignored without a role — use `role="img"` or `sr-only` text.
14. **StarRating display variant**: `aria-label="…out of 5 stars"` on a generic `<span>` (`components/StarRating.tsx:17`) is ignored by AT — needs `role="img"`, otherwise SRs get raw "★★★☆☆".
15. **`prefers-reduced-motion` is never honored** (zero hits): `animate-pulse` loaders (`components/PageLoading.tsx:9-11`), `group-hover:scale-105` post images (`components/site/PostCard.tsx:17`), translate transitions throughout. Minor since most is decorative, but the carousel (Finding 12) is not.
16. **Focus indicator is a 1px border-color change** — every input uses `outline-none focus:border-gold` (brownlight→gold); present but very subtle. Links/buttons keep the browser ring (good). Consider `focus-visible:ring-2` on inputs.
17. **Realtime updates are visual-only**: live scoreboard (`app/live/[id]/page.tsx:190-215`), "Watching now" tile (`app/analytics/EngagementSection.tsx:33`), check-in countdown, and notification unread count update silently — no `aria-live="polite"`. Conversely `app/matches/[id]/page.tsx:100-112` reloads the whole page content on any realtime event, which can silently swap content under an SR user's cursor.
18. **Target size below 24px (WCAG 2.5.8)**: carousel dots are `w-2.5 h-2.5` (10px — `HeroCarousel.tsx:67`); ListEditor reorder buttons `px-2 py-1` are borderline (`ListEditor.tsx:309-312`); "Mark as read" is `text-xs` (`app/notifications/page.tsx:139`).
19. **Silent successes**: creating a team (`app/teams/page.tsx:75-79`), saving an announcement or stream just closes the form — the list updates but there's no confirmation message or announcement (unlike registration, which says "Registration submitted…").
20. **Naming drift**: header says "Log in" but the button says "Sign In" (`SiteAuthButtons.tsx:46` vs `login/page.tsx:106`); "Register" link vs "Sign Up" button. Check-in is consistently "Check in"/"Check-in" — fine.
21. **Heading-level skips**: dashboard cards jump h1→h3 (`app/dashboard/page.tsx:176`), `AnnouncementCard` renders h3 with no parent h2 on `/announcements` when the form is closed.
22. **Disabled-until-consent submit**: register button is `disabled={loading || !consent}` (`app/auth/register/page.tsx:147`) — disabled state gives no hint *why*; the required checkbox mitigates it but a `title`/aria-describedby hint would help.
23. **Whole-card link containing a fake button**: `app/tournaments/page.tsx:114-172` wraps the entire card in `<Link>` with a styled "View Tournament Details" span — SRs hear one very long link name; acceptable but verbose.
24. **Admin users "table" is styled divs**, not a `<table>`/list — `app/admin/users/page.tsx:122-147`: the header row (`:124-129`) is a `hidden md:grid` of divs with no semantic relationship to the rows below.
25. **Global-error `<title>` inside `<body>`** — `app/global-error.tsx:17` renders `<title>` in the body (works, but unconventional; move to `<head>`).
26. **Body font is hardcoded Arial** (`app/globals.css:39`) while Geist is loaded via `next/font` and never applied — wasted font download and inconsistent with `font-sans` utilities. *(Also in findings-k nit 8.)*

### FYI

- `formatDateTime` on client pages uses the *viewer's* time zone (`utils/tournaments.ts:117-125`); server-rendered public pages pin `Asia/Manila` and label it "(Philippine time)". Consistent for the PH audience; a non-PH organizer sees different wall times between the two surfaces.
- "Verify" on `app/admin/verification/page.tsx:202-205` is a one-click action with no confirm — revocable via "Revoke verification", so low risk.
- `autoFocus` on the reject-reason and edit-name inputs (`admin/verification/page.tsx:187`, `admin/users/page.tsx:221`) moves focus on render — acceptable in-context, mild for SR users.
- `/tournaments/[id]/page.tsx:270` treats `max_participants` null as unlimited — fine, but "∞" in the progress bar (`app/tournaments/page.tsx:143-146`) renders `max=1` with value=min(count, count) — the bar always shows full for unlimited tournaments; cosmetic.

## Unverifiable locally

- Actual rendered contrast ratios (computed from hex values; anti-aliasing, monitor, and the `font-pixel` retro typeface at `text-[10px]` sizes may be worse in practice — the pixel font is a legibility risk at small sizes regardless of contrast).
- Screen-reader behavior (NVDA/JAWS/VoiceOver): whether `aria-label` on generic spans is announced, dropdown announcement order, realtime list re-announcement noise.
- Real-device testing: hamburger `<details>` behavior, carousel on touch, `type="datetime-local"` rendering, Facebook embed behavior with ad blockers.
- Whether focus-visible ring vs `focus:border-gold` reads as a sufficient indicator in practice.
