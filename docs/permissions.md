# Role permissions and where they are enforced

The screens decide what to show with `can(role, action)` from `utils/permissions.ts` (one map, no scattered
`role === ...` checks). Hiding a button is only a convenience: every row below is also enforced on the server, so a
direct API or database request is refused too. Keep this table and `PERMISSIONS` in sync.

- **Roles:** A = admin (Organizing Committee), S = staff (Tournament Staff), P = player, Sp = spectator
  (Audience). Logged-out visitors get the spectator *view* but can't do any action (everything needs an account).
- **Relationship rules** ("captain of this team", "team in this match") aren't roles. The pages check them next to
  the data (`isCaptain`, `myTeamId`) and the database checks them again.

| Action (`can()` key) | A | S | P | Sp | UI (where the control is rendered) | API / database enforcement |
|---|:-:|:-:|:-:|:-:|---|---|
| `tournament.create` | ✓ | ✓ | | | `/tournaments` "+ Create", `/tournaments/create` | RLS insert on `tournaments` (admin/staff) |
| `tournament.edit` | ✓ | ✓ | | | Admin panel on `/tournaments/[id]`, `/tournaments/[id]/edit` | RLS update on `tournaments` (admin/staff) |
| `tournament.delete` | ✓ | | | | "Delete Tournament" on `/tournaments/[id]` | RLS delete on `tournaments` (admin) |
| `tournament.register` | | | ✓ | | "Register Team" on `/tournaments/[id]` | RLS "Captains register their own team" + `check_tournament_registration()` + `refuse_removed_team()` |
| `registration.review` | ✓ | ✓ | | | `/tournaments/[id]/registrations` | RLS "Admin/staff update registration status" |
| `bracket.generate` | ✓ | ✓ | | | "Generate Bracket" on `/tournaments/[id]` | `generate_bracket()` role check + `matches` RLS |
| `team.create` | | | ✓ | | "Create Team" on `/teams` | RLS insert on `teams` (`role = 'player'`, captain = self) |
| `team.join` | | | ✓ | | "My teams" tab, invites, "Ask to join", game profiles on `/profile` | `check_team_join_request()` + `check_team_member()` (player accounts only) |
| `team.toggleRecruiting` | ✓ | ✓ | (captain) | | Recruiting switch on `/teams/[id]` | `set_team_recruiting()` (captain or admin/staff) |
| (captain) answer join requests | | | (captain) | | Accept / Decline, Accept all / Decline all on `/teams/[id]` | `respond_to_join_request()` (captain only; bulk = one call per request) |
| `team.remove` | ✓ | ✓ | | | "Remove team" on `/teams/[id]` and `/admin/teams` | `remove_team()` role check; `protect_team_removal()` blocks hand edits |
| `team.restore` | ✓ | | | | "Restore team" on a removed team's page | `restore_team()` (admin only) |
| `team.viewRemoved` | ✓ | ✓ | | | `/admin/teams` Removed tab, reason on the team page | RLS select on `team_removals` (admin/staff) |
| `match.manage` | ✓ | ✓ | | | `/matches`, `/tournaments/[id]/matches`, staff tools on `/matches/[id]`, LoL bans & picks editor | RLS write on `matches` and `match_drafts` (admin/staff); `declare_forfeit()`, `review_match_result()` role checks; `check_match_draft()` (LoL only, limits) |
| `match.checkIn` | | | (captain) | | Check-in on `/matches/[id]` | `check_in_match()` (captain of either team) |
| `match.submitResult` | | | (captain) | | Result form on `/matches/[id]` | `submit_match_result()`, `respond_to_match_result()` (captains) |
| `prediction.pick` | | | ✓ | ✓ | Pick'em under bracket matches | `check_prediction()` (no organizers, not your own match, locks at start) |
| `stream.watch` | ✓ | ✓ | ✓ | ✓ | `/live`, `/live/[id]` | `proxy.ts` (login) + RLS select on `streams` (logged-in) |
| `stream.configure` | ✓ | ✓ | | | `/tournaments/[id]/streams` (link check, preview, checklist) | RLS write on `streams` (admin/staff); POST `/api/streams/resolve-url` `can()` check |
| `announcement.post` | ✓ | | | | Post/edit on `/announcements` | RLS write on `announcements` (admin) |
| `feedback.submit` | ✓ | ✓ | ✓ | ✓ | `/feedback` | POST `/api/feedback` (login) + RLS insert (own row) |
| `feedback.viewAll` | ✓ | | | | `/admin/feedback` | RLS select on `feedback` (admin); POST `/api/feedback/classify` role check |
| `report.generate` | ✓ | | | | `/analytics` | POST `/api/reports/generate` role check; `report_activity()`, `report_sentiment()`, `report_comments()`, `report_moderation()` role checks; RLS on `analytics_reports` (admin); generate/delete logged by trigger |
| `report.viewEngagement` | ✓ | ✓ | | | `/analytics/engagement` | `report_engagement()`, `get_live_viewer_counts()` role checks |
| `export.operations` | ✓ | ✓ | | | Export buttons (registrations, rosters, matches) | GET `/api/exports/[type]` `can()` check + `log_export()` role check + RLS reads |
| `export.sensitive` | ✓ | | | | Export buttons (feedback, users) | same as above |
| `user.manage` | ✓ | | | | `/admin/users` | RLS update on `profiles` (admin), `protect_profile_role()`, `admin_delete_user()` |
| (own) profile picture | ✓ | ✓ | ✓ | ✓ | `/profile` picture card | `profiles_avatar_url_check` (own folder only), `protect_avatar()`; storage policies (own folder) |
| remove someone's picture | ✓ | | | | "Remove picture" on `/admin/users` | `admin_remove_avatar()` (admin, reason required, logged, notifies); storage delete policy (admin) |
| `verification.submit` | | | ✓ | | Student details on `/profile` | `profiles` verification trigger refuses non-player accounts |
| `verification.review` | ✓ | ✓ | | | `/admin/verification` | `review_student_verification()` role check |
| `website.edit` | ✓ | | | | `/admin/website` | RLS write on website tables + `site-images` (admin); `refreshSite()` role check |
| `activity.view` | ✓ | | | | `/admin/activity` | RLS select on `activity_logs` (admin) |
| `comment.post` | ✓ | ✓ | ✓ | ✓ | Comment box in `StreamComments` (logged out: "Log in to comment") | POST `/api/comments` (login + `can_post()`), RLS insert (own + `can_post()`: not flagged/banned), `check_stream_comment()` (300 chars, 1 per 3 s) |
| `moderation.review` | ✓ | ✓ | | | `/admin/moderation` hidden comments, Remove on the comments panel, Retry pending analysis | `moderate_comment()` role check; POST `/api/moderation/retry` `can()` check |
| `moderation.ban` | ✓ | | | | `/admin/moderation` hidden feedback, pending bans, flagged users | `moderate_feedback()`, `remove_warning()`, `ban_user()`, `dismiss_ban()`, `unban_user()` (admin); RLS select on `user_warnings` (own or admin) |

All protected pages also require a login in `proxy.ts`. Pages a role can't use show a short "only … can …"
message instead of their content.

Read-only for everyone (also logged out): LoL bans & picks (`match_drafts` select policy), like matches, and visible stream
comments (`get_stream_comments()`; hidden ones only for their author and moderators).

Banned accounts: sent to `/banned` by `proxy.ts` on every protected page, refused by `can_post()`, and (with the Auth
hook switched on) refused a session by `custom_access_token_hook()`.
