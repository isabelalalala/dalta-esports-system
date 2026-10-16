# DALTA Esports – Features Added Beyond the Original 6 Modules

This document lists every feature that was built **after** (or on top of) the six modules in the business case,
so the business case, Context Flow Diagram (CFD), Data Flow Diagram Level 1 (DFD) and Use Case diagrams can be
updated to match the final system.

- The **original scope** is in `docs/requirements.md` (sections "Actors", "Data stores", "Processes").
- For each feature you'll find: the **module** it belongs to (or a proposed new module), **new actors / use cases**,
  **new data flows** (written as `Source → Process: flow name`), and **new database tables** (plus important new
  columns, storage buckets and functions).
- Section 1 is a quick overview; Section 2 lists the changes to make in each diagram; Section 3 has the details per
  feature; Section 4 lists quality improvements that don't change any diagram.

---

## 1. Overview

| # | Feature | Module | New tables / storage | Migration(s) |
|---|---------|--------|----------------------|--------------|
| 1 | Account security & Data Privacy Act consent | 1 Account Management | (new columns on `profiles`) | `202610170900_privacy_consent` |
| 2 | Student verification | 1 Account Management (+ eligibility rule in 2) | (new columns on `profiles`, `tournaments`) | `202610171000_student_verification` |
| 3 | Team invites & roster management | 2 Registration & Tournament Mgmt | `team_invites` | `202610171300_team_invites` |
| 4 | Match check-in & forfeits | 2 Registration & Tournament Mgmt | `match_checkins` | `202610171400_match_checkin` |
| 5 | Captain result submission, disputes & staff review | 2 Registration & Tournament Mgmt | `match_result_submissions`, bucket `match-proofs` | `202610171500_match_results` |
| 6 | In-app notifications | 3 Event Information & Announcements | `notifications` | `202610171200_notifications` (+ later ones add types) |
| 7 | Public tournament & match pages, link previews, calendar files, sharing | 3 Event Information & Announcements | – (read-only functions) | `202610171800_public_tournaments` |
| 8 | Admin-editable public website | **7 Public Website & Content Management (new)** | `site_content`, `hero_images`, `campaigns`, `events`, `game_divisions`, `officers`, `official_teams`, `official_team_players`, bucket `site-images` | `202610171600_public_website` |
| 9 | Feedback protection (one per item, instant AI analysis, rate limit, retry) | 5 Feedback & Sentiment Analysis | `gemini_calls` (+ new columns on `feedback`) | `202610181000_feedback_protection` |
| 10 | Pick'em predictions & leaderboard | **8 Audience Engagement – Pick'em (new)** | `predictions` | `202610181100_predictions` |
| 11 | Activity (audit) log | 6 Administrative Reports ("System Report") | `activity_logs` | `202610171100_activity_log` |
| 12 | Excel / CSV exports | 6 Administrative Reports | – (logged in `activity_logs`) | `202610171700_export_log` |
| 13 | Enhancements inside the original modules (saved reports, "watching now", engagement additions) | 4, 6 | – | `202610162300_admin_reports`, `202610181100_predictions` |

---

## 2. What to change in each document

### 2.1 Business case
- **Objectives:** add to Specific Objective 2 "…and public tournament pages that work without an account, with
  calendar and sharing links". Add to Objective 3 "…and audience engagement through pick'em predictions".
