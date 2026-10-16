# Findings J: UX and accessibility

## Verdict

Solid UX engineering underneath (real buttons/links, confirm dialogs on every destructive action, helpful empty states, a genuinely accessible StarRating and report tables). **All 12 Required items are now resolved**: every input is programmatically labeled (aria-label or htmlFor), error/success messages are announced (`role="alert"`/`role="status"`), a skip link + `<main id="main-content">` landmark cover every page, all pages have descriptive titles (`usePageTitle` / metadata template), the failing contrast combos were bumped to passing shades, and the carousel pauses on focus/touch and honors `prefers-reduced-motion`. Remaining nit-level polish is listed below.

## Checked

**Audited:** all of `app/` (auth ×4, dashboard + 3 widgets, profile + StudentDetails, teams + [id], tournaments + create/edit/[id]/matches/registrations/streams/predictions, matches + [id] + Checkin/ResultSection, live + [id], feedback, announcements, notifications, registrations, schedule, privacy/consent, admin/users + verification + feedback + activity + website editors, analytics + engagement + ReportParts, not-found, error, global-error, (site) layout + home + search + t/[id] + t/[id]/match) and all of `components/` (SiteHeader, SiteAuthButtons, SiteSearchBox, NotificationBell, Footer, HeroCarousel, PostCard, SiteParts, LiveRefresher, StarRating, PredictionPicker, PrivacyConsentCheckbox, AnnouncementCard, ShareButton, CalendarLinks, ExportButtons, ReportFilters, ReportChart, PageLoading, PageError, FacebookPlayer, TeamInvites, VerifiedBadge, Bracket).

**Essentially clean:** StarRating (input variant), PredictionPicker, ReportChart, ReportTable, ReportFilters, PageLoading/PageError/not-found/error/global-error, Bracket, CheckinSection, FeedbackPage (the best form in the codebase: wrapped labels + `role="alert"`/`role="status"`), FacebookPlayer, ShareButton, Footer/SiteHeader landmarks, (site) layout (`<main>` + `<nav>` + native `<details>` menu), destructive-action confirms everywhere.

**Has issues:** every auth page, profile (+ game profiles + change password), team create/edit/invite, tournament create/edit/register, announcements (compose + filter), streams form, admin/users, admin/feedback, schedule, live/[id], matches/[id], t/[id]/match, HeroCarousel, ImageField/ListEditor, NotificationBell, globals.css theme.

## Findings

**Critical:** none found: every interactive element is a real `<button>`/`<a>`/`<input>` (no clickable divs), and all destructive actions are confirmed.

### Required

**Forms: programmatic labels (WCAG 1.3.1 / 3.3.2 / 4.1.2)**

1. ~~**Placeholder-only labels are the dominant pattern.**~~ **RESOLVED:** every input/select/textarea below now has an `aria-label` or an associated `<label>` (verified by audit grep). Original list:
   - Login email + password: `app/auth/login/page.tsx:96-99`
   - Register full name, email, password, confirm: `app/auth/register/page.tsx:126-133` (only the role select is labeled, `:136-137`)
   - Forgot-password email: `app/auth/forgot-password/page.tsx:51-58`
   - Reset-password both fields: `app/auth/reset-password/page.tsx:72-83`
   - Team create name/select/description: `app/teams/page.tsx:116-140`
   - Team edit + invite search: `app/teams/[id]/page.tsx:264-270, 376-379`
   - Announcement title/body/tournament select: `app/announcements/page.tsx:239-253`; the page's filter select has no label either (`:137`)
   - Stream title/URL/match/status selects: `app/tournaments/[id]/streams/page.tsx:304-332`
   - Profile game-profile inputs + all 3 change-password inputs: `app/profile/page.tsx:267-282, 446-462`
   - Admin "Add account" all fields: `app/admin/users/page.tsx:383-400`; user search + role-filter selects: `:103-115`; inline name edit: `:219-221`
   - Admin verification search + reject reason: `app/admin/verification/page.tsx:138-143, 181-189`
   - Admin feedback both filter selects: `app/admin/feedback/page.tsx:187-200`
   - Schedule tournament-filter select: `app/schedule/page.tsx:142-151`
   - Result submit: dispute reason, staff reject note, **and the file input** (no label/aria-label at all): `app/matches/[id]/ResultSection.tsx:206-207, 240-241, 265-271`

