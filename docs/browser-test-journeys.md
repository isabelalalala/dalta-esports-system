# Browser Test Journeys: DALTA Esports

End-to-end user journeys for manual/agent browser testing (Playwright / Chrome DevTools MCP).
Each journey lists the actor, preconditions, the exact clicks/pages, and the pass criteria.
Journeys map back to the use cases in `docs/requirements.md` and `docs/new-features-summary.md`.

## Test fixtures needed first

Run these once (or keep them on a persistent dev project). Use separate browser
profiles/incognito windows per actor when a journey needs two users at once.

| Fixture | How to create |
|---|---|
| `admin@test.local` (role `admin`) | register, then `update profiles set role='admin'` in SQL Editor |
| `staff@test.local` (role `staff`) | same, promoted by admin on `/admin/users` |
| `captain-a@test.local`, `captain-b@test.local` (players, verified) | register, submit student details on `/profile`, verify via `/admin/verification` |
| `player-a@test.local`, `player-b@test.local` (players) | register; player-a joins captain-a's team |
| `spectator@test.local` | register (role spectator) |
| Team "Alpha" (game MLBB) captained by captain-a, with player-a as member | `/teams` → create → invite → accept |
| Team "Bravo" captained by captain-b | same |
| Tournament "Test Cup" (MLBB, registration open, `requires_verification` off for speed, or on, to test the rule) | `/tournaments/create` as admin |
| A scheduled match Alpha vs Bravo with both teams' registrations approved | approve on `/tournaments/[id]/registrations`, generate bracket, set `scheduled_at` on `/tournaments/[id]/matches` |

> For two-actor steps (invite/accept, submit/confirm, dispute/review) open the second
> user in a separate incognito window. Cookies don't leak between profiles.

---

## Journey group V: Visitor (no account)

### V1. Browse the public website
1. Open `/` (logged out) → hero, carousel, campaigns and events cards render.
2. Side nav → **About Us** (`/about`) → story/mission/vision; **Divisions** (`/divisions`)
   → pick a game → `/divisions/[game]` → pick an official team → `/divisions/[game]/[team]`
   shows captain + players with IGNs.
3. `/events`, `/campaigns`, `/community` all render published content only.
4. Footer present on every page ("Game With Purpose", © DALTA Esports).

**Verifies:** Module 7 public pages; `is_published` filtering.

### V2. Search
1. `/search` (or the header search) → search a tournament name, an event, a campaign.
2. Results grouped correctly; each links to its page.

**Verifies:** Visitor search across D2 + D6.

### V3. View a public tournament + match (no login)
1. `/t/[id]` on "Test Cup" → info, rules, bracket, schedule render; **no** login prompt.
2. `/t/[id]/match/[matchId]` → team names, score area, prediction split percentages visible
   (counts only, never who picked).
3. **Add to calendar** → `.ics` downloads (Google/Apple/webcal links present via
   `/calendar/[kind]/[id]`).
4. **Share** → copy link; (optional) paste the URL into a link-preview checker → OG image/text.

**Verifies:** public read-only functions, calendar files, OG previews, split for visitors.

### V4. Visitor cannot reach member pages
1. Logged out, hit `/dashboard`, `/feedback`, `/teams`, `/admin/users` directly.
2. Each redirects to `/auth/login` (with `next=` preserved where implemented).

**Verifies:** `proxy.ts` auth gate.

---

## Journey group A: Any logged-in actor

### A1. Register → confirm email → consent → dashboard
1. `/auth/register` → fill form; privacy-consent checkbox is required (submit blocked without it).
2. "Check your email" state → click the confirmation link → lands on `/auth/callback` →
   `/auth/login?confirmed=1` with the confirmed banner → log in → `/dashboard`.
3. First visit to a protected page with consent already on record passes straight through.

**Verifies:** sign-up, `handle_new_user` profile, consent at registration, callback flow.

### A2. Login / logout / wrong password
1. `/auth/login` bad password → inline error, stays on page.
2. Good credentials → `/dashboard`. Log out → back to public site; `/dashboard` now redirects to login.

### A3. Forgot / reset password
1. `/auth/forgot-password` → email → click reset link → `/auth/reset-password` → set new password.
2. Log in with the new password works; old password rejected.

**Verifies:** recovery template → `/auth/callback?type=recovery` path.

### A4. Re-consent after privacy notice bump *(needs a version bump or a stale-consent account)*
1. An account whose `privacy_consent_version` ≠ current visits any protected page.
2. Redirected to `/privacy/consent`; can't navigate away to other protected pages (proxy re-redirects).
3. Accept → back to the page requested; gate no longer triggers.

**Verifies:** the proxy consent gate (not just the dashboard fallback).

### A5. Notifications
1. Trigger an event for the user (e.g. admin posts an announcement).
2. Bell badge increments **without reload** (Realtime); click → `/notifications`; mark read → badge clears.