- **Scope / modules:** add **Module 7: Public Website & Content Management** and **Module 8: Audience Engagement
  (Pick'em Predictions)**. Optionally mention the cross-cutting services: notifications, activity log, and
  Data Privacy Act compliance (RA 10173).
- **Compliance:** the system follows the Data Privacy Act (RA 10173). It has a public Privacy Notice, consent at
  registration, re-consent when the notice changes, account self-deletion, and retention rules (activity log
  1 year, read notifications 90 days, AI rate-limit records 1 day).
- **Budget:** still ₱0. Everything uses free tiers: Supabase (database, auth, storage, Realtime, pg_cron, Vault),
  the Gemini free tier with a built-in rate limit, Railway, and Facebook embeds.

### 2.2 Context Flow Diagram (external entities)
| Entity | New? | Flows with the system |
|--------|------|------------------------|
| Organizing Committee / Administrator | existing | + website content, student review, result review, activity log, exports, retry AI analysis |
| Tournament Staff / Game Administrator | existing | + student review, check-in monitoring, forfeits, result review, exports |
| Players | existing | + team invites, check-in, result + screenshot, student details, privacy consent, picks |
| Audience / Spectator | existing | + picks, community split, leaderboard, notifications |
| **Visitor (not logged in)** | **new** | Public website pages, public tournament/match pages, community pick split, calendar files, search |
| **Email Service (Supabase Auth)** | **new** | Confirmation email, password reset email |
| **Calendar Application** (Google Calendar, Apple, Outlook) | **new** | Calendar file / subscription (.ics, webcal) |
| **Social Media (Facebook / Messenger)** | **new** | Link previews (Open Graph image + text), shared links |
| Google Gemini API | existing | Same, but now called when feedback is sent (rate-limited), and by the admin retry |
| Facebook Live | existing | unchanged |
| **System Scheduler (pg_cron)** | **new (time actor)** | Every 5 minutes: "check-in open" notifications |

### 2.3 DFD Level 1
**New data stores** (or merge them into existing ones if your instructor prefers fewer stores):

| Store | Tables / storage |
|-------|------------------|
| D1 User Account DB (existing) | + consent and student-verification columns on `profiles` |
| D2 Tournament & Schedule DB (existing) | + `team_invites`, `match_checkins`, `match_result_submissions`, bucket `match-proofs` |
| D4 Feedback DB (existing) | + new `feedback` columns, `gemini_calls` (AI rate-limit counter) |
| D5 Analytics & Engagement DB (existing) | `analytics_reports`; the engagement report now also compiles predictions |
| **D6 Website Content DB** | `site_content`, `hero_images`, `campaigns`, `events`, `game_divisions`, `officers`, `official_teams`, `official_team_players`, bucket `site-images` |
| **D7 Notifications DB** | `notifications` |
| **D8 Activity Log DB** | `activity_logs` |
| **D9 Predictions DB** | `predictions` |

**New processes:** **7.0 Manage Public Website** and **8.0 Manage Pick'em Predictions**. The existing processes
1.0–6.0 gain the flows listed per feature in Section 3. Notifications are written by processes 1.0–3.0 into D7 and
read by every logged-in actor. The activity log is written by 1.0–4.0 and 6.0 into D8 and read by the admin
through 6.0.

### 2.4 Use case diagrams
- **New actor:** *Visitor* (not logged in). *Team Captain* is a specialization of *Player*: draw it with a
  generalization arrow from Captain to Player.
- **New use cases**, per actor, are listed in each feature below. Most "manage" use cases **include** *Login*.
  Visitor use cases don't.

---

## 3. Feature details

### Feature 1 – Account security & Data Privacy Act consent
**Module:** 1 Account Management

**What it does:** forgot/reset password by email, email confirmation (with resend), a public Privacy Notice,
a required consent checkbox at registration, and re-consent whenever the notice changes. Users can also delete
their own account.

**Actors / use cases**
- All actors: *Reset password* (extends *Login*), *Confirm email*, *Resend confirmation email*,
  *Give privacy consent* (included in *Register*, and asked again after the notice changes),
  *View Privacy Notice* (also Visitor).

**Data flows**
- User → 1.0: Password reset request; 1.0 → Email Service: Reset email; Email Service → User: Reset link.
- User → 1.0: New password → D1: Update credential.
- 1.0 → Email Service: Confirmation email; User → 1.0: Confirmation link → D1: Verified account.
- User → 1.0: Privacy consent (version) → D1: Save consent record.
- 1.0 → User: Re-consent request (when the notice version changed).

**Database**
- `profiles` new columns: `privacy_consent_at`, `privacy_consent_version`.
- Function: `give_privacy_consent(version)`.

### Feature 2 – Student verification
**Module:** 1 Account Management. It also adds an eligibility rule to Module 2.

**What it does:** players enter their student ID, school and course/year. Admin or staff verify or reject them,
with a reason. Tournaments can be marked "verified students only", and every team member must then be verified
before the team can register, be approved or add members. Other users only see a "Verified" badge.

**Actors / use cases**
- Player: *Submit student details*, *View verification status*.
- Admin, Staff: *Review student verification* (approve / reject / revoke with a reason).
- Admin, Staff: *Require verified students* (extends *Create / edit tournament*).

**Data flows**
- Player → 1.0: Student details → D1: Save student details (status becomes "pending").
- Admin/Staff → 1.0: Verification decision → D1: Update status. 1.0 → D7: Verification notification → Player.
- 2.0 → D1: Check verification (when registering or approving a team).

**Database**
- `profiles` new columns: `student_id`, `school`, `course_year`, `verification_status`, `is_verified`,
  `verification_note`, `submitted_at`, `reviewed_by`, `reviewed_at`. Rule: one account per student ID per school.
- `tournaments` new column: `requires_verification`.
- Function: `review_student_verification(user, approve, note)`.

### Feature 3 – Team invites & roster management
**Module:** 2 Registration and Tournament Management

**What it does:** the captain searches players by IGN or name and invites them, and the player accepts or declines.
Members can leave, and the captain can remove a member or hand over the captaincy. Rosters are locked while the team
is registered for a tournament that hasn't ended. Roster sizes come from each game.

**Actors / use cases**
- Team Captain: *Search players*, *Invite player*, *Cancel invite*, *Remove member*, *Transfer captaincy*.
- Player: *Accept / decline team invite*, *Leave team*.

**Data flows**
- Captain → 2.0: Player search → D1/D2: Fetch player profiles (IGN, role, verified badge).
- Captain → 2.0: Team invite → D2: Save invite → D7: Invite notification → Player.
- Player → 2.0: Invite answer → D2: Update team members → D7: Answer notification → Captain.
- Captain/Player → 2.0: Leave / remove / transfer → D2: Update roster → D7: Notification.

**Database**
- New table: **`team_invites`** (`id`, `team_id`, `invited_user_id`, `invited_by`,
  `status` pending/accepted/declined/cancelled, `created_at`, `responded_at`).
- Functions: `respond_to_team_invite()`, `transfer_team_captaincy()`, `get_my_team_invites()`,
  `get_team_invites()`, `search_players()`.

### Feature 4 – Match check-in & forfeits
**Module:** 2 Registration and Tournament Management (match operations). It supports Module 4's
"Real-Time Match Management".

**What it does:** captains check in during a window before the match (30 minutes by default; set per tournament).
Both captains get a notification when check-in opens. Staff see matches with a missing check-in on the dashboard
("Needs attention") and can declare a forfeit after the match time.

**Actors / use cases**
- Team Captain: *Check in for match*.
- Staff/Admin: *Monitor check-ins* ("Needs attention"), *Declare forfeit*.
- System Scheduler: *Send check-in reminders*.

**Data flows**
- Captain → 2.0: Check-in → D2: Save check-in.
- Scheduler → 2.0: Every 5 minutes → D2: Find matches whose check-in opened → D7: Check-in notification → Captains.
- Staff → 2.0: Forfeit decision → D2: Complete match (the winner advances) → D7: Forfeit notification → both teams.
- 2.0 → Staff: Needs-attention list.

**Database**
- New table: **`match_checkins`** (`match_id`, `team_id`, `checked_in_by`, `checked_in_at`; one per team).
- `tournaments` new column: `checkin_window_minutes`. `matches` new columns: `is_forfeit`,
  `checkin_notified_at`.
- Functions: `check_in_match()`, `declare_forfeit()`, `get_needs_attention()`,
  `send_checkin_open_notifications()` (pg_cron job `dalta-checkin-open-notifications`).

### Feature 5 – Result submission, disputes & staff review
**Module:** 2 Registration and Tournament Management (DFD flow "Tournament Rule & Match Result")

**What it does:** after a match, a captain submits the score with a screenshot. The other captain confirms it or
disputes it with a reason. Staff then approve it, override it with their own score, or reject it with a note.
Approval completes the match, and the winner advances in the bracket.

**Actors / use cases**
- Team Captain: *Submit match result* (includes *Upload screenshot*), *Confirm / dispute result*.
- Staff/Admin: *Review match result* (approve / override / reject).

**Data flows**
- Captain → 2.0: Score + screenshot → D2: Save submission + proof file → D7: Notification → other captain.
- Other captain → 2.0: Confirmation / dispute → D2 → D7: Notification → staff.
- Staff → 2.0: Review decision → D2: Final result, winner advances → D7: Result notification → teams.
  This also feeds 8.0, which marks the picks (Feature 10).

**Database**
- New table: **`match_result_submissions`** (`match_id`, `team_id`, `submitted_by`, `score_a/b`, `proof_path`,
  `status` pending/confirmed/disputed/approved/overridden/rejected, `dispute_reason`, `responded_by/at`,
  `review_note`, `final_score_a/b`, `reviewed_by/at`, `created_at`).
- Storage: private bucket **`match-proofs`** (screenshots; only the two teams and staff can view them).
- Functions: `submit_match_result()`, `respond_to_match_result()`, `review_match_result()`.

### Feature 6 – In-app notifications
**Module:** 3 Event Information and Announcements (it carries the DFD output "Announcement and Match Update"),
but the notifications are created by several processes.

**What it does:** a bell icon in the header shows the unread count, updated live, and `/notifications` lists them
all. Notifications are sent for: registration approved/rejected; match time set or changed; match live; check-in
open; forfeit; results submitted, confirmed, disputed, approved or rejected; new announcement; team invite and
answer; member left or removed; new captain; student verified, rejected or revoked.

**Actors / use cases**
- All logged-in actors: *View notifications*, *Mark notification as read*.

**Data flows**
- 1.0 / 2.0 / 3.0 → D7: Save notification (created only by the database, never by the app directly).
- D7 → User (Realtime): New notification. User → D7: Read status.

**Database**
- New table: **`notifications`** (`user_id`, `type`, `title`, `message`, `link`, `is_read`, `created_at`).
- Function: `purge_old_notifications()` (read notifications older than 90 days; run by hand).

### Feature 7 – Public tournament & match pages, link previews, calendar, share
**Module:** 3 Event Information and Announcements (information for the audience, now also without an account)

**What it does:** `/t/[id]` and `/t/[id]/match/[matchId]` show tournament info, rules, team names, the bracket,
schedule, results and the live stream. Visitors don't need to log in, and scores update live. The pages have link
previews with a generated image for Facebook and Messenger, "Add to calendar" / "Subscribe" (.ics), and Share
buttons.

**Actors / use cases**
- Visitor (and all actors): *View public tournament page*, *View public match page*, *Add match/tournament/team to
  calendar*, *Share tournament or match*.

**Data flows**
- Visitor → 3.0: Public page request → D2: Fetch public tournament data (team names only) → Visitor.
- Visitor → 3.0: Calendar request → D2 → Calendar Application: Calendar file / subscription.
- Social Media → 3.0: Preview request → Social Media: Preview image + text.

**Database**
- No new tables. Read-only functions `get_public_tournament()` and `get_public_calendar()`. They are safe for
  visitors because they return team names only.

### Feature 8 – Admin-editable public website
**Module:** **7 Public Website & Content Management (new)**. The client's wireframe pages existed in
`requirements.md`, but no module covered them.

**What it does:** the public organization website: Home (hero, carousel, campaigns, events), About, Game Divisions
→ official teams → team page, Events, Campaigns, Community (members, coaches, core officers, division heads,
committees), and Search. Admins edit every text and image on `/admin/website`, and can reorder, publish or hide
items.

**Actors / use cases**
- Visitor (and all actors): *View website pages*, *Search tournaments/events/campaigns*.
- Admin: *Edit site text*, *Manage carousel*, *Manage campaigns*, *Manage events*, *Manage divisions*,
  *Manage officers*, *Manage official teams & players*, *Upload images* (included in the "Manage" use cases).

**Data flows**
- Admin → 7.0: Website content / images → D6: Save content.
- Visitor → 7.0: Page request → D6: Fetch published content → Visitor: Website page.
- Visitor → 7.0: Search → D2 + D6 → Visitor: Search results.

**Database**
- New tables: **`site_content`** (key/value texts), **`hero_images`**, **`campaigns`**, **`events`**,
  **`game_divisions`**, **`officers`**, **`official_teams`**, **`official_team_players`** (each has
  `display_order` and `is_published`).
- Storage: public bucket **`site-images`**.

### Feature 9 – Feedback protection
**Module:** 5 Feedback and Sentiment Analysis

**What it does:**
- One feedback per user per tournament, per match, and one general feedback. Feedback can now be about one match.
- The comment is analysed by Gemini **when it's sent** (the use case "classify sentiment" is included in
  "submit feedback").
