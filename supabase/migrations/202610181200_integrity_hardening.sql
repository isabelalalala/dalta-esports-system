-- Integrity hardening (assessment areas C, D1, D2): closes the gaps where a
-- documented rule lived only in a comment or a half-checked guard.
-- - NULL boolean/enum arguments no longer slip past "reason required" checks.
-- - A stale result submission can't overwrite a completed/forfeited match, and
--   a forfeit closes any open submissions. Bracket regeneration refuses to run
--   while result submissions are still open.
-- - next_match_id must point at a scheduled match in the same tournament
--   (checked only when the value changes: feeders legitimately keep pointing
--   at a live match after the winner advances).
-- - One-team-per-game now locks the player's profile row, so two invites for
--   different same-game teams can't be accepted in parallel.
-- - Team names are unique per game ignoring case and surrounding whitespace.
-- - tournaments.status is NOT NULL; tournaments.updated_at is maintained;
--   feedback.topics is capped at 3; site-content links can't be "//host".
-- - created_at-style columns are pinned on registrations and predictions.
-- - Deleting a team with a pending/approved registration on a live tournament
--   is blocked (the captain must cancel/remove the registration first).
-- - unverified_team_members() no longer leaks member emails in error text.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. NULL arguments: "approve/confirm/accept" must be a real boolean, and the
--    review action must be one of the three known values.
-- ---------------------------------------------------------------------------