2. ~~**"Ghost" labels**~~ **RESOLVED:** all listed ghost labels now have `htmlFor`/`id` pairs (tournament create/edit ×8 fields each, profile Full Name + DELETE confirm, registration team select).

3. ~~**Hidden file inputs are unreachable by keyboard.**~~ **RESOLVED:** both use `sr-only` instead of `hidden`, so they are focusable and activatable; the `ResultSection` proof input also gained an `aria-label`.

**Status messages (WCAG 4.1.3)**

4. ~~**Form errors are visually rendered but never announced.**~~ **RESOLVED:** all listed error divs have `role="alert"` and success messages `role="status"` (plus the dashboard widgets, ExportButtons and ImageField errors found during the sweep).

**Structure (WCAG 2.4.1, 1.3.1)**

5. ~~**No skip link anywhere**~~ **RESOLVED:** `app/layout.tsx` renders a visually-hidden-until-focused "Skip to content" link targeting `#main-content` before `<SiteHeader />`.

6. ~~**No `<main>` landmark on any logged-in page.**~~ **RESOLVED:** every page's topmost content wrapper is now `<main id="main-content">` (all conditional return paths covered; mutually exclusive, so never two `<main>`s in the DOM). The `(site)` layout's `<main>` also carries the id for the skip link.

7. ~~**Missing `<h1>` on two pages**~~ **RESOLVED:** `app/matches/[id]` has a real `<h1>`; `app/(site)/t/[id]/match/[matchId]` gained an `sr-only` "A vs B" `<h1>` (visual design preserved).

8. ~~**Every client page shares the tab title "DALTA Esports"**~~ **RESOLVED:** the root metadata now uses a `%s – DALTA Esports` template; all ~30 client pages call `usePageTitle()` and server pages export metadata.

**Contrast (WCAG 1.4.3)**

9. ~~**`bg-[#ff4444]` + white error banners ≈ 3.4:1**~~ **RESOLVED:** all five converted to the passing `bg-red-500/10 + text-red-300` pattern (with `role="alert"`).

10. ~~**`text-gray-500` on sitebg/sitecard ≈ 3.9:1, fails AA**~~ **RESOLVED:** every `text-gray-500`/`placeholder-gray-500` in `app/` and `components/` is now 400 (audit grep returns zero).

11. ~~**Colored action buttons fail**~~ **RESOLVED:** Generate Bracket/Approve → `bg-green-700` (`hover:bg-green-800` preserves the affordance); Reject/Revoke → `bg-red-600` (`hover:bg-red-700`); the bell's unread badge → `bg-red-600`.

**Keyboard/motion (WCAG 2.2.2, 2.1.1)**

12. ~~**HeroCarousel auto-advances every 5 s and can only be paused by hover**~~ **RESOLVED:** pauses on focus-within (`onFocusCapture`/`onBlurCapture`) and `onTouchStart`, and auto-advance is skipped entirely under `prefers-reduced-motion: reduce`.

### Nit

