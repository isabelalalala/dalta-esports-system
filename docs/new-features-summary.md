# DALTA Esports: Features Added Beyond the Original 6 Modules

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
| 3 | Team invites, team directory, join requests & roster management | 2 Registration & Tournament Mgmt | `team_invites`, `team_join_requests` (+ `teams.recruiting`) | `202610171300_team_invites`, `202611011300_team_join_requests` |
| 4 | Match check-in & forfeits | 2 Registration & Tournament Mgmt | `match_checkins` | `202610171400_match_checkin` |
| 5 | Captain result submission, disputes & staff review | 2 Registration & Tournament Mgmt | `match_result_submissions`, bucket `match-proofs` | `202610171500_match_results` |
| 6 | In-app notifications | 3 Event Information & Announcements | `notifications` | `202610171200_notifications` (+ later ones add types) |
| 7 | Public tournament & match pages, link previews, calendar files, sharing | 3 Event Information & Announcements | - (read-only functions) | `202610171800_public_tournaments` |
| 8 | Admin-editable public website | **7 Public Website & Content Management (new)** | `site_content`, `hero_images`, `campaigns`, `events`, `game_divisions`, `officers`, `official_teams`, `official_team_players`, bucket `site-images` | `202610171600_public_website` |
| 9 | Feedback protection (one per item, instant AI analysis, rate limit, retry) | 5 Feedback & Sentiment Analysis | `gemini_calls` (+ new columns on `feedback`) | `202610181000_feedback_protection` |
| 10 | Pick'em predictions & leaderboard | **8 Audience Engagement: Pick'em (new)** | `predictions` | `202610181100_predictions` |
| 11 | Activity (audit) log | 6 Administrative Reports ("System Report") | `activity_logs` | `202610171100_activity_log` |
| 12 | Excel / CSV exports | 6 Administrative Reports | - (logged in `activity_logs`) | `202610171700_export_log` |
| 13 | Enhancements inside the original modules (saved reports, "watching now", engagement additions) | 4, 6 | - | `202610162300_admin_reports`, `202610181100_predictions` |
| 14 | Terms of Service acceptance & legal pages (/terms, /conduct, /cookies, /security) | 1 Account Management | (new columns on `profiles`) | `202610181900_tos_consent` |
| 15 | Role-based permissions & team removal (soft delete, walkovers, restore) | 1 Account Management, 2 Registration & Tournament Mgmt | `team_removals` (+ `teams.is_removed`, `removed_by`, `removed_at`) | `202611081000_team_removal` |
| 16 | League of Legends ban/pick summary per match | 2 Registration & Tournament Mgmt (+ 4 Live Streaming viewers) | `match_drafts` | `202611081300_match_drafts` |
| 17 | Facebook link resolver & stream checklist; live team updates | 4 Live Streaming, 2 Registration & Tournament Mgmt | (`streams.facebook_video_id`) | `202611081100_stream_video_id`, `202611081200_realtime_teams` |
| 18 | Role-based navigation, dashboard, quick tour, dark mode | 1 Account Management (all actors) | (`profiles.tour_dismissed_at`) | `202611081400_avatars_and_tour` |
| 19 | Profile pictures | 1 Account Management | bucket `avatars` (+ `profiles.avatar_url`) | `202611081400_avatars_and_tour` |
| 20 | Live stream comments | 4 Live Streaming | `stream_comments`, `stream_comment_activity` | `202611081500_comments_moderation` |
| 21 | AI moderation, warnings and bans (comments + feedback) | 5 Feedback & Sentiment Analysis, 1 Account Management | `user_warnings` (+ `profiles.ban_status`, moderation columns on `feedback`) | `202611081500_comments_moderation` |
| 23 | Game-specific game profiles (per-game fields, ranks, roles, heroes) + recruiting filters | 2 Registration & Tournament Mgmt | (`games.profile_schema`, `player_game_profiles.details`) | `202611091400_game_profile_schemas` |

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
  the Gemini free tier with a built-in rate limit, Vercel hosting, Brevo for account emails, and Facebook embeds.

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
1.0-6.0 gain the flows listed per feature in Section 3. Notifications are written by processes 1.0-3.0 into D7 and
read by every logged-in actor. The activity log is written by 1.0-4.0 and 6.0 into D8 and read by the admin
through 6.0.

