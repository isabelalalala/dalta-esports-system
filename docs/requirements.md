# DALTA Esports – System Requirements (from the business case, CFD, DFD and use case diagrams)

## Business case summary
- **Client:** DALTA Esports (UPHSD Molino) and AcadArena South Luzon Esports Conference (SLEC) – Alliance Games
- **Problem:** registration, schedules, announcements and match info are handled through separate, manual tools.
- **General objective:** a web-based multi-game tournament management system.
- **Specific objectives:**
  1. A centralized module for player/team registration and tournament management
  2. Event information, announcements, match updates and live streaming through the website
  3. Collect and analyze participant/viewer feedback using sentiment analysis for committee decisions
- **Budget:** ₱0–₱5,000, using free/open-source tools
- **Games (divisions):** MLBB, Valorant, Tekken 8, League of Legends, CODM

## Actors
| Actor | Role value |
|-------|-----------|
| Organizing Committee / Administrator | admin |
| Tournament Staff / Game Administrator | staff |
| Players | player |
| Audience / Spectator | audience |

## Data stores (DFD Level 1)
- **D1 User Account DB:** user accounts and profiles
- **D2 Tournament & Schedule DB:** tournaments, schedules, match data, event details and announcements
- **D3 Streaming & Match Stat DB:** stream data and match stats
- **D4 Feedback DB:** raw feedback and sentiment scores
- **D5 Analytics & Engagement DB:** compiled reports

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

### External APIs and services
| Service | Connected to |
|---------|--------------|
| Facebook Live / Streaming API | Live Streaming Module (and Match Schedule Updates) |
| Google Gemini API | Feedback and Sentiment Analysis Module |
| Chart.js / Data Visualization | Administrative Reports Module |

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
