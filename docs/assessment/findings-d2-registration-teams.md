# Findings — D2: Registration, teams, invites, check-in, predictions

## Verdict

Registration, roster, invite, check-in and prediction rules are enforced in the database exactly as documented; the main defects are a cross-team race that lets a player join two teams for the same game, and a case/whitespace-sensitive team-name uniqueness that permits look-alike duplicates.

## Checked

**Registration (`tournament_registrations`)**

- Capacity counts only pending+approved → `supabase/migrations/202610161500_registration_approval.sql:200-209` (insert trigger); re-activation path `:240-257`; app constant `utils/types.ts:135`, admin count `app/tournaments/[id]/registrations/page.tsx:119`.
- Capacity check is lock-protected, not read-then-write → `202610171000_student_verification.sql:215-219` (`select ... from public.tournaments ... for update`); re-activation locks the same row `:311-315`. Two simultaneous registrations serialize on the tournament row. VERIFIED-CORRECT.
- `registration_deadline` enforced in the DB trigger, not the UI → `202610171000:230-233` (`current_date > tour.registration_deadline::date`); plus start-date block `:235-237` and cancelled block `:225-227`. UI convenience only: `utils/tournaments.ts:56-72`, `app/tournaments/[id]/page.tsx:277-282`.
- `requires_verification` on all three paths → register `202610171000:257-262` (`unverified_team_members`), approve `:331-337`, add-member-to-registered-team `:403-414` (covers invite accept, since `respond_to_team_invite` inserts `team_members`).
- `UNIQUE(tournament_id, team_id)` → `202610151200_team_registration.sql:357-359`; redundant friendly check `202610171000:264-269`.
- Who can register → captain only: policy `202610161500:85-95` (`user_id = auth.uid() and status='pending' and captain`); UI loads only captained teams `app/tournaments/[id]/page.tsx:136-146`.
- Cancel/delete → captain pending→cancelled policy `202610161500:104-114`; captain delete pending `:121-127`; admin delete `:116-119`; non-status columns guarded `202610171000:301-309`. Withdraw UI `app/registrations/page.tsx:65-88`.

**Teams / team_members**

- `UNIQUE(name, game_id)` → `202610151200:112` — case-sensitive text btree (see Findings).
- Captain auto-added → `setup_new_team` trigger `202610161400_team_captain_management.sql:48-59`.
- Captain edits name/desc only → update policy `202610161400:16-21`; `game_id`/`captain_id` immutable via `protect_team_fields` `202610171300_team_invites.sql:231-245`. UI edits only name/desc `app/teams/[id]/page.tsx:94-97`.
- `prevent_team_delete_in_bracket` → `202610161700_matches.sql:160-177`.
- Roster-lock on DELETE → `check_team_member_leave` `202610171300:294-325`: blocks while `status in ('pending','approved')` and `tr.end_date::date >= current_date`; admin/staff exempt `:304`; cascades exempt via `pg_trigger_depth() > 1 or auth.uid() is null` `:303`.
- Leave/remove policy → `202610151200:175-190` (self-leave or captain removes `role <> 'captain'`; admin/staff anyone).
- Roster max on member insert → `check_team_member` `202610171000:360-373` locks the team row `for update of t` (serializes same-team adds); also on invite insert `202610171300:129-132`. `min_players` checked at registration `202610171000:249-254`.
- `transfer_team_captaincy` → `202610171300:247-287`: caller must be current captain (`:264-266`), new captain must be a member with `role='player'` (`:267-272`), old captain demoted to `player` (`:275-276`), `captain_id` update under `app.transferring_captain` flag (`:274-280`). No roster-lock/bracket restriction — undocumented but consistent.

**team_invites**

- One pending per team+player → partial unique index `202610171300:30-32` plus trigger check `:122-127`.
- Insert checks → `check_team_invite` `:73-138`: solo games (`:92-94`), self (`:96-98`), role='player' (`:100-102`), game profile (`:104-109`), already on team (`:111-113`), already on same-game team (`:115-120`), roster full (`:129-132`); forces status/created_at/responded_at `:134-136`.
- `respond_to_team_invite` → `:181-223`: `for update` on the invite row (`:191`), ownership+pending checks (`:193-198`), member insert re-runs `check_team_member` (`:203-204`), cancels other same-game pending invites (`:207-215`), sets accepted/declined (`:218-220`) — single transaction, so a failed accept leaves the invite pending. VERIFIED-CORRECT atomic.
- Captain cancels pending only → policy `:57-67` + `protect_team_invite` guard `:146-167` (columns frozen, pending→cancelled only, `responded_at` auto).
- `get_my_team_invites` / `get_team_invites` → `:332-357`, `:363-377`: SECURITY DEFINER, minimal columns (names/IGN/counts only), `get_team_invites` restricted to `t.captain_id = auth.uid()` (`:375`).