-- review_student_verification: NULL p_approve skipped the reason check and was
-- treated as a reject — it could revoke a verified player with no note.
create or replace function public.review_student_verification(
  p_user_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only organizers can verify students.';
  end if;

  if p_approve is null then
    raise exception 'Choose approve or reject.';
  end if;

  select verification_status, student_id, school, course_year
    into target
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User not found.';
  end if;

  if target.student_id is null or target.school is null or target.course_year is null then
    raise exception 'This player hasn''t submitted complete student details.';
  end if;

  if not p_approve and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Please give a reason, so the player knows what to fix.';
  end if;

  -- Lets the trigger above accept this change. "true" = only for this transaction.
  perform set_config('app.reviewing_student', 'on', true);

  update public.profiles
  set verification_status = case when p_approve then 'verified' else 'rejected' end,
      verification_note = case when p_approve then null else left(trim(p_note), 300) end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_user_id;

  perform set_config('app.reviewing_student', 'off', true);
end $$;

-- respond_to_match_result: NULL p_confirm disputed without a reason.
create or replace function public.respond_to_match_result(
  p_submission_id uuid,
  p_confirm boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  m record;
  label text;
begin
  select * into s from public.match_result_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Result not found.';
  end if;
  select * into m from public.matches where id = s.match_id;

  if not exists (
    select 1 from public.teams t
    where t.id in (m.team_a_id, m.team_b_id) and t.id <> s.team_id and t.captain_id = auth.uid()
  ) then
    raise exception 'Only the other team''s captain can confirm or dispute this result.';
  end if;
  if s.status <> 'pending' then
    raise exception 'This result has already been answered.';
  end if;
  if p_confirm is null then
    raise exception 'Please confirm or dispute the result.';
  end if;
  if not p_confirm and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Please explain what is wrong with the result.';
  end if;

  update public.match_result_submissions
  set status = case when p_confirm then 'confirmed' else 'disputed' end,
      dispute_reason = case when p_confirm then null else left(trim(p_reason), 500) end,
      responded_by = auth.uid(),
      responded_at = now()
  where id = p_submission_id;

  label := public.match_result_label(s.match_id, s.score_a, s.score_b);
  if p_confirm then
    perform public.notify_users(public.staff_ids(), 'result_confirmed', 'Result ready to approve',
      'Both captains agree: ' || label || '.', '/matches/' || s.match_id);
  else
    perform public.notify_users(public.staff_ids() || s.submitted_by, 'result_disputed', 'Result disputed',
      label || ' was disputed: ' || left(trim(p_reason), 200), '/matches/' || s.match_id);
  end if;
end $$;

-- respond_to_team_invite: NULL p_accept silently declined the invite.
create or replace function public.respond_to_team_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
  team_game text;
begin
  select * into inv from public.team_invites where id = p_invite_id for update;

  if not found or inv.invited_user_id is distinct from auth.uid() then
    raise exception 'Invite not found.';
  end if;
  if inv.status <> 'pending' then
    raise exception 'This invite is no longer open.';
  end if;
  if p_accept is null then
    raise exception 'Please accept or decline the invite.';
  end if;

  perform set_config('app.answering_invite', 'on', true);

  if p_accept then
    insert into public.team_members (team_id, user_id, role)
    values (inv.team_id, inv.invited_user_id, 'player');

    -- They can't join two teams for the same game, so other open invites for it are closed
    select game_id into team_game from public.teams where id = inv.team_id;
    update public.team_invites ti
    set status = 'cancelled'
    from public.teams t
    where t.id = ti.team_id
      and ti.invited_user_id = inv.invited_user_id
      and ti.status = 'pending'
      and ti.id <> inv.id
      and t.game_id = team_game;
  end if;

  update public.team_invites
  set status = case when p_accept then 'accepted' else 'declined' end
  where id = inv.id;

  perform set_config('app.answering_invite', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- 2. review_match_result: NULL action rejected; a completed match can't be
--    overwritten by a stale submission (reject stays allowed so staff can
--    clear a row left open by a forfeit or a direct edit).
-- ---------------------------------------------------------------------------
create or replace function public.review_match_result(
  p_submission_id uuid,
  p_action text,
  p_score_a int default null,
  p_score_b int default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  m record;
  final_a int;
  final_b int;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only tournament staff can review results.';
  end if;
  if p_action is null or p_action not in ('approve', 'override', 'reject') then
    raise exception 'Unknown action.';
  end if;

  select * into s from public.match_result_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Result not found.';
  end if;
  if s.status not in ('pending', 'confirmed', 'disputed') then
    raise exception 'This result has already been reviewed.';
  end if;
  select * into m from public.matches where id = s.match_id for update;

  -- Applying a score to a finished match (e.g. a forfeit declared while the
  -- submission sat open) would silently rewrite the result and the bracket.
  if m.status = 'completed' and p_action <> 'reject' then
    raise exception 'This match already has a result. Reject the submission instead.';
  end if;

  if p_action = 'reject' then
    if length(trim(coalesce(p_note, ''))) = 0 then
      raise exception 'Please give a reason, so the captains know what to submit.';
    end if;
    update public.match_result_submissions
    set status = 'rejected', review_note = left(trim(p_note), 500), reviewed_by = auth.uid(), reviewed_at = now()
    where id = s.id;

    perform public.notify_users(
      array(select captain_id from public.teams where id in (m.team_a_id, m.team_b_id)),
      'result_rejected', 'Result not accepted',
      'The submitted result was not accepted: ' || left(trim(p_note), 200) || ' Please submit it again.',
      '/matches/' || s.match_id);
    return;
  end if;

  if p_action = 'approve' then
    final_a := s.score_a;
    final_b := s.score_b;
  else
    if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
      raise exception 'Enter both scores for the override.';
    end if;
    if p_score_a = p_score_b then
      raise exception 'A match can''t end in a tie.';
    end if;
    final_a := p_score_a;
    final_b := p_score_b;
  end if;

  -- The match triggers check the rules and move the winner into the next match
  -- (refused if the next match has already started).
  update public.matches
  set score_a = final_a,
      score_b = final_b,
      winner_team_id = case when final_a > final_b then m.team_a_id else m.team_b_id end,
      status = 'completed'
  where id = m.id;

  update public.match_result_submissions
  set status = case when p_action = 'approve' then 'approved' else 'overridden' end,
      final_score_a = final_a, final_score_b = final_b,
      review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = s.id;

  perform public.notify_users(public.team_member_ids(array[m.team_a_id, m.team_b_id]),
    'result_approved', 'Result confirmed',
    'Final result: ' || public.match_result_label(m.id, final_a, final_b) ||
      case when p_action = 'override' then ' (set by tournament staff).' else '.' end,
    '/matches/' || m.id);
end $$;

-- ---------------------------------------------------------------------------
-- 3. declare_forfeit: a forfeit decides the match, so any submissions still
--    open are closed instead of lingering forever.
-- ---------------------------------------------------------------------------
create or replace function public.declare_forfeit(p_match_id uuid, p_winner_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  loser uuid;
  winner_name text;
  loser_name text;
  tour_name text;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only tournament staff can declare a forfeit.';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;
  if m.status = 'completed' then
    raise exception 'This match is already completed.';
  end if;
  if m.team_a_id is null or m.team_b_id is null then
    raise exception 'Both teams must be known before a forfeit can be declared.';
  end if;
  if p_winner_team_id is null or p_winner_team_id not in (m.team_a_id, m.team_b_id) then
    raise exception 'Choose one of the two teams as the winner.';
  end if;
  if m.scheduled_at is null or now() < m.scheduled_at then
    raise exception 'A forfeit can only be declared after the scheduled match time.';
  end if;

  perform set_config('app.declaring_forfeit', 'on', true);
  update public.matches
  set status = 'completed', winner_team_id = p_winner_team_id,
      score_a = null, score_b = null, is_forfeit = true
  where id = p_match_id;
  perform set_config('app.declaring_forfeit', 'off', true);

  -- The forfeit decides the match: close anything still waiting for an answer.
  update public.match_result_submissions
  set status = 'rejected',
      review_note = 'The match was decided by forfeit.',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where match_id = p_match_id and status in ('pending', 'confirmed', 'disputed');

  loser := case when p_winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  select name into winner_name from public.teams where id = p_winner_team_id;
  select name into loser_name from public.teams where id = loser;
  select name into tour_name from public.tournaments where id = m.tournament_id;

  perform public.notify_users(public.team_member_ids(array[m.team_a_id, m.team_b_id]),
    'match_forfeit', 'Match decided by forfeit',
    format('%s wins %s vs %s (%s) by forfeit.', winner_name, winner_name, loser_name, tour_name),
    '/matches/' || p_match_id);
end $$;

-- ---------------------------------------------------------------------------
-- 4. generate_bracket: regenerating also refuses while result submissions are
--    still open (they would be deleted unreviewed).
-- ---------------------------------------------------------------------------
create or replace function public.generate_bracket(p_tournament_id uuid)
returns int  -- number of matches created
language plpgsql
-- Runs with the caller's permissions, so the matches RLS (admin/staff only) applies too.
set search_path = ''
as $$
declare
  team_ids uuid[];
  team_count int;
  bracket_size int := 1;   -- teams rounded up to a power of two
  round_count int := 0;
  first_round_matches int;
  odd_positions int;
  bye_count int;
  matches_in_round int;
  next_id uuid;
  is_bye boolean;
  next_team int := 1;      -- position in team_ids of the next team to place
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only admin and staff can generate brackets.';
  end if;

  -- Lock the tournament so two people can't generate at the same time.
  perform 1 from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'Tournament not found.';
  end if;

  -- Regenerating is only allowed until a real match starts. Byes don't count:
  -- they are "completed" from the start but have only one team.
  if exists (
    select 1 from public.matches
    where tournament_id = p_tournament_id
      and status in ('live', 'completed')
      and team_a_id is not null and team_b_id is not null
  ) then
    raise exception 'A match has already started or finished, so the bracket can''t be regenerated.';
  end if;

  -- Open result submissions would be deleted unreviewed with the old bracket.
  if exists (
    select 1 from public.match_result_submissions s
    join public.matches m on m.id = s.match_id
    where m.tournament_id = p_tournament_id
      and s.status in ('pending', 'confirmed', 'disputed')
  ) then
    raise exception 'Review or reject the open result submissions before regenerating.';
  end if;

  -- Approved teams in random order
  select array_agg(team_id order by random()) into team_ids
  from public.tournament_registrations
  where tournament_id = p_tournament_id
    and status = 'approved'
    and team_id is not null;

  team_count := coalesce(array_length(team_ids, 1), 0);
  if team_count < 2 then
    raise exception 'At least 2 approved teams are needed to generate a bracket (there are %).', team_count;
  end if;

  -- e.g. 6 teams -> bracket of 8 -> 3 rounds, 2 byes
  while bracket_size < team_count loop
    bracket_size := bracket_size * 2;
    round_count := round_count + 1;
  end loop;
  bye_count := bracket_size - team_count;
  first_round_matches := bracket_size / 2;
  odd_positions := (first_round_matches + 1) / 2;

  delete from public.matches where tournament_id = p_tournament_id;

  -- Build from the final backwards, so each match can point at its next match
  -- (match m of round r feeds match ceil(m/2) of round r+1).
  for r in reverse round_count..1 loop
    matches_in_round := bracket_size / (1 << r);

    for m in 1..matches_in_round loop
      if r = round_count then
        next_id := null;  -- the final
      else
        select id into next_id
        from public.matches
        where tournament_id = p_tournament_id and round = r + 1 and match_number = (m + 1) / 2;
      end if;

      if r > 1 then
        -- Later rounds start empty; winners fill them in as matches finish.
        insert into public.matches (tournament_id, round, match_number, next_match_id)
        values (p_tournament_id, r, m, next_id);
      else
        -- Round 1. Byes go on odd-numbered matches first (1, 3, 5, ...), then even ones,
        -- so a team with a bye usually meets the winner of a real match in round 2.
        if m % 2 = 1 then
          is_bye := (m + 1) / 2 <= bye_count;
        else
          is_bye := odd_positions + m / 2 <= bye_count;
        end if;

        if is_bye then
          -- One team, already completed with that team as the winner.
          -- The advance trigger moves it into round 2 straight away.
          insert into public.matches
            (tournament_id, round, match_number, next_match_id, team_a_id, status, winner_team_id)
          values
            (p_tournament_id, 1, m, next_id, team_ids[next_team], 'completed', team_ids[next_team]);
          next_team := next_team + 1;
        else
          insert into public.matches
            (tournament_id, round, match_number, next_match_id, team_a_id, team_b_id)
          values
            (p_tournament_id, 1, m, next_id, team_ids[next_team], team_ids[next_team + 1]);
          next_team := next_team + 1;
        end if;
      end if;
    end loop;
  end loop;

  return bracket_size - 1;
end $$;

-- ---------------------------------------------------------------------------
-- 5. check_match: next_match_id may only be wired inside the same tournament,
--    forwards to a still-scheduled match, and never to the match itself.
--    Checked only when the value changes: a feeder legitimately keeps pointing
--    at a match that went live after its winner advanced.
-- ---------------------------------------------------------------------------
create or replace function public.check_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  -- A completed match always has a winner, and only completed matches have one.
  -- (Elimination matches can't end in a tie.)
  if new.status = 'completed' and new.winner_team_id is null then
    raise exception 'Choose a winner before marking the match as completed.';
  end if;
  if new.winner_team_id is not null and new.status <> 'completed' then
    raise exception 'A match with a winner must be marked as completed.';
  end if;

  -- Both teams must be known before a match is played.
  -- The only exception is a bye in round 1: one team, completed, and that team wins.
  if new.status in ('live', 'completed')
     and (new.team_a_id is null or new.team_b_id is null) then
    if not (new.round = 1 and new.status = 'completed') then
      raise exception 'Both teams must be known before this match can start.';
    end if;
  end if;

  -- If both scores are entered, the winner must have the higher score.
  if new.winner_team_id is not null and new.score_a is not null and new.score_b is not null then
    if (new.winner_team_id = new.team_a_id and new.score_a <= new.score_b)
       or (new.winner_team_id = new.team_b_id and new.score_b <= new.score_a) then
      raise exception 'The winner must have the higher score.';
    end if;
  end if;

  if new.next_match_id is not null
     and (tg_op = 'INSERT' or new.next_match_id is distinct from old.next_match_id) then
    if new.next_match_id = new.id then
      raise exception 'A match can''t feed into itself.';
    end if;
    if not exists (
      select 1 from public.matches nx
      where nx.id = new.next_match_id
        and nx.tournament_id = new.tournament_id
        and nx.status = 'scheduled'
    ) then
      raise exception 'The next match must be a scheduled match in the same tournament.';
    end if;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 6. check_in_match: lock the match row so a reschedule can't slip between the
--    window check and the check-in insert.
-- ---------------------------------------------------------------------------
create or replace function public.check_in_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  my_team uuid;
  w record;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;

  select t.id into my_team
  from public.teams t
  where t.id in (m.team_a_id, m.team_b_id) and t.captain_id = auth.uid();
  if my_team is null then
    raise exception 'Only the captain of a team in this match can check in.';
  end if;

  if m.status <> 'scheduled' then
    raise exception 'Check-in is closed: the match has already started or finished.';
  end if;

  select * into w from public.checkin_window(p_match_id);
  if not found then
    raise exception 'This match has no check-in (no time set, or check-in is off for the tournament).';
  end if;
  if now() < w.opens_at then
    raise exception 'Check-in opens at % (PH time).',
      to_char(w.opens_at at time zone 'Asia/Manila', 'FMHH12:MI AM, Mon FMDD');
  end if;
  if now() >= w.closes_at then
    raise exception 'Check-in closed at the match time. Contact a tournament staff member.';
  end if;

  insert into public.match_checkins (match_id, team_id, checked_in_by)
  values (p_match_id, my_team, auth.uid())
  on conflict (match_id, team_id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 7. check_team_member: lock the player's profile row too, so two same-game
--    joins on different teams can't interleave (each used to lock only its
--    own team row). Registration timestamps are server-set.
-- ---------------------------------------------------------------------------
create or replace function public.check_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_game text;
  game_name text;
  roster_max int;
  current_count int;
begin
  -- Lock the team row so two members added at the same moment can't
  -- both take the last spot.
  select t.game_id, g.name, g.max_players
    into team_game, game_name, roster_max
  from public.teams t
  join public.games g on g.id = t.game_id
  where t.id = new.team_id
  for update of t;

  -- Lock the joining player's row: two teams of the same game can't be joined
  -- in parallel, because the second insert waits here and then sees the first.
  perform 1 from public.profiles where id = new.user_id for update;

  select count(*) into current_count
  from public.team_members
  where team_id = new.team_id;

  if current_count >= roster_max then
    raise exception 'This team is full (%/% players).', current_count, roster_max;
  end if;

  -- The captain is added by setup_new_team(); these checks are for added players.
  if new.role = 'player' then
    if not exists (
      select 1 from public.profiles where id = new.user_id and role = 'player'
    ) then
      raise exception 'Only player accounts can be added to a team.';
    end if;

    if not exists (
      select 1 from public.player_game_profiles
      where user_id = new.user_id and game_id = team_game
    ) then
      raise exception 'This player has no % game profile yet.', game_name;
    end if;
  end if;

  -- One team per game per player.
  if exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = new.user_id and t.game_id = team_game
  ) then
    raise exception 'That player is already on a % team.', game_name;
  end if;

  -- The team is registered (pending/approved) for a tournament that requires
  -- verification and hasn't ended: the new player must be verified.
  if exists (
       select 1
       from public.tournament_registrations r
       join public.tournaments tr on tr.id = r.tournament_id
       where r.team_id = new.team_id
         and r.status in ('pending', 'approved')
         and tr.requires_verification
         and tr.end_date::date >= current_date
     )
     and not exists (select 1 from public.profiles where id = new.user_id and is_verified) then
    raise exception 'This team is registered for a tournament that only accepts verified students, and this player isn''t verified yet.';
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 8. check_tournament_registration: registered_at is set by the server.
-- ---------------------------------------------------------------------------
create or replace function public.check_tournament_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tour record;
  team_game text;
  game_min int;
  game_name text;
  member_count int;
  active_count int;
  unverified text;
begin
  new.registered_at := now();

  if new.team_id is null then
    raise exception 'Please choose a team to register.';
  end if;

  -- Lock the tournament row so two teams can't take the last slot at once.
  select status, game_id, start_date, registration_deadline, max_participants, requires_verification
    into tour
  from public.tournaments
  where id = new.tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found.';
  end if;

  if tour.status = 'cancelled' then
    raise exception 'This tournament has been cancelled.';
  end if;

  -- Dates are compared in the database time zone (UTC on Supabase).
  if tour.registration_deadline is not null
     and current_date > tour.registration_deadline::date then
    raise exception 'The registration deadline has passed.';
  end if;

  if tour.start_date is not null and current_date > tour.start_date::date then
    raise exception 'This tournament has already started.';
  end if;

  select t.game_id, g.min_players, g.name
    into team_game, game_min, game_name
  from public.teams t
  join public.games g on g.id = t.game_id
  where t.id = new.team_id;

  if team_game is distinct from tour.game_id then
    raise exception 'Your team plays %, but this tournament is for a different game.', game_name;
  end if;

  select count(*) into member_count
  from public.team_members where team_id = new.team_id;

  if member_count < game_min then
    raise exception 'Your team needs at least % players to register (it has %).', game_min, member_count;
  end if;

  if tour.requires_verification then
    unverified := public.unverified_team_members(new.team_id);
    if unverified <> '' then
      raise exception 'Only verified students can join this tournament. Not verified yet: %.', unverified;
    end if;
  end if;

  if exists (
    select 1 from public.tournament_registrations
    where tournament_id = new.tournament_id and team_id = new.team_id
  ) then
    raise exception 'Your team is already registered for this tournament.';
  end if;

  if tour.max_participants is not null then
    select count(*) into active_count
    from public.tournament_registrations
    where tournament_id = new.tournament_id
      and status in ('pending', 'approved');

    if active_count >= tour.max_participants then
      raise exception 'This tournament is full.';
    end if;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 9. check_prediction: id/created_at/updated_at are server-owned, on insert
--    and update (mark_predictions still passes through its own flag branch).
-- ---------------------------------------------------------------------------
create or replace function public.check_prediction()
returns trigger
language plpgsql
security definer   -- reads matches and team_members for the checks
set search_path = ''
as $$
declare
  m public.matches%rowtype;
  my_role text;
begin
  -- SQL Editor: no checks
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  -- The match or the account was deleted (cascade): always allowed
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  -- mark_predictions() may only set is_correct
  if tg_op = 'UPDATE' and current_setting('app.marking_predictions', true) = 'on' then
    if new.user_id is distinct from old.user_id or new.match_id is distinct from old.match_id
       or new.predicted_winner_team_id is distinct from old.predicted_winner_team_id then
      raise exception 'Only the result of a pick can be marked.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.match_id is distinct from old.match_id then
      raise exception 'A pick can''t be moved to another match or person.';
    end if;
    new.is_correct := old.is_correct;  -- users never set the result
    new.id := old.id;                  -- and never rewrite identity or dates
    new.created_at := old.created_at;
    new.updated_at := now();
  elsif tg_op = 'INSERT' then
    new.is_correct := null;
    new.id := gen_random_uuid();
    new.created_at := now();
    new.updated_at := now();
  end if;

  my_role := public.get_my_role();
  if my_role in ('admin', 'staff') then
    raise exception 'Organizers can''t make picks, because they decide the results.';
  end if;

  select * into m from public.matches where id = coalesce(new.match_id, old.match_id);
  if not found then
    raise exception 'That match doesn''t exist anymore.';
  end if;

  -- Locked once the match is live/completed or its time has passed
  if m.status <> 'scheduled' or (m.scheduled_at is not null and m.scheduled_at <= now()) then
    raise exception 'Picks for this match are closed.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if m.team_a_id is null or m.team_b_id is null then
    raise exception 'Picks open once both teams of this match are known.';
  end if;
  if new.predicted_winner_team_id not in (m.team_a_id, m.team_b_id) then
    raise exception 'Pick one of the two teams playing this match.';
  end if;
  if exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid() and tm.team_id in (m.team_a_id, m.team_b_id)
  ) then
    raise exception 'You can''t pick a match your own team is playing.';
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 10. protect_profile_role: the join date is not user-editable either.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and public.get_my_role() is distinct from 'admin' then
    raise exception 'Only an administrator can change roles.';
  end if;

  -- Applies in the SQL Editor too: promote someone else before demoting the last admin.
  if old.role = 'admin' and new.role is distinct from 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'There must be at least one administrator. Make someone else an admin first.';
  end if;

  -- The id and email must match auth.users, so they can't be edited here either.
  if new.id is distinct from old.id or new.email is distinct from old.email then
    if auth.uid() is not null then
      raise exception 'The account id and email can''t be changed here.';
    end if;
  end if;

  -- The join date feeds the signups report, so users can't rewrite it.
  if new.created_at is distinct from old.created_at and auth.uid() is not null then
    raise exception 'The join date can''t be changed.';
  end if;

  -- Consent is only given by the user, through give_privacy_consent().
  if (new.privacy_consent_at is distinct from old.privacy_consent_at
      or new.privacy_consent_version is distinct from old.privacy_consent_version)
     and auth.uid() is not null
     and coalesce(current_setting('app.giving_privacy_consent', true), '') <> 'on' then
    raise exception 'Privacy consent can only be given by the account owner on the consent page.';
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 11. prevent_team_delete_in_bracket: also block while the team is registered
--     (pending/approved) for a tournament that hasn't ended — deleting the
--     team used to silently cascade the registration away, bypassing the
--     "captain can cancel only while pending" rule. Cascades (account delete)
--     are exempt, same as the roster lock.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_team_delete_in_bracket()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.matches
    where team_a_id = old.id or team_b_id = old.id or winner_team_id = old.id
  ) then
    raise exception 'This team is in a tournament bracket, so it can''t be deleted. Ask an organizer.';
  end if;

  if pg_trigger_depth() = 1 and auth.uid() is not null and exists (
    select 1 from public.tournament_registrations r
    join public.tournaments tr on tr.id = r.tournament_id
    where r.team_id = old.id
      and r.status in ('pending', 'approved')
      and tr.end_date::date >= current_date
  ) then
    raise exception 'This team is registered for a tournament. Remove its registration first.';
  end if;

  return old;
end $$;

-- ---------------------------------------------------------------------------
-- 12. unverified_team_members: names only — a captain sees the error text and
--     must not get a teammate's email out of it.
-- ---------------------------------------------------------------------------
create or replace function public.unverified_team_members(p_team_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(string_agg(coalesce(nullif(p.full_name, ''), 'A team member'), ', ' order by p.full_name), '')
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
  where tm.team_id = p_team_id and not p.is_verified
$$;

revoke execute on function public.unverified_team_members(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13. Table-level invariants
-- ---------------------------------------------------------------------------

-- status is one of upcoming/cancelled, never NULL
update public.tournaments set status = 'upcoming' where status is null;
alter table public.tournaments alter column status set not null;

-- updated_at is documented and expected; nothing maintained it until now
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tournaments_touch on public.tournaments;
create trigger tournaments_touch
  before update on public.tournaments
  for each row execute function public.touch_updated_at();

-- feedback.topics: at most 3 labels (save_feedback_sentiment already caps it)
alter table public.feedback drop constraint if exists feedback_topics_max;
alter table public.feedback
  add constraint feedback_topics_max check (cardinality(topics) <= 3);

-- Team names are unique per game ignoring case and surrounding whitespace
alter table public.teams drop constraint if exists teams_name_game_id_key;
create unique index if not exists teams_name_game_key
  on public.teams (lower(btrim(name)), game_id);

-- Site-content links: "//host" must not pass as an app path
alter table public.hero_images drop constraint if exists hero_images_link_check;
alter table public.hero_images add constraint hero_images_link_check
  check (link is null or link like 'https://%' or (link like '/%' and link not like '//%'));
alter table public.campaigns drop constraint if exists campaigns_link_check;
alter table public.campaigns add constraint campaigns_link_check
  check (link is null or link like 'https://%' or (link like '/%' and link not like '//%'));
alter table public.events drop constraint if exists events_link_check;
alter table public.events add constraint events_link_check
  check (link is null or link like 'https://%' or (link like '/%' and link not like '//%'));

-- Hot-path lookups that used to seq-scan
create index if not exists team_members_user_idx on public.team_members (user_id);
create index if not exists tournament_registrations_team_idx on public.tournament_registrations (team_id);
create index if not exists feedback_user_idx on public.feedback (user_id);

-- Editing a game profile needs the player role, same as adding one
-- (deleting stays own-only so a demoted player can still clean up old rows).
drop policy if exists "Users can edit their own game profiles" on public.player_game_profiles;
create policy "Users can edit their own game profiles"
  on public.player_game_profiles for update
  to authenticated
  using (user_id = auth.uid() and public.get_my_role() = 'player')
  with check (user_id = auth.uid() and public.get_my_role() = 'player');

commit;
