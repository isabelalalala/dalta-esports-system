# DALTA Esports – System Requirements (from the business case, CFD, DFD and use case diagrams)

> **Final system:** the sections below first describe the original documents (6 modules). Additions made during
> development are marked **(added)** and summarized in "Final system: additions" at the end. The full list of new
> features, with their actors, use cases, data flows and tables, is in `docs/new-features-summary.md`.

## Business case summary
- **Client:** DALTA Esports (UPHSD Molino) and AcadArena South Luzon Esports Conference (SLEC) – Alliance Games
- **Problem:** registration, schedules, announcements and match info are handled through separate, manual tools.
- **General objective:** a web-based multi-game tournament management system.
- **Specific objectives:**
  1. A centralized module for player/team registration and tournament management
  2. Event information, announcements, match updates and live streaming through the website
  3. Collect and analyze participant/viewer feedback using sentiment analysis for committee decisions
  - **(added)** Public tournament pages without an account (with calendar and share links), an admin-editable
    public website, and audience engagement through pick'em predictions
- **Budget:** ₱0–₱5,000, using free/open-source tools
- **Games (divisions):** MLBB, Valorant, Tekken 8, League of Legends, CODM

## Actors
| Actor | Role value |
|-------|-----------|
| Organizing Committee / Administrator | admin |
| Tournament Staff / Game Administrator | staff |
| Players | player |
| Audience / Spectator | spectator |
| **(added)** Visitor (not logged in) | – (no account) |
| **(added)** Team Captain (a Player who leads a team) | player (`teams.captain_id`) |

## Data stores (DFD Level 1)
- **D1 User Account DB:** user accounts and profiles
- **D2 Tournament & Schedule DB:** tournaments, schedules, match data, event details and announcements
- **D3 Streaming & Match Stat DB:** stream data and match stats
- **D4 Feedback DB:** raw feedback and sentiment scores
- **D5 Analytics & Engagement DB:** compiled reports
- **(added) D6 Website Content DB:** public website texts, images, campaigns, events, divisions, officers, official teams
- **(added) D7 Notifications DB:** in-app notifications
- **(added) D8 Activity Log DB:** audit trail of important actions
- **(added) D9 Predictions DB:** pick'em predictions

## Processes (DFD Level 1) and their data flows

### 1.0 Manage User Account → Module 1: Account Management
- **In (all actors):** Login Credential; Registration Detail (audience); Player Registration Detail (player)
- **Out:** Verified Account; Log in authentication status / System Access
- **Stores:** D1 (Save New User Data, Verify Login Credential)
- **Use cases:**
  - All actors: add, edit, view and delete their own account; login
  - Admin: add new account; edit, view and delete other accounts

### 2.0 Schedule Tournament Match → Module 2: Registration and Tournament Management
- **In (player):** Profile & In-Game Detail; Match Schedule Request; Rule & Standing Request
- **Out (player):** Profile Update Confirmation; Assigned Schedule & Bracket; Tournament Rule & Match Result
- **Stores:** D1 (Fetch Player Profile), D2 (Save/Update/Fetch Match Data)
- **Use cases:**
  - Player: register as player, update profile
  - Tournament Staff: manage tournament schedule
  - All of these include Login

### 3.0 Distribute Event Announcement → Module 3: Event Information and Announcements
- **In (admin):** Event Info & Announcement
- **In (audience):** View Information
- **Out (audience):** Announcement and Match Update
- **Stores:** D2 (Save/Fetch Event Detail)
- **Use cases:**
  - Admin: post event info and announcements, update match schedule
  - Audience: view announcements

### 4.0 Stream Live Match → Module 4: Live Streaming
- **In (staff):** Stream Configuration / Facebook Live URL
- **Out (staff):** Live Stream Link Validated Status; Real-Time Match Management Confirmation
- **Out (audience):** Live Streaming Access
- **Stores:** D3 (Store Stream Data)
- **Use cases:**
  - Staff: configure stream, manage real-time match
  - Audience: watch live stream

### 5.0 Analyze Audience Feedback → Module 5: Feedback and Sentiment Analysis
- **In (audience):** Feedback and Rating
- **Out (audience):** Feedback Confirmation
- **Stores:** D4 (Store Raw Feedback & Sentiment Score)
- **Use cases:**
  - Audience: submit feedback and ratings, which includes the system classifying sentiment (Gemini API)

### 6.0 Generate Administrative Report → Module 6: Administrative Reports
- **In (admin):** Analytics & Report Request
- **Out (admin):** Sentiment Analysis Report & viewer feedback insight; Overall Tournament Activity & System Report
- **In (staff):** Viewership Metric Request
- **Out (staff):** Viewership & Audience Engagement Stat
- **Stores:**
  - D5 (Compile & Fetch Final Report)
  - D4 (Fetch Sentiment Data)
  - D3 (Fetch Streaming Stat)
  - D2 (Fetch Tournament Data)
- **Use cases:**
  - Admin: view sentiment analysis, generate analytics report; display after report (extension point)
  - Staff: view engagement stats
- **Charts:** Chart.js

## System architecture
System name: "DALTA Esports Tournament Management System with AI-Powered Feedback Sentiment Analytics".

### Flow
- The **user** accesses the system through a web browser over the internet.
- The system's modules **read from and write to a single database** (Supabase) in both directions.
- Outputs go to **"Tournament Access and Insights"**: the stakeholders (DALTA Esports, AcadArena SLEC, organizers, players, audience).

### Modules and their sub-components
1. **Account Management Module**
   - Registration & Login
   - Role-Based Access Control
2. **Registration and Tournament Management Module**
   - Player Registration
   - Tournament Scheduling
   - Profile Management
