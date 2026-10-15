-- Student verification (Modules 1 and 2): only verified students can join school tournaments.
-- - profiles: student_id, school, course_year (entered by the player) and the verification status
--   (set only by admin/staff through review_student_verification()).
-- - tournaments.requires_verification: every team member must be verified to register.
--   New tournaments: on by default. Existing tournaments: off, so teams already registering
--   aren't suddenly blocked (organizers can turn it on in Edit).
-- - Registration, approval and adding players re-check verification.
-- - get_team_roster() and search_players() also return is_verified (never the student ID).
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Profile columns
--    verification_status: unsubmitted -> pending (details saved) -> verified / rejected.
--    is_verified is calculated from the status, so it can never be set directly.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists student_id text check (length(student_id) between 1 and 30),
  add column if not exists school text check (length(school) between 2 and 120),
  add column if not exists course_year text check (length(course_year) between 1 and 60),
  add column if not exists verification_status text not null default 'unsubmitted'
    check (verification_status in ('unsubmitted', 'pending', 'verified', 'rejected')),
  -- Why it was rejected or revoked; shown to the player
  add column if not exists verification_note text check (length(verification_note) <= 300),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Separate statement: it is calculated from verification_status, added above
alter table public.profiles
  add column if not exists is_verified boolean generated always as (verification_status = 'verified') stored;

-- One account per student: the same student ID can't be used twice at the same school.
-- (The trigger below gives a readable message before this index is hit.)
create unique index if not exists profiles_student_id_unique
  on public.profiles (lower(school), lower(student_id))
  where student_id is not null and school is not null;

-- The verification page lists pending players
create index if not exists profiles_verification_status_idx on public.profiles (verification_status);

-- ---------------------------------------------------------------------------
-- 2. Student details rules (before every profile update):
--    - the status and review fields only change through review_student_verification()
--    - changing the details sends them for review again (even after being verified)
--    The SQL Editor (no auth.uid()) may change anything.
-- ---------------------------------------------------------------------------
create or replace function public.protect_student_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or coalesce(current_setting('app.reviewing_student', true), '') = 'on' then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
     or new.verification_note is distinct from old.verification_note
     or new.submitted_at is distinct from old.submitted_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'Only an organizer can verify or reject student details.';
  end if;

  -- Empty fields are saved as "not given"
  new.student_id := nullif(trim(new.student_id), '');
  new.school := nullif(trim(new.school), '');
  new.course_year := nullif(trim(new.course_year), '');

  if new.student_id is distinct from old.student_id
     or new.school is distinct from old.school
     or new.course_year is distinct from old.course_year then

    if new.role <> 'player' then
      raise exception 'Only player accounts need student verification.';
    end if;

    if new.student_id is not null and new.school is not null and exists (
      select 1 from public.profiles p
      where p.id <> new.id
        and lower(p.school) = lower(new.school)
        and lower(p.student_id) = lower(new.student_id)
    ) then
      raise exception 'Another account already uses this student ID at %.', new.school;
    end if;

    -- All three filled in = sent for review; otherwise not submitted
    if new.student_id is not null and new.school is not null and new.course_year is not null then
      new.verification_status := 'pending';
      new.submitted_at := now();
    else
      new.verification_status := 'unsubmitted';
      new.submitted_at := null;
    end if;
    new.verification_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  return new;
end $$;

drop trigger if exists profiles_student_verification on public.profiles;
create trigger profiles_student_verification
  before update on public.profiles
  for each row execute function public.protect_student_verification();

-- ---------------------------------------------------------------------------
-- 3. review_student_verification(user, approve, note): admin/staff verify, reject or revoke.
--    Rejecting or revoking needs a reason, which the player sees on their profile.
-- ---------------------------------------------------------------------------
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