**Check-in**

- `checkin_window_minutes` default 30, 0=off → `202610171400_match_checkin.sql:18-20`.
- Window computed DB-side → `checkin_window` `:60-73` (`scheduled_at - interval .. scheduled_at`); `check_in_match` compares `now()` — DB clock, client clock irrelevant (`:109-115`); UI's `now` is display-only `utils/checkin.ts:18-25`, `app/matches/[id]/CheckinSection.tsx:32`.
- Captain of either team only → `:94-99`; match must be `scheduled` → `:101-103`; one row per team → `unique (match_id, team_id)` `:36` + `on conflict do nothing` `:117-119` (idempotent double-click).
- `scheduled_at` change clears check-ins + re-arms notification → `match_checkin_rules` `:137-140`.
- pg_cron `dalta-checkin-open-notifications` `*/5` → `:328-332` calls `send_checkin_open_notifications` `:288-322`: notifies **both captains** (`array[m.captain_a, m.captain_b]` `:313`; null captains skipped by the profiles join in `notify_users` `202610171200_notifications.sql:81-85`), dedupe via `checkin_notified_at` (`:307,:318`), `for update of mt` (`:311`) prevents double-notify on overlapping runs.

**Predictions**

- `check_prediction` `202610181100_predictions.sql:61-133`: lock at `status <> 'scheduled' or scheduled_at <= now()` (`:111`) — a pick at exactly `scheduled_at` is rejected; both teams known `:119-121`; pick ∈ {A,B} `:122-124`; admin/staff blocked `:100-103`; own-team members blocked `:125-130`; `is_correct`/ownership neutralized `:90-98`. `UNIQUE(user_id, match_id)` `:28`; own-row policies `:37-56` (insert requires `is_correct is null` `:45`).
- `mark_predictions` AFTER UPDATE OF winner_team_id `:144-169`: fires on set, change AND clear (`is_correct = null` when winner removed `:158`), gated by `app.marking_predictions` flag (`:155-162`); flag path only permits is_correct changes `:82-88`.
- `get_prediction_split` totals only, granted to anon+authenticated `:175-189` (slices `p_match_ids[1:200]`).
- `get_prediction_leaderboard` `:196-239`: top 20 + own row, "first name + initial" masking `:225-231`, authenticated only. UI `app/tournaments/[id]/PickemLeaderboard.tsx`, provider `components/PredictionsProvider.tsx`, picker `components/PredictionPicker.tsx`, shared rules `utils/predictions.ts:31-40` (mirror the DB rule).

## Findings