### 2.4 Use case diagrams
- **New actor:** *Visitor* (not logged in). *Team Captain* is a specialization of *Player*: draw it with a
  generalization arrow from Captain to Player.
- **New use cases**, per actor, are listed in each feature below. Most "manage" use cases **include** *Login*.
  Visitor use cases don't.

---

## 3. Feature details

### Feature 1: Account security & Data Privacy Act consent
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

### Feature 2: Student verification
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

### Feature 3: Team invites, team directory, join requests & roster management
**Module:** 2 Registration and Tournament Management

**What it does:** the captain searches players by IGN or name and invites them, and the player accepts or declines.
Members can leave, and the captain can remove a member or hand over the captaincy. Rosters are locked while the team
is registered for a tournament that hasn't ended. Roster sizes come from each game.
Since `202611011300`: `/teams` has an **All teams** directory (search, game filter, captain, roster count) for every
logged-in user, including organizers. A captain can switch on **Recruiting**; players then **ask to join** (with an
optional message) and the captain accepts or declines. Accepting uses the same roster rules as invites.

**Actors / use cases**
- Team Captain: *Search players*, *Invite player*, *Cancel invite*, *Remove member*, *Transfer captaincy*.
- Player: *Accept / decline team invite*, *Leave team*, *Browse teams*, *Request to join a team*, *Cancel join request*.
- Team Captain: *Open / close recruiting*, *Accept / decline join request*.
- Admin/Staff: *Browse teams*, *View join requests*, *Close recruiting*.

**Data flows**
- Captain → 2.0: Player search → D1/D2: Fetch player profiles (IGN, role, verified badge).
- Captain → 2.0: Team invite → D2: Save invite → D7: Invite notification → Player.
- Player → 2.0: Invite answer → D2: Update team members → D7: Answer notification → Captain.
- Captain/Player → 2.0: Leave / remove / transfer → D2: Update roster → D7: Notification.
- User → 2.0: Team search → D2: Team list (name, game, captain, roster count).
- Player → 2.0: Join request → D2: Save request → D7: Request notification → Captain.
- Captain → 2.0: Request answer → D2: Update team members → D7: Answer notification → Player; D8: Activity entry.

**Database**
- New table: **`team_invites`** (`id`, `team_id`, `invited_user_id`, `invited_by`,
  `status` pending/accepted/declined/cancelled, `created_at`, `responded_at`).
- Functions: `respond_to_team_invite()`, `transfer_team_captaincy()`, `get_my_team_invites()`,
  `get_team_invites()`, `search_players()`.
- New table: **`team_join_requests`** (`id`, `team_id`, `user_id`, `message`, `status`
  pending/accepted/declined/cancelled, `created_at`, `responded_at`); new column `teams.recruiting`.
- Functions: `list_teams()`, `get_team_join_requests()`, `respond_to_join_request()`, `set_team_recruiting()`.

### Feature 4: Match check-in & forfeits
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

### Feature 5: Result submission, disputes & staff review
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

### Feature 6: In-app notifications
**Module:** 3 Event Information and Announcements (it carries the DFD output "Announcement and Match Update"),
but the notifications are created by several processes.

**What it does:** a bell icon in the header shows the unread count, updated live, and `/notifications` lists them
all. Notifications are sent for: registration approved/rejected; match time set or changed; match live; check-in
open; forfeit; results submitted, confirmed, disputed, approved or rejected; new announcement; team invite and
answer; member left or removed; new captain; student verified, rejected or revoked; your role changed; your Pick'em
pick was right or wrong. Organizers (admin/staff) are notified when a team registers or withdraws and when a student
sends verification details, so they know what needs approval.

**Actors / use cases**
- All logged-in actors: *View notifications*, *Mark notification as read*.