13. **NotificationBell dropdown:** ~~no Escape-to-close~~ (added) and ~~`aria-label="unread"` on a plain span~~ (`role="img"` added, both sites). Remaining: focus isn't moved into the panel or returned to the bell on close.
14. ~~**StarRating display variant**~~ **RESOLVED:** `role="img"` added so the label is announced.
15. **`prefers-reduced-motion` is never honored** (zero hits): `animate-pulse` loaders (`components/PageLoading.tsx:9-11`), `group-hover:scale-105` post images (`components/site/PostCard.tsx:17`), translate transitions throughout. Minor since most is decorative, but the carousel (Finding 12) is not.
16. **Focus indicator is a 1px border-color change:** every input uses `outline-none focus:border-gold` (brownlight→gold); present but very subtle. Links/buttons keep the browser ring (good). Consider `focus-visible:ring-2` on inputs.
17. **Realtime updates are visual-only**: live scoreboard (`app/live/[id]/page.tsx:190-215`), "Watching now" tile (`app/analytics/EngagementSection.tsx:33`), check-in countdown, and notification unread count update silently: no `aria-live="polite"`. Conversely `app/matches/[id]/page.tsx:100-112` reloads the whole page content on any realtime event, which can silently swap content under an SR user's cursor.
18. **Target size below 24px (WCAG 2.5.8)**: carousel dots are `w-2.5 h-2.5` (10px, `HeroCarousel.tsx:67`); ListEditor reorder buttons `px-2 py-1` are borderline (`ListEditor.tsx:309-312`); "Mark as read" is `text-xs` (`app/notifications/page.tsx:139`).
19. **Silent successes**: creating a team (`app/teams/page.tsx:75-79`), saving an announcement or stream just closes the form: the list updates but there's no confirmation message or announcement (unlike registration, which says "Registration submitted…").
20. **Naming drift**: header says "Log in" but the button says "Sign In" (`SiteAuthButtons.tsx:46` vs `login/page.tsx:106`); "Register" link vs "Sign Up" button. Check-in is consistently "Check in"/"Check-in": fine.
21. **Heading-level skips**: dashboard cards jump h1→h3 (`app/dashboard/page.tsx:176`), `AnnouncementCard` renders h3 with no parent h2 on `/announcements` when the form is closed.
22. **Disabled-until-consent submit**: register button is `disabled={loading || !consent}` (`app/auth/register/page.tsx:147`): disabled state gives no hint *why*; the required checkbox mitigates it but a `title`/aria-describedby hint would help.
23. **Whole-card link containing a fake button**: `app/tournaments/page.tsx:114-172` wraps the entire card in `<Link>` with a styled "View Tournament Details" span: SRs hear one very long link name; acceptable but verbose.
24. **Admin users "table" is styled divs**, not a `<table>`/list (`app/admin/users/page.tsx:122-147`): the header row (`:124-129`) is a `hidden md:grid` of divs with no semantic relationship to the rows below.
25. **Global-error `<title>` inside `<body>`:** `app/global-error.tsx:17` renders `<title>` in the body (works, but unconventional; move to `<head>`).
26. **Body font is hardcoded Arial** (`app/globals.css:39`) while Geist is loaded via `next/font` and never applied: wasted font download and inconsistent with `font-sans` utilities. *(Also in findings-k nit 8.)*

### FYI

- `formatDateTime` on client pages uses the *viewer's* time zone (`utils/tournaments.ts:117-125`); server-rendered public pages pin `Asia/Manila` and label it "(Philippine time)". Consistent for the PH audience; a non-PH organizer sees different wall times between the two surfaces.
- "Verify" on `app/admin/verification/page.tsx:202-205` is a one-click action with no confirm: revocable via "Revoke verification", so low risk.
- `autoFocus` on the reject-reason and edit-name inputs (`admin/verification/page.tsx:187`, `admin/users/page.tsx:221`) moves focus on render: acceptable in-context, mild for SR users.
- `/tournaments/[id]/page.tsx:270` treats `max_participants` null as unlimited (fine), but "∞" in the progress bar (`app/tournaments/page.tsx:143-146`) renders `max=1` with value=min(count, count): the bar always shows full for unlimited tournaments; cosmetic.

## Unverifiable locally

- Actual rendered contrast ratios (computed from hex values; anti-aliasing, monitor, and the `font-pixel` retro typeface at `text-[10px]` sizes may be worse in practice: the pixel font is a legibility risk at small sizes regardless of contrast).
- Screen-reader behavior (NVDA/JAWS/VoiceOver): whether `aria-label` on generic spans is announced, dropdown announcement order, realtime list re-announcement noise.
- Real-device testing: hamburger `<details>` behavior, carousel on touch, `type="datetime-local"` rendering, Facebook embed behavior with ad blockers.
- Whether focus-visible ring vs `focus:border-gold` reads as a sufficient indicator in practice.