- **Required — one-team-per-game is racy across different teams.** `check_team_member` locks only the *new* team row (`for update of t`, `202610171000:360-365`), so accepting two invites for two different teams of the same game concurrently serializes on different rows: T1 `respond_to_team_invite` locks invite A → `check_team_member` sees no same-game membership (T2's insert uncommitted) → inserts `team_members(team X)`; T2 identically inserts `team_members(team Y)`; both commit → player on two teams for one game. The same interleaving applies to two concurrent team *creates* (each `setup_new_team` captain-insert checks a different team row, `202610161400:48-59`). There is no unique index or user-level lock backing the rule (`202610171000:391-399`). Fix: also `select ... for update` the player's `profiles` row (or a per-user advisory lock) inside `check_team_member`.
- **Required — team name uniqueness is case- and whitespace-sensitive.** `unique (name, game_id)` on raw `text` (`202610151200:112`) allows `"ABC"`, `"abc"` and `" ABC "` as distinct teams in the same game; contrast `profiles_student_id_unique` which uses `lower(school), lower(student_id)` (`202610171000:37-39`). The app trims (`app/teams/page.tsx:68`, `app/teams/[id]/page.tsx:96`) but raw API inserts bypass that. Fix: unique index on `(lower(trim(name)), game_id)`. *(Independently found by C — see findings-c nit 14.)*
- **Nit — organizers can set any registration status, with no tournament-state check.** "Admin/staff can update registrations" (`202610161500:97-101`) permits approved→pending, approved→cancelled, cancelled→pending, etc.; `check_registration_update` only re-checks capacity on re-activation (`202610171000:311-328`) and verification on approve (`:331-337`) — nothing stops approving/reactivating a registration for a cancelled or already-started tournament (the insert-only checks at `:225-237` don't run on update). UI exposes only Approve/Reject/Remove (`app/tournaments/[id]/registrations/page.tsx:193-217`), but the API accepts arbitrary valid values.
- **Nit — `predictions.created_at` (and `id`) are user-writable.** `check_prediction` freezes `user_id`, `match_id`, `predicted_winner_team_id` and `is_correct` on update (`202610181100:90-98`) but not `created_at`; a user can backdate picks and skew `report_engagement`'s date-filtered prediction counts (`:309-310`, `:364-373`). Low impact. *(Independently found by C — nit 9.)*
- **Nit — date boundaries use the DB's UTC `current_date`, ~8h off Manila.** `registration_deadline` (`202610171000:231`), `start_date` (`:235`), roster-lock `end_date` (`202610171300:313`) and the verification gate (`:410`) all compare `current_date` (UTC) to local dates. Registration effectively stays open until ~08:00 PH the day *after* the deadline, and rosters stay locked ~8h after the end date, while the UI hides the form at local midnight (`utils/tournaments.ts:48-53,69`). Harmless but worth documenting.
- **Nit — check-in vs reschedule micro-race.** `check_in_match` reads the match without a lock (`202610171400:89`); if staff commits a `scheduled_at` change between that read and the check-in insert, the insert survives `match_checkin_rules`' `delete from match_checkins` (`:137-138`), leaving a check-in recorded under a window that already moved. Fix: `select ... for update` on the match row.
- **Nit — staff can orphan the captain row.** The delete policy lets admin/staff remove *any* member including `role='captain'` (`202610151200:178-179`); `teams.captain_id` then still points at the removed user — they keep captain rights on teams/invites but vanish from `get_team_roster`, and (being no longer in `team_members`) could even pick their own team's match (`202610181100:125-130`). Edge case; UI never offers it. *(Independently found by C — nit 16.)*
- **Nit — deleting an account fails when the user's captained team is in a bracket.** `teams.captain_id on delete cascade` (`202610151200:110`) cascades the team delete into `prevent_team_delete_in_bracket` (`202610161700:166-171`), which raises → the whole account deletion aborts. Probably intended protection, but it blocks `admin_delete_user` with a bracket error rather than a clear explanation.
- **FYI — pending invites don't reserve roster slots.** `check_team_invite` counts members only (`202610171300:129-132`), so a captain can hold many pending invites for few open slots; excess accepts fail cleanly at member insert (the accept rolls back and the invite stays pending). Safe, but the "Invited" badge over-promises.
- **FYI — `registered_at` isn't pinned on insert.** The insert policy checks only user/status/captain (`202610161500:88-94`); a client can supply any `registered_at`, skewing sort order. Cosmetic.
- **FYI — check-in-open notifications go to captains only**, not the full roster (`202610171400:313`) — consistent with the migration comment but narrower than `match_scheduled`/`match_live` which notify all members (`202610171200:171`).
- **FYI — the `app.*` transaction flags** (`answering_invite`, `marking_predictions`, `declaring_forfeit`, `transferring_captain`, `reviewing_student`) are set via `set_config(..., true)` inside SECURITY DEFINER functions and can't be toggled through PostgREST, so the bypass paths aren't reachable from the client — verified by inspection.
- **FYI — `get_prediction_split` silently truncates to the first 200 match ids** (`202610181100:184`); fine for one bracket.

## Unverifiable locally

- The invite double-accept interleaving (and its team-create twin) needs two live concurrent sessions to confirm empirically; the code path makes it reachable in principle.
- Check-in vs reschedule and pick-at-lock races need concurrent transactions on a live DB; the missing `for update` is confirmed in code but the window is milliseconds.
- pg_cron: `cron.schedule` runs inside the migration (`202610171400:328-332`), but the file's own comment says the extension must be enabled manually in the dashboard — can't verify the job actually exists/runs on the hosted DB.
- Whether the live DB was actually migrated in order (e.g., `202610171000`'s redefinitions of `check_tournament_registration`/`check_registration_update`/`check_team_member` are the effective versions) can't be confirmed from files alone.
- Whether overlapping `send_checkin_open_notifications` runs truly serialize on `for update of mt` in production (they should under READ COMMITTED EvalPlanQual, but needs a live pg_cron to observe).