**Data flows**
- 1.0 / 2.0 / 3.0 → D7: Save notification (created only by the database, never by the app directly).
- D7 → User (Realtime): New notification. User → D7: Read status.
- 2.0 → D7: Registration submitted / withdrawn → Admin/Staff. 1.0 → D7: Verification submitted → Admin/Staff;
  Role changed → User. 8.0 → D7: Pick'em result → Audience/Player (`202611011200_more_notifications`).

**Database**
- New table: **`notifications`** (`user_id`, `type`, `title`, `message`, `link`, `is_read`, `created_at`).
- Function: `purge_old_notifications()` (read notifications older than 90 days; run by hand).

### Feature 7: Public tournament & match pages, link previews, calendar, share
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

### Feature 8: Admin-editable public website
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
- `events` later got `venue` and `is_featured` (`202611091000_featured_events`): admins pin one event to the
  homepage's featured card (with a countdown); without a pin the next upcoming published event is featured.
- `get_live_now()` (`202611091100_live_now`, readable logged out): the homepage "Live now" strip (live scores, or
  the next match with a countdown). Team and tournament names only, like `get_public_tournament()`.
- `get_site_stats()` (`202611091200_site_stats`, readable logged out): four totals (players, teams,
  tournaments, matches played) for the animated counters on the homepage and About page. Counts only.
- Storage: public bucket **`site-images`**.

### Feature 9: Feedback protection
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

### Feature 10: Pick'em predictions & leaderboard
**Module:** **8 Audience Engagement: Pick'em Predictions (new)**. Its statistics feed Module 6.

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

### Feature 11: Activity (audit) log
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

### Feature 12: Excel / CSV exports
**Module:** 6 Administrative Reports

**What it does:** download registrations, team rosters, schedule & results (admin/staff), anonymous feedback and
the user list (admin only) as Excel or CSV. Every download is recorded in the activity log first.

**Actors / use cases**
- Admin, Staff: *Export data* (includes *Record export* in the activity log).

**Data flows**
- Admin/Staff → 6.0: Export request → D1/D2/D4: Fetch data → D8: Export record → Admin/Staff: Excel/CSV file.

**Database**
- No new table (entries go to `activity_logs`). Function: `log_export()`.

### Feature 15: Role-based permissions & team removal
**Modules:** 1 Account Management (permissions), 2 Registration and Tournament Management (team removal)

**What it does:** every role sees only the buttons it may use. One permission map (`utils/permissions.ts`,
`can(role, action)`) decides what the screens show; the same rules are enforced in the database and API
(table in `docs/permissions.md`). Logged-out visitors get the spectator view. Admins and staff can **remove a
team** that breaks the rules: they see its members, registrations and bracket matches, and must give a reason.
The team disappears from team lists, recruiting and registrations, its pending/approved registrations for
tournaments that haven't ended are withdrawn, its unfinished bracket matches go to the opponent as a
**walkover** (also later, as soon as an unknown opponent is decided), its members are freed and notified, and
the removal is logged. The record stays for reports. Admins can **restore** a removed team (captain plus former
members who are still free); withdrawals and walkovers are not undone.

**Actors / use cases**
- Admin, Staff: *Remove team* (includes *Give reason*; extends to *Award walkover*).
- Admin: *Restore removed team*.
- Player: *Receive team removal notification*.

**Data flows**
- Admin/Staff → 2.0: Team removal + reason → D2: Mark team removed, withdraw registrations, walkover results,
  free members → D7: Removal notification → Players; Walkover notification → opponent; D8: Activity entry.
- Admin → 2.0: Team restore → D2: Reactivate team, re-add members → D7: Restore notification → Players; D8: Activity entry.

**Database**
- New table: **`team_removals`** (`id`, `team_id`, `removed_by`, `removed_at`, `reason`, `roster` (jsonb),
  `tournaments` (jsonb), `walkovers`, `restored_by`, `restored_at`); organizers only.
- New columns: `teams.is_removed`, `teams.removed_by`, `teams.removed_at`.
- Functions: `remove_team()`, `restore_team()`, `apply_removed_team_walkover()` (internal).

### Feature 16: League of Legends ban/pick summary
**Module:** 2 Registration and Tournament Management (shown to the audience on the match pages)