- A server-side rate limit protects the free quota.
- If Gemini fails or the limit is reached, the feedback is saved as **"pending analysis"**, with the reason.
  An admin can **retry pending analysis**.
- Only the server can save sentiment, and the Gemini API key never reaches the browser.

**Actors / use cases**
- Audience/Player: *Submit feedback & rating* (includes *Classify sentiment*), with the new option *About a
  match*.
- Admin: *Retry pending analysis*, *View analysis errors*.

**Data flows**
- Audience → 5.0: Feedback and rating → D4: Save raw feedback.
- 5.0 → D4: Check AI rate limit. 5.0 → Gemini: Comment (no name or email). Gemini → 5.0: Sentiment + topics.
- 5.0 → D4: Save sentiment score, or a pending-analysis reason.
- 5.0 → Audience: Feedback confirmation.
- Admin → 5.0: Retry request → D4: Pending feedback → Gemini → D4.

**Database**
- New table: **`gemini_calls`** (rate-limit counter: `user_id`, `items`, `called_at`; rows deleted after 1 day).
- `feedback` new columns: `match_id`, `target_removed`, `analysis_attempts`, `analysis_error`,
  `analysis_attempted_at`. New rule: one feedback per user per target.
- Functions: `claim_gemini_call()`, `save_feedback_sentiment()`, `mark_feedback_pending()` (these work only with
  the server key stored in Supabase Vault).