**Verifies:** Realtime notifications end-to-end.

### A6. Profile edit + account deletion
1. `/profile` → edit name → saved and reflected in header/pages.
2. Delete own account → signed out; logging in again fails. *(Destructive: run last / on a throwaway account.)*

---

## Journey group S: Spectator / Audience

### S1. Submit general + tournament feedback, see sentiment
1. `/feedback` → submit rating + comment (general). Confirmation shown.
2. Submit tournament-scoped feedback for "Test Cup" → accepted.
3. Try a second general feedback → blocked (one per target).
4. As admin on `/admin/feedback`: row shows sentiment + topics (or "pending analysis" with reason if
   Gemini key/rate limit is off, both are valid observable states).

**Verifies:** Module 5 collection + classification + the one-per-target rule.

### S2. Pick'em predictions
1. On `/tournaments/[id]` or `/matches/[id]` → pick a winner for the scheduled match → saved; split % updates.
2. Change the pick → allowed; remove it → allowed.
3. After the match goes live / `scheduled_at` passes → picker is locked (control disabled).
4. `/tournaments/[id]/predictions` → leaderboard shows names as "First name + initial".

**Verifies:** Module 8 pick lifecycle, lock trigger, anonymized split.

### S3. Watch a live stream + "watching now"
1. `/live` → open a live stream → `/live/[id]` → Facebook embed (lazy) renders.
2. "Watching now" count ≥1 for this viewer; open a second incognito spectator → count becomes 2;
   close one → drops back.
3. Engagement page later shows the view row (per-day unique).

**Verifies:** Realtime presence + `stream_views` insert.

### S4. Schedule & announcements
1. `/schedule` → live/upcoming/finished sections match actual match states.
2. `/announcements` → admin-posted announcement visible (pinned first).

---

## Journey group P: Player

### P1. Student verification
1. `/profile` → submit student ID, school, course/year → status **pending**.
2. As admin/staff on `/admin/verification` → approve → player sees **verified** badge on roster/search.
3. Reject path (second fixture): reject with a reason → player sees the note.

**Verifies:** verification lifecycle + notification to the player.

### P2. Game profile + team invite (accept)
1. `/profile` → add MLBB game profile (IGN, role, rank).
2. captain-a invites player-b by IGN → player-b's bell notifies; `/teams` shows pending invite.
3. Accept → appears in Alpha's roster; captain gets the answer notification.
4. Decline path (other invite) → roster unchanged.

**Verifies:** `search_players`, `respond_to_team_invite`, roster update, both notifications.

### P3. Leave team / roster lock
1. While Alpha is registered (pending/approved) for an open tournament → player tries to leave →
   blocked by roster lock.
2. After the tournament ends or registration cancelled → leave succeeds.

### P4. Player picks restriction
1. captain-a/player-a try to pick a match Alpha plays in → picker unavailable/disallowed.
2. Same players can pick other teams' matches.

---

## Journey group C: Team Captain

### C1. Create team + build roster
1. `/teams` → create "Alpha" (MLBB) → captain auto-added.
2. Invite by IGN search; roster shows members; roster size limits enforced (5-6 for MLBB).
3. Remove a member → notification sent; transfer captaincy → roles swap.

### C2. Register team for a tournament
1. `/tournaments/[id]` → register Alpha → appears as **pending** on `/registrations`.
2. Verification-required tournament + unverified member → registration blocked with a clear message.
3. Captain cancels a pending registration → row gone; approved one can't be cancelled by captain.

### C3. Check-in
1. With `scheduled_at` inside the check-in window → `/matches/[id]` → **Check in** → recorded
   (one per team; both teams check in).
2. Outside the window → button disabled/unavailable.
3. Staff dashboard "Needs attention" lists a match whose teams haven't checked in.

### C4. Submit result + screenshot
1. `/matches/[id]` (match live/past time) → submit score + upload PNG proof → submission **pending**;
   other captain notified.
2. As captain-b → **confirm** → status `confirmed`, staff notified. Match completes on staff approval
   and the winner advances in the bracket (visible on `/tournaments/[id]`).

### C5. Dispute path
1. Repeat submission on a second match → captain-b **disputes** with a reason → `disputed`.
2. Staff overrides with their own score → `overridden`; match completes; `is_forfeit` unaffected.

---

## Journey group T: Tournament Staff

### T1. Create tournament + build bracket
1. `/tournaments/create` → "Test Cup" (MLBB, dates, deadline, check-in window).
2. `/tournaments/[id]/registrations` → approve Alpha + Bravo (+more for a real bracket).
3. Generate bracket → round-1 pairings correct, byes auto-completed, `next_match_id` wiring
   visible as winners advance.
4. Edit a match's `scheduled_at` on `/tournaments/[id]/matches` → both teams' captains notified;
   existing check-ins are cleared.