**What it does:** for League of Legends matches, tournament staff enter each team's bans and picks per game of
the series (up to 5 each). Everyone, also logged-out visitors on the public match page, sees the summary, and it
updates live while staff type it in.

**Actors / use cases**
- Staff, Admin: *Enter ban/pick summary* (LoL only).
- Audience, Player, Visitor: *View ban/pick summary*.

**Data flows**
- Staff → 2.0: Ban/pick entry → D2: Save draft → Audience/Players/Visitor: Ban/pick summary (live).

**Database**
- New table: **`match_drafts`** (`id`, `match_id`, `game_number`, `team_a_bans`, `team_a_picks`, `team_b_bans`,
  `team_b_picks`, `updated_by`, `created_at`, `updated_at`); trigger `check_match_draft()`.

### Feature 17: Facebook link resolver, stream checklist & live team updates
**Modules:** 4 Live Streaming (links), 2 Registration and Tournament Management (live updates)

**What it does:** staff can paste any Facebook link (share links `/share/v/`, `/share/r/`, `fb.watch`, `/watch`,
`/videos/`, embed code). The system finds the real video, saves its canonical address and video id, warns when
Facebook says the video can't be embedded, and shows a preview and a checklist (Page not profile, Public,
embedding allowed, no restrictions) before saving. Viewers get a "Watch on Facebook" card when the player can't
load. Team pages, join requests, invites, brackets, schedules and "My Matches" update without refreshing.

**Actors / use cases**
- Staff, Admin: *Configure stream* now includes *Resolve video link* and *Preview stream*.
- Team Captain: *Accept all / decline all join requests*.

**Data flows**
- Staff → 4.0: Pasted link → Facebook (external): Redirect / embed check → 4.0: Canonical link + embed status → D3.
- D2 → Players/Audience: Live roster, request, bracket and score updates (Realtime).

**Database**
- New column `streams.facebook_video_id`. `teams`, `team_members`, `team_invites`, `team_join_requests` and
  `match_drafts` join the Realtime publication.

### Feature 18: Role-based navigation, dashboard, quick tour & dark mode
**Module:** 1 Account Management (applies to every actor)

**What it does:** each role gets its own menu (Spectator/Visitor: Home, Events, Tournaments, Watch Live, Teams,
Give Feedback; Player: plus My Profile, My Team, My Matches & Schedule, Recruiting; Staff: Dashboard, Match Control,
Streams, Brackets, Teams; Admin: Dashboard, Tournaments, Teams, Users, Announcements, Feedback & Sentiment,
Reports). Sidebar on computers, bottom tab bar on phones, breadcrumbs and a back button on inner pages, hover /
long-press hints, a role dashboard with quick actions, a skippable 4-step tour on first login, and a dark theme
that follows the device or the user's choice.

**Actors / use cases**
- All actors: *Navigate by role*, *Switch theme*. Logged-in actors: *Take the quick tour*.

**Data flows**
- Actor → 1.0: Tour finished/skipped → D1: tour_dismissed_at.

**Database**
- New column `profiles.tour_dismissed_at`.

### Feature 19: Profile pictures
**Module:** 1 Account Management

**What it does:** every user can add a profile picture (JPG/PNG/WebP, cropped to a square in the browser, stored
as a 512px image up to 2 MB). Pictures appear in the header, profile, team rosters, player search and join
requests; users without one show their initials. Admins can remove an inappropriate picture with a reason (the
user is notified and the action is logged).

**Actors / use cases**
- All logged-in actors: *Upload / change / remove own profile picture*.
- Admin: *Remove a user's profile picture* (includes *Give reason*).

**Data flows**
- User → 1.0: Picture → D1/Storage: Save picture.
- Admin → 1.0: Removal + reason → D1: Clear picture → D7: Notification → User; D8: Activity entry.

**Database**
- New column `profiles.avatar_url`; storage bucket `avatars`; function `admin_remove_avatar()`.
- Privacy Notice version `2026-11-08` (profile pictures are new personal data visible to other users).

### Feature 20: Live stream comments
**Module:** 4 Live Streaming