### Feature 10 – Pick'em predictions & leaderboard
**Module:** **8 Audience Engagement – Pick'em Predictions (new)**. Its statistics feed Module 6.

**What it does:**
- Spectators and players pick the winner of upcoming matches on the match pages and under each bracket match.
- Picks lock when the match goes live or its scheduled time passes.
- Players can't pick their own team's matches, and organizers can't pick at all.
- Everyone, including visitors, sees the community split (e.g. 62% / 38%), never who picked what.
- When a result is final, picks are marked correct or wrong automatically.
- Each tournament has a leaderboard. Names are shown as "first name + initial", to logged-in users only.

**Actors / use cases**
- Audience/Player: *Pick match winner* (change or remove it before the lock), *View community split*,
  *View pick'em leaderboard*.
- Visitor: *View community split*.
- System: *Mark predictions* (triggered by *Review match result* / *Declare forfeit*).

**Data flows**
- Audience → 8.0: Pick → D9: Save prediction (checked against D2: match status, time, teams).
- Visitor/Audience → 8.0: Split request → D9 → Community split (percentages only).
- 2.0 → 8.0: Final result (winner) → D9: Mark picks correct or wrong.
- Audience → 8.0: Leaderboard request → D9 + D1 (short name) → Leaderboard.
- 6.0 → D9: Fetch prediction stats → D5: Engagement report.