3. **Event Information and Announcements Module**
   - Event Info & Announcements
   - Match Schedule Updates
4. **Live Streaming Module**
   - Stream Configuration
   - Real-Time Match Management
5. **Feedback and Sentiment Analysis Module** (grouped as "Sentiment Analysis")
   - Feedback Collection
   - Sentiment Classification
6. **Administrative Reports Module** (grouped as "Data Analytics")
   - Analytics Report
   - Engagement Stats Report
   - **(added)** Activity (Audit) Log, Data Exports (Excel/CSV)
7. **(added) Public Website & Content Management Module**
   - Public Website Pages
   - Content Management (admin)
8. **(added) Audience Engagement Module (Pick'em Predictions)**
   - Match Predictions
   - Leaderboard

### External APIs and services
| Service | Connected to |
|---------|--------------|
| Facebook Live / Streaming API | Live Streaming Module (and Match Schedule Updates) |
| Google Gemini API | Feedback and Sentiment Analysis Module |
| Chart.js / Data Visualization | Administrative Reports Module |
| **(added)** Supabase Auth email | Account Management (confirmation and password reset emails) |
| **(added)** Calendar applications (.ics / webcal) | Event Information (match, tournament and team calendars) |
| **(added)** Facebook / Messenger link previews (Open Graph) | Event Information (shared tournament and match links) |
| **(added)** Supabase pg_cron | Registration and Tournament Management (check-in reminders) |

## Public website (wireframe pages)
- **Home:** hero ("DALTA ESPORTS", "The official esports organization of UPHSD – Molino Campus"), Join DALTA Esports / Explore Our Team buttons, event photo carousel, Campaigns cards, Events cards; side nav (About Us, Campaigns, Events, Tournaments); search bar; Log in / Sign in
- **About Us:** founded February 2025; Our Story; Mission; Vision; core belief "Game With Purpose"
- **Game Divisions:** MLBB, VALO, Tekken 8, League, CODM → official teams per division → team page (captain profile, player profiles with IGN – role, team description)
- **Events:** event cards
- **The DALTA Community:** Members, Coaches/Managers, Core Officers, Game Division Heads, Committees
- **Core Officers:**
  - Izumi Yamamoto – Founder/President
  - Sean Jihan Tandoc – VP Internal
  - Alexander Jon Solis – VP External
- **Division heads / coaches:** one per game
- **Footer (every page):** "Game With Purpose", About Us – Esports Division – Community, © 2026 DALTA Esports, Connect With Us, logo
- **Wireframe style:** white background, black outlines, pixel/retro font, logo in yellow and brown
  (final system: one dark theme in the logo's yellow and brown for public and logged-in pages, pixel headings)

## Final system: additions (for updating the documents)
Details per feature: `docs/new-features-summary.md`.

### Additions to existing processes
- **1.0 Manage User Account:** password reset and email confirmation (Email Service); Data Privacy Act consent
  (RA 10173) at registration and again when the Privacy Notice changes; student verification (players submit their
  student ID, school and course/year; admin/staff verify or reject).
- **2.0 Schedule Tournament Match:** team invites (captain invites, player accepts/declines, leave, remove,
  transfer captaincy, roster lock); "verified students only" tournaments; match check-in with reminders (pg_cron);
  forfeits; captain result submission with a screenshot, confirm/dispute by the other captain, and staff review
  (approve / override / reject).
- **3.0 Distribute Event Announcement:** in-app notifications (bell, live updates) for announcements, match times,
  results, invites and verification; public tournament and match pages for visitors; "Add to calendar" files; share
  links with previews.
- **4.0 Stream Live Match:** "watching now" live viewer count (not stored).
- **5.0 Analyze Audience Feedback:** one feedback per user per tournament, per match and one general; sentiment and
  topics are classified when feedback is sent; a server-side rate limit protects the Gemini quota; failed analyses
  are saved as "pending analysis" and retried by an admin.
- **6.0 Generate Administrative Report:** saved reports (print/PDF, CSV); activity (audit) log; Excel/CSV exports;
  the engagement report includes pick'em predictions and participation.

### New processes
- **7.0 Manage Public Website**
  - In (admin): Website content and images. Out (visitor/all): Website pages, search results.
  - Stores: D6 (Save/Fetch Content), D2 (Fetch tournaments for search).
  - Use cases: Visitor: view website pages, search. Admin: edit site text, manage carousel, campaigns, events,
    divisions, officers, official teams and players.
- **8.0 Manage Pick'em Predictions**
  - In (audience/player): Match pick. In (2.0): Final match result.
  - Out: Community split (also to visitors), pick result, leaderboard.
  - Stores: D9 (Save/Fetch Predictions), D2 (Fetch match status and teams), D1 (Fetch short display name).
  - Use cases: Audience/Player: pick match winner, view community split, view leaderboard. Visitor: view community
    split. System: mark predictions when a result is final.

### New use cases on existing actors
- **All actors:** reset password, confirm email, give privacy consent, view notifications, view Privacy Notice.
- **Player:** submit student details. **Team Captain:** invite player, remove member, transfer captaincy, check in
  for a match, submit result with a screenshot, confirm/dispute a result. **Player:** accept/decline invite, leave team.
- **Audience/Player:** submit feedback about a match, pick match winner, view leaderboard.
- **Staff:** review student verification, monitor check-ins ("Needs attention"), declare forfeit, review match
  result, export data.
- **Admin:** all staff use cases, plus manage the website, view the activity log, retry pending sentiment analysis,
  export feedback and the user list.
- **Visitor (new):** view website pages, search, view public tournament/match pages, view community split, add to
  calendar, share.