**What it does:** a comments panel beside every stream (live chat, and comments on replays). Logged-in users post
(300 characters, one comment every 3 seconds); new comments appear for every viewer instantly. Logged-out visitors
read the comments on the public tournament and match pages and see "Log in to comment". Commenters are shown
as "first name + initial" with their picture.

**Actors / use cases**
- Audience, Player, Staff, Admin: *Post a comment*, *Read comments*. Visitor: *Read comments*.
- Staff, Admin: *Remove a comment* (optionally with a warning).

**Data flows**
- User → 4.0: Comment → D3: Save comment → all viewers: Comment list (live).

**Database**
- New tables: **`stream_comments`**, **`stream_comment_activity`** (Realtime signal only).
- Function: `get_stream_comments()`.

### Feature 21: AI moderation, warnings and bans
**Modules:** 5 Feedback & Sentiment Analysis (analysis), 1 Account Management (warnings, bans)

**What it does:** the same Gemini analysis checks stream comments and feedback for sentiment, topics, profanity
and offensive content (English, Filipino, Taglish). Profanity stays visible but gives a warning; bullying,
harassment, hate speech, threats or sexual content are hidden at once, queued for moderators and give a warning.
Normal gaming trash talk is not flagged. At 5 warnings the account is flagged: the user can browse but not post,
and an admin confirms a ban (no more login) or dismisses it (warnings reset). Moderators restore wrongly hidden
items (removing the AI's warning), admins remove warnings, ban and unban. Comment sentiment per stream,
tournament and day, top topics and flagged counts are shown next to feedback sentiment.

**Actors / use cases**
- System (AI): *Analyse and moderate text*, *Issue warning*, *Flag account*.
- Staff: *Review hidden comments* (restore / remove). Admin: also *Review hidden feedback*, *Remove warning*,
  *Confirm / dismiss ban*, *Ban / unban user*, *View comment sentiment*.
- Audience, Player: *View own warnings*, *Receive warning notification*.

**Data flows**
- 4.0/5.0 → Gemini (external): Text batch → 5.0: Sentiment + moderation flags → D3/D4: Save result →
  D1: Warning, ban status → D7: Warning / flag notifications → User, Admins.
- Staff/Admin → 5.0: Moderation decision → D3/D4/D1 → D7: Notification → User; D8: Activity entry.

**Database**
- New table: **`user_warnings`**. New columns: `profiles.ban_status`, `ban_flagged_at`, `banned_at`,
  `banned_by`, `ban_reason`; moderation columns on `feedback`.
- Functions: `claim_moderation_batch()`, `save_moderation_result()`, `mark_moderation_pending()`,
  `moderate_comment()`, `moderate_feedback()`, `remove_warning()`, `ban_user()`, `dismiss_ban()`, `unban_user()`,
  `report_comment_sentiment()`, `custom_access_token_hook()` (Supabase Auth hook).
- Privacy Notice `2026-11-08.2`, Terms of Service `2026-11-08` (Code of Conduct moderation rules).

### Feature 22: Reports with written interpretations
**Module:** 6 Administrative Reports

**What it does:** every chart in the administrative report has a clear title, axis titles with units, a legend,
tooltips, a data table and a color-blind-safe palette for light and dark mode (line charts for trends, bars for
comparisons, a doughnut only for the 3-part sentiment split). Under each chart is a 2–3 sentence interpretation,
and the report opens with key findings and recommendations for the Organizing Committee. The statistics and
the rule-based findings are computed in code; Gemini only rewords them, and any sentence containing a number
that isn't in the computed facts is replaced by the computed sentence. New charts: registrations over time,
engagement per stream (views, unique viewers, comments), sentiment trend (weekly share), top topics, moderation
outcomes, warnings over time, offense types. New filter: data source (feedback, stream comments, or both).
Export PDF (print dialog "Save as PDF", charts in the light palette) and CSV with the new tables.

**Actors / use cases**
- Admin: *Generate report* (now with data source and written summary), *Export report to PDF*,
  *Delete saved report* (confirmation, logged).

**Data flows**
- Admin → 6.0: Filters → D1/D2/D3/D4 (report functions) → 6.0: Computed facts → Gemini (external):
  Facts only (no personal data) → 6.0: Wording (number-checked) → D5: Saved report → Admin.
- 6.0 → D8: Activity entry (report generated / deleted).

**Database**
- Functions: `report_comments()`, `report_moderation()`; `report_activity()` adds `registrations_by_day`.
- Trigger `analytics_reports_log` → activity actions `report.generated`, `report.deleted`.
- `analytics_reports.data` may now also hold `comments`, `moderation` and `insights`; `filters.source`.

### Feature 23: Game-specific game profiles
**Module:** 2 Registration and Tournament Management

**What it does:** the game profile form changes with the game: the player picks a game (with its logo) and sees
only that game's fields (Valorant: Riot ID, rank + tier, main role, up to 3 agents; League of Legends: Riot ID,
server, rank + division, primary/secondary role, champion pool; MLBB: IGN, User ID, Zone ID, rank + tier or stars,
lane, heroes; CODM: IGN, UID, MP and BR rank, mode, weapon class; Tekken 8: player name, Tekken ID, platform,
rank, characters). A tier/division/stars field appears only for ranks that have one (not for Radiant or Master+).
Everything is checked again by the database, so a Valorant rank can't be saved on an MLBB profile even through
the API. Rosters, invite search and join requests show the IGN, a colored rank badge and the main role; captains
filter the invite search by role and rank range. Admins edit every list (add, rename, reorder, remove options and
tiers) on `/admin/games` without code changes.