### T2. Match-day operations
1. `/dashboard` "Needs attention" → `no_checkin` / `result_*` rows link to `/matches/[id]`.
2. Past `scheduled_at` with a missing check-in → **Declare forfeit** → match completes,
   `is_forfeit` set, winner advances, both teams notified.

### T3. Review match results
1. `result_confirmed` in Needs attention → `/matches/[id]` → approve → final score + winner set.
2. Reject path → note required; submission `rejected`; match stays open for resubmission.

### T4. Streams
1. `/tournaments/[id]/streams` → add a Facebook Live URL → invalid URL rejected; valid saved.
2. Set status `live` → appears on `/live`; set `ended` → leaves live list.

### T5. Staff restrictions
1. As staff: `/admin/users`, `/admin/website`, `/admin/activity`, `/admin/feedback` → blocked/not
   nav-visible (staff can't read feedback, only counts via reports).
2. Staff **can** reach `/analytics/engagement` and exports.

**Verifies:** role gates enforced by RLS, not just hidden UI.

---

## Journey group M: Admin (everything staff does, plus)

### M1. User management
1. `/admin/users` → **Add account** → invited user gets a confirmation email that lands through
   `/auth/callback` (same flow as self-register).
2. Promote a user to staff; demote again. Attempt to demote the **last admin** → blocked.
3. Delete a user → their feedback/`created_by` survive with nulls (no cascade damage).

### M2. Sentiment retry
1. With Gemini key unset → a feedback row sits "pending analysis".
2. `/admin/feedback` → retry → row classified or shows the honest error message
   ("gave up after N tries" once capped).

### M3. Reports & exports
1. `/analytics` → generate activity/engagement reports for a date range → charts render
   (respecting the date filter, not lifetime counts).
2. Save a report → `/analytics/reports/[id]` reopens it; print/PDF view works.
3. Export CSV/XLSX (registrations, accounts, feedback) → files download; export appears in
   `/admin/activity`.

### M4. Activity log
1. `/admin/activity` → filter by `result.*`, `match.edited`, `tournament.cancelled` → entries
   match actions performed in earlier journeys.

### M5. Website content management
1. `/admin/website` → edit a `site_content` text → visible on the public page after refresh.
2. Add a campaign/event with an uploaded image → published toggle hides/shows it publicly;
   reorder changes `display_order`.
3. Officers/divisions/official teams edits reflect on `/community`, `/divisions`.

### M6. Cancel a tournament
1. Cancel "Test Cup" → members of pending/approved teams get `tournament_cancelled`
   notifications; public page reflects the cancellation.

---

## Journey group X: Cross-cutting / end-to-end scenarios

### X1. Full match lifecycle (the capstone demo path)
Fixtures → register teams → approve → bracket → schedule → check-in both teams → captain submits
score+proof → other captain confirms → staff approves → winner advanced in bracket → picks marked
correct/wrong → leaderboard updated → feedback submitted on the match → sentiment visible.
**One continuous pass touching modules 2, 3, 4, 5, 6, 8.**

### X2. Realtime concurrency
Two windows side by side: staff updates a score / posts an announcement → the other window's
bracket, bell badge, and `/schedule` update **without reload** (debounced ~500 ms).

### X3. RLS negative checks
- Spectator hits `/admin/*`, `/analytics` → blocked.
- Player opens another user's notification/feedback URL → no data.
- Direct fetch of a `match-proofs` signed URL as an unrelated user → denied.

### X4. Accessibility smoke (per page-template, not every page)
Keyboard-only: skip link → main landmark → forms operable; labels announced; error banners
`role="alert"`; carousel pauses on focus; `prefers-reduced-motion` honored.

### X5. Mobile viewport smoke
375×812: nav, bracket scroll, forms, tables/cards usable; no horizontal overflow on the journeys above.

---

## Coverage map

| Module / process | Journeys |
|---|---|
| 1 Accounts (auth, consent, verification) | A1-A6, P1, M1 |
| 2 Registration & tournaments (invites, check-in, results) | P2-P4, C1-C5, T1-T3, X1 |
| 3 Event info (announcements, public pages, calendar, notifications) | S4, V3, A5, M6, X2 |
| 4 Streaming (streams, presence) | S3, T4 |
| 5 Feedback & sentiment | S1, M2 |
| 6 Reports & exports | T5, M3-M4 |
| 7 Public website | V1-V2, M5 |
| 8 Pick'em | S2, P4, X1 |
| Cross-cutting (gates, RLS, realtime, a11y, mobile) | V4, T5, X2-X5 |

## Execution notes

- Run order: V → A → S → P → C → T → M → X (fixtures build on each other). A6 (delete) last.
- Gemini-dependent assertions accept either "classified" or "pending analysis + honest reason":
  both are correct states; record which was observed.
- Presence and debounced reloads need real timing: don't assert faster than ~1-2 s.
- Reset heavy state between runs: delete test tournament/matches/submissions/notifications.