revoke execute on function public.review_student_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_student_verification(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tournaments: requires_verification.
--    Added as false (existing tournaments), then new ones default to true.
-- ---------------------------------------------------------------------------
alter table public.tournaments add column if not exists requires_verification boolean not null default false;
alter table public.tournaments alter column requires_verification set default true;

-- Names of a team's members who aren't verified ('' when everyone is).
-- Used by the triggers below only, so nobody can call it from the app.
create or replace function public.unverified_team_members(p_team_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(string_agg(coalesce(p.full_name, p.email), ', ' order by p.full_name), '')
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
  where tm.team_id = p_team_id and not p.is_verified
$$;

revoke execute on function public.unverified_team_members(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Registration rules: same as 202610161600_tournament_details, plus verification.
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

  -- NEW: school tournaments only accept verified students
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
-- 6. Registration updates: same as 202610161500_registration_approval, plus
--    approving re-checks verification (a member may have changed their details since).
-- ---------------------------------------------------------------------------
create or replace function public.check_registration_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_teams int;
  active_count int;
  unverified text;
begin
  -- auth.uid() is null in the SQL Editor, which may change anything.
  if auth.uid() is not null and coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    if new.tournament_id is distinct from old.tournament_id
       or new.team_id is distinct from old.team_id
       or new.user_id is distinct from old.user_id
       or new.team_name is distinct from old.team_name
       or new.registered_at is distinct from old.registered_at then
      raise exception 'You can only cancel your registration.';
    end if;
  end if;

  if old.status in ('rejected', 'cancelled') and new.status in ('pending', 'approved') then
    select max_participants into max_teams
    from public.tournaments
    where id = new.tournament_id
    for update;

    if max_teams is not null then
      select count(*) into active_count
      from public.tournament_registrations
      where tournament_id = new.tournament_id
        and status in ('pending', 'approved')
        and id <> new.id;

      if active_count >= max_teams then
        raise exception 'This tournament is full (% teams).', max_teams;
      end if;
    end if;
  end if;

  -- NEW: approving checks that every member is (still) verified
  if new.status = 'approved' and old.status is distinct from 'approved' and new.team_id is not null
     and exists (select 1 from public.tournaments where id = new.tournament_id and requires_verification) then
    unverified := public.unverified_team_members(new.team_id);
    if unverified <> '' then
      raise exception 'This team can''t be approved yet. Not verified: %.', unverified;
    end if;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Adding team members: same as 202610161400_team_captain_management, plus a team
--    registered for a tournament that requires verification only takes verified players.
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

  -- NEW: the team is registered (pending/approved) for a tournament that requires
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
-- 8. Roster and player search also return is_verified, for the Verified badge.
--    Dropped first because the returned columns changed.
-- ---------------------------------------------------------------------------
drop function if exists public.get_team_roster(uuid);

create function public.get_team_roster(p_team_id uuid)
returns table (
  user_id uuid,
  full_name text,
  ign text,
  in_game_role text,
  role text,
  joined_at timestamptz,
  is_verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select tm.user_id, p.full_name, gp.ign, gp.in_game_role, tm.role, tm.joined_at, p.is_verified
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.profiles p on p.id = tm.user_id
  left join public.player_game_profiles gp
    on gp.user_id = tm.user_id and gp.game_id = t.game_id
  where tm.team_id = p_team_id
  order by tm.role = 'captain' desc, tm.joined_at
$$;

revoke execute on function public.get_team_roster(uuid) from public, anon;
grant execute on function public.get_team_roster(uuid) to authenticated;

drop function if exists public.search_players(text, text);

create function public.search_players(p_game_id text, p_search text)
returns table (user_id uuid, full_name text, ign text, in_game_role text, rank text, is_verified boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, gp.ign, gp.in_game_role, gp.rank, p.is_verified
  from public.player_game_profiles gp
  join public.profiles p on p.id = gp.user_id
  where gp.game_id = p_game_id
    and p.role = 'player'
    -- caller must captain a team in this game
    and exists (
      select 1 from public.teams t
      where t.captain_id = auth.uid() and t.game_id = p_game_id
    )
    -- skip players already on a team for this game
    and not exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = p.id and t.game_id = p_game_id
    )
    -- match IGN or name (strpos avoids treating % and _ as wildcards)
    and (
      strpos(lower(gp.ign), lower(trim(p_search))) > 0
      or strpos(lower(coalesce(p.full_name, '')), lower(trim(p_search))) > 0
    )
  order by gp.ign
  limit 20
$$;

revoke execute on function public.search_players(text, text) from public, anon;
grant execute on function public.search_players(text, text) to authenticated;

commit;