**Database**
- New table: **`predictions`** (`id`, `user_id`, `match_id`, `predicted_winner_team_id`, `is_correct`,
  `created_at`, `updated_at`). Rule: one pick per user per match.
- Functions: `get_prediction_split()`, `get_prediction_leaderboard()`. Triggers `check_prediction()` and
  `mark_predictions()`.

### Feature 11 – Activity (audit) log
**Module:** 6 Administrative Reports (the DFD output "Overall Tournament Activity & System Report")

**What it does:** the system records important actions automatically, with who did them and when. These include
tournament changes, registration decisions, bracket generation, match results, role changes, student reviews,
account deletion, announcements, streams and exports. Admins browse the log on `/admin/activity` with filters.
Entries are kept for one year.

**Actors / use cases**
- Admin: *View activity log* (filter by action, user, date).

**Data flows**
- 1.0 / 2.0 / 3.0 / 4.0 / 6.0 → D8: Activity record (written by the database).
- Admin → 6.0: Activity log request → D8 → Admin: Activity log.

**Database**
- New table: **`activity_logs`** (`actor_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`).
- Functions: `activity_log_actors()`, `purge_old_activity_logs()`.

### Feature 12 – Excel / CSV exports
**Module:** 6 Administrative Reports

**What it does:** download registrations, team rosters, schedule & results (admin/staff), anonymous feedback and
the user list (admin only) as Excel or CSV. Every download is recorded in the activity log first.

**Actors / use cases**
- Admin, Staff: *Export data* (includes *Record export* in the activity log).

**Data flows**
- Admin/Staff → 6.0: Export request → D1/D2/D4: Fetch data → D8: Export record → Admin/Staff: Excel/CSV file.

**Database**
- No new table (entries go to `activity_logs`). Function: `log_export()`.

### Feature 13 – Enhancements inside the original modules
These additions stay inside existing modules but add flows you may want to draw.
- **Module 4:** "Watching now" live viewer count (Supabase Realtime Presence, not stored). Staff see it on the
  engagement page.
- **Module 6:** generated reports are **saved** (`analytics_reports`, D5) and can be printed or saved as PDF, or
  downloaded as CSV. The engagement report now also includes predictions, predictors, prediction accuracy and
  participation (share of player/spectator accounts that made at least one pick), plus a table per tournament.
- **Module 5:** sentiment now includes **topics** (up to 3 per comment). "Common concerns" are the topics on
  negative feedback.

---

## 4. Quality improvements (no diagram changes)
- **Mobile:** every page works at 375px phone width without sideways scrolling. Wide content (bracket, tables)
  scrolls inside its own box.
- **Loading, empty and error states:** one loading screen everywhere, "No … yet" messages, plain-language errors
  (no raw database messages), and custom 404 and error pages.
- **Security hardening:**
  - Role changes are only possible for admins, and the last admin can't be removed.
  - Rules are enforced in the database (RLS and triggers), not only in the screens.
  - No service role key is used.
  - The AI key is server-only (the build fails if it could reach the browser).
- **One visual style** (DALTA yellow/brown, pixel headings) for public and logged-in pages.