**Actors / use cases**
- Player: *Create/edit game profile* (now per-game fields).
- Team Captain: *Search players by role and rank range*.
- Admin: *Manage game profile options* (new; logged).

**Data flows**
- Player → 2.0: Game profile details → D1 (validated against the game's options) → Player.
- Admin → 2.0: Game options → D1 (`games.profile_schema`) → D8: Activity entry.
- Captain → 2.0: Search filters → D1 → Captain: Matching players (name, IGN, rank, role only).

**Database**
- Columns `games.profile_schema` (fields + ordered option lists, admin-editable) and
  `player_game_profiles.details` (the player's values).
- Trigger `check_game_profile()` (validation; fills `ign`, `rank`, `in_game_role`); function
  `update_game_profile_schema()` (admin); `search_players()` gains role / rank-range filters;
  `get_team_roster()` / `get_team_join_requests()` return the rank position for the badge.
- Activity action `game.profile_schema_updated`.
- Privacy (`202611091500_game_profile_details_privacy`): the `details` column (game account IDs) is readable only by
  the player and organizers, through `get_game_profile_details()`; Privacy Notice version `2026-11-09`.

### Feature 13: Enhancements inside the original modules
These additions stay inside existing modules but add flows you may want to draw.
- **Module 4:** "Watching now" live viewer count (Supabase Realtime Presence, not stored). Staff see it on the
  engagement page.
- **Module 6:** generated reports are **saved** (`analytics_reports`, D5) and can be printed or saved as PDF, or
  downloaded as CSV. The engagement report now also includes predictions, predictors, prediction accuracy and
  participation (share of player/spectator accounts that made at least one pick), plus a table per tournament.
- **Module 5:** sentiment now includes **topics** (up to 3 per comment). "Common concerns" are the topics on
  negative feedback.
- **Module 1:** stronger passwords and email checks (requested by the adviser). New passwords need 10+
  characters with uppercase, lowercase, a number and a symbol, and can't be a common password or contain the
  user's name or email; forms show a live checklist and strength bar. Users whose old password breaks the rules
  are asked to change it after logging in. Email fields reject invalid addresses (e.g. `juan@gmail`).
  No new tables; Supabase's own password requirements are set to match.
- **Module 2:** each game has a realistic participant range for tournaments (`games.min_participants`,
  `games.max_participants`; MLBB/CODM 4–64 teams, Valorant/LoL 4–32 teams, Tekken 8 8–128 players), enforced by
  a database trigger and shown on the create/edit forms. Data flow: D2 games → 2.0: participant range.

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
