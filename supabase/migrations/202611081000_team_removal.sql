-- Phase 1.2: Admin/Staff can remove a team (soft delete).
--
-- - teams gets is_removed / removed_by / removed_at. The row stays, so brackets, past
--   matches and reports keep the team's name.
-- - team_removals keeps the reason, the roster at the time and what was withdrawn. It is a
--   separate table because every logged-in user can read teams, and the reason is for
--   organizers only.
-- - remove_team(team, reason) (admin/staff):
--     1. withdraws the team's pending/approved registrations for tournaments that haven't ended
--     2. cancels open invites and join requests, stops recruiting
--     3. gives every unfinished match the team is in to the opponent as a walkover
--        (if the opponent isn't known yet, the walkover happens as soon as they are)
--     4. frees the members (the roster is saved in team_removals) so they can join other teams
--     5. notifies the members and writes 'team.removed' to the activity log
-- - restore_team(team) (admin only): the team comes back with its captain and every former
--   member who is still free. Withdrawn registrations and walkovers are NOT undone.
-- - A removed team can't be edited, deleted, invited to, asked to join or registered.
-- - list_teams() leaves removed teams out.
--
-- Redefined (latest versions copied first):
--   check_team_member_leave()  <- 202611011000_roster_captain_guard
--   notify_team_member_left()  <- 202610171300_team_invites
--   list_teams()               <- 202611011300_team_join_requests
--   notifications_type_check   <- 202611011300_team_join_requests
--
-- Run in the Supabase SQL Editor after 202611011300_team_join_requests.sql.
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns on teams
-- ---------------------------------------------------------------------------
alter table public.teams
  add column if not exists is_removed boolean not null default false,
  add column if not exists removed_by uuid references public.profiles (id) on delete set null,
  add column if not exists removed_at timestamptz;

create index if not exists teams_is_removed_idx on public.teams (is_removed);

-- ---------------------------------------------------------------------------
-- 2. team_removals: one row per removal (a team removed, restored and removed again has two)
-- ---------------------------------------------------------------------------
create table if not exists public.team_removals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  removed_by uuid references public.profiles (id) on delete set null,
  removed_at timestamptz not null default now(),
  reason text not null check (char_length(reason) between 5 and 500),
  -- [{ "user_id", "full_name", "role" }] as it was when the team was removed
  roster jsonb not null default '[]',
  -- names of the tournaments whose registrations were withdrawn
  tournaments jsonb not null default '[]',
  walkovers int not null default 0,
  restored_by uuid references public.profiles (id) on delete set null,
  restored_at timestamptz
);

create index if not exists team_removals_team_idx on public.team_removals (team_id, removed_at desc);

alter table public.team_removals enable row level security;

drop policy if exists "Organizers read team removals" on public.team_removals;
create policy "Organizers read team removals"
  on public.team_removals for select
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'));

-- Written only by remove_team() / restore_team()
revoke insert, update, delete on public.team_removals from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A removed team can't be changed or deleted, and nobody sets the removal
--    columns by hand. remove_team()/restore_team() set the flag app.removing_team.
-- ---------------------------------------------------------------------------
create or replace function public.protect_team_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- SQL Editor, the two functions, and cascades (e.g. the captain's account is deleted)
  if auth.uid() is null
     or coalesce(current_setting('app.removing_team', true), '') = 'on'
     or pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.is_removed then
      raise exception 'This team was removed by the organizers and is kept for reports, so it can''t be deleted.';
    end if;
    return old;
  end if;

  if new.is_removed is distinct from old.is_removed
     or new.removed_by is distinct from old.removed_by
     or new.removed_at is distinct from old.removed_at then
    raise exception 'Use "Remove team" on the team page to remove or restore a team.';
  end if;

  if old.is_removed then
    raise exception 'This team was removed by the organizers and can''t be changed.';
  end if;

  return new;
end $$;

drop trigger if exists teams_protect_removal on public.teams;
create trigger teams_protect_removal
  before update or delete on public.teams
  for each row execute function public.protect_team_removal();

-- New members, invites, join requests and registrations are refused for a removed team.
-- (Cancelling a registration stays allowed.)
create or replace function public.refuse_removed_team()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'tournament_registrations' and new.status not in ('pending', 'approved') then
    return new;
  end if;

  if exists (select 1 from public.teams where id = new.team_id and is_removed) then
    raise exception 'This team was removed by the organizers.';
  end if;
  return new;
end $$;

drop trigger if exists team_members_refuse_removed on public.team_members;
create trigger team_members_refuse_removed
  before insert on public.team_members
  for each row execute function public.refuse_removed_team();

drop trigger if exists team_invites_refuse_removed on public.team_invites;
create trigger team_invites_refuse_removed
  before insert on public.team_invites
  for each row execute function public.refuse_removed_team();

drop trigger if exists team_join_requests_refuse_removed on public.team_join_requests;
create trigger team_join_requests_refuse_removed
  before insert on public.team_join_requests
  for each row execute function public.refuse_removed_team();

drop trigger if exists registrations_refuse_removed on public.tournament_registrations;
create trigger registrations_refuse_removed
  before insert or update of status, team_id on public.tournament_registrations
  for each row execute function public.refuse_removed_team();

-- ---------------------------------------------------------------------------
-- 4. Freeing the members: removal deletes the team_members rows (captain included)
--    without the roster lock, the captain guard or "removed from a team" notifications
--    (the members get one "team removed" notification instead).
-- ---------------------------------------------------------------------------

-- Latest version from 202611011000_roster_captain_guard, plus the app.removing_team skip.
create or replace function public.check_team_member_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tour_name text;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null
     or coalesce(current_setting('app.removing_team', true), '') = 'on' then
    return old;
  end if;

  -- Applies to everyone, admin/staff included
  if old.role = 'captain' then
    raise exception 'The captain can''t be removed from the team. Transfer the captaincy first, or delete the team.';
  end if;

  -- Organizers may change a locked roster
  if coalesce(public.get_my_role(), '') in ('admin', 'staff') then
    return old;
  end if;

  select tr.name into tour_name
  from public.tournament_registrations r
  join public.tournaments tr on tr.id = r.tournament_id
  where r.team_id = old.team_id
    and r.status in ('pending', 'approved')
    and tr.end_date::date >= current_date
  limit 1;

  if tour_name is not null then
    raise exception 'The roster is locked while the team is registered for %. Ask an organizer if a player must leave.', tour_name;
  end if;

  return old;
end $$;

-- Latest version from 202610171300_team_invites, plus the app.removing_team skip.
create or replace function public.notify_team_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team record;
  player_name text;
begin
  if pg_trigger_depth() > 1 or old.role = 'captain'
     or coalesce(current_setting('app.removing_team', true), '') = 'on' then
    return null;
  end if;

  select name, captain_id into team from public.teams where id = old.team_id;
  if not found then return null; end if;

  if auth.uid() = old.user_id then
    select coalesce(nullif(trim(full_name), ''), 'A player') into player_name
    from public.profiles where id = old.user_id;
    perform public.notify_users(array[team.captain_id], 'member_left', 'A member left your team',
      format('%s left %s.', player_name, team.name), '/teams/' || old.team_id);
  else
    perform public.notify_users(array[old.user_id], 'member_removed', 'Removed from a team',
      format('You were removed from %s.', team.name), '/teams');
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Walkovers
--    apply_removed_team_walkover(match): if one of the two teams is removed and the match
--    isn't finished, the other team wins by forfeit. The existing advance trigger then moves
--    the winner forward. Returns true when it decided the match.
-- ---------------------------------------------------------------------------
create or replace function public.apply_removed_team_walkover(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  a_removed boolean;
  b_removed boolean;
  winner uuid;
  loser_name text;
  tour_name text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.status = 'completed' or m.team_a_id is null or m.team_b_id is null then
    return false;
  end if;

  select is_removed into a_removed from public.teams where id = m.team_a_id;
  select is_removed into b_removed from public.teams where id = m.team_b_id;
  if not (coalesce(a_removed, false) or coalesce(b_removed, false)) then
    return false;
  end if;

  -- The team still in the event wins. If both were removed, team A goes through and the
  -- same rule decides its next match.
  winner := case when a_removed and not coalesce(b_removed, false) then m.team_b_id else m.team_a_id end;

  -- is_forfeit may only be set under this flag (match_checkin_rules trigger)
  perform set_config('app.declaring_forfeit', 'on', true);
  update public.matches
  set status = 'completed', winner_team_id = winner,
      score_a = null, score_b = null, is_forfeit = true
  where id = p_match_id;
  perform set_config('app.declaring_forfeit', 'off', true);

  -- The walkover decides the match: close any result submission still open
  update public.match_result_submissions
  set status = 'rejected',
      review_note = 'The match was decided by walkover: a team was removed by the organizers.',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where match_id = p_match_id and status in ('pending', 'confirmed', 'disputed');

  select name into loser_name from public.teams
  where id = case when winner = m.team_a_id then m.team_b_id else m.team_a_id end;
  select name into tour_name from public.tournaments where id = m.tournament_id;

  perform public.notify_users(public.team_member_ids(array[winner]),
    'match_forfeit', 'Match decided by walkover',
    format('You advance in %s: %s was removed by the organizers.', tour_name, loser_name),
    '/matches/' || p_match_id);

  return true;
end $$;

revoke execute on function public.apply_removed_team_walkover(uuid) from public, anon, authenticated;

-- A removed team's opponent wasn't known yet: decide the match as soon as it is.
-- Fires when a winner moves into the match (advance trigger) or staff set a team by hand.
create or replace function public.walkover_on_team_arrival()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'completed'
     and new.team_a_id is not null and new.team_b_id is not null then
    perform public.apply_removed_team_walkover(new.id);
  end if;
  return null;
end $$;

drop trigger if exists matches_removed_team_walkover on public.matches;
create trigger matches_removed_team_walkover
  after update of team_a_id, team_b_id on public.matches
  for each row execute function public.walkover_on_team_arrival();

-- ---------------------------------------------------------------------------
-- 6. remove_team(team, reason): admin/staff
-- ---------------------------------------------------------------------------
create or replace function public.remove_team(p_team_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  clean_reason text := trim(coalesce(p_reason, ''));
  roster jsonb;
  member_ids uuid[];
  tours jsonb;
  removal_id uuid;
  walkover_count int := 0;
  match_id uuid;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only admins and tournament staff can remove a team.';
  end if;
  if char_length(clean_reason) < 5 then
    raise exception 'Please give a reason for removing the team (at least 5 characters).';
  end if;
  if char_length(clean_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.';
  end if;

  select tm.id, tm.name, tm.is_removed, g.name as game_name
    into t
  from public.teams tm
  join public.games g on g.id = tm.game_id
  where tm.id = p_team_id
  for update of tm;

  if not found then
    raise exception 'Team not found.';
  end if;
  if t.is_removed then
    raise exception 'This team was already removed.';
  end if;

  -- Keep the roster for the record before the members are freed
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', tm.user_id, 'full_name', public.log_name(tm.user_id), 'role', tm.role)
           order by (tm.role = 'captain') desc, tm.joined_at), '[]'),
         coalesce(array_agg(tm.user_id), '{}')
    into roster, member_ids
  from public.team_members tm
  where tm.team_id = p_team_id;

  select coalesce(jsonb_agg(distinct tr.name), '[]')
    into tours
  from public.tournament_registrations r
  join public.tournaments tr on tr.id = r.tournament_id
  where r.team_id = p_team_id
    and r.status in ('pending', 'approved')
    and tr.end_date::date >= current_date;

  perform set_config('app.removing_team', 'on', true);

  -- 1. Withdraw registrations for tournaments that haven't ended
  update public.tournament_registrations r
  set status = 'cancelled'
  from public.tournaments tr
  where tr.id = r.tournament_id
    and r.team_id = p_team_id
    and r.status in ('pending', 'approved')
    and tr.end_date::date >= current_date;

  -- 2. Close open invites and join requests, stop recruiting, mark removed
  update public.team_invites
  set status = 'cancelled'
  where team_id = p_team_id and status = 'pending';

  update public.team_join_requests
  set status = 'cancelled', responded_at = now()
  where team_id = p_team_id and status = 'pending';

  update public.teams
  set is_removed = true, removed_by = auth.uid(), removed_at = now(), recruiting = false
  where id = p_team_id;

  insert into public.team_removals (team_id, removed_by, reason, roster, tournaments)
  values (p_team_id, auth.uid(), clean_reason, roster, tours)
  returning id into removal_id;

  -- 3. Walkovers for every unfinished match the team is in (normally at most one).
  --    Matches whose opponent isn't known yet are decided later by the trigger above.
  for match_id in
    select id from public.matches
    where (team_a_id = p_team_id or team_b_id = p_team_id) and status <> 'completed'
    order by round
  loop
    if public.apply_removed_team_walkover(match_id) then
      walkover_count := walkover_count + 1;
    end if;
  end loop;

  update public.team_removals set walkovers = walkover_count where id = removal_id;

  -- 4. Free the members so they can join another team for this game
  delete from public.team_members where team_id = p_team_id;

  perform set_config('app.removing_team', 'off', true);

  -- 5. Tell the members and log it
  perform public.notify_users(member_ids, 'team_removed', 'Your team was removed',
    format('%s (%s) was removed by the organizers. Reason: %s', t.name, t.game_name, clean_reason),
    '/teams/' || p_team_id);

  perform public.log_activity('team.removed', 'team', p_team_id, jsonb_build_object(
    'team_name', t.name,
    'game', t.game_name,
    'note', clean_reason,
    'members', jsonb_array_length(roster),
    'tournaments', tours,
    'walkovers', walkover_count));

  return jsonb_build_object(
    'members', jsonb_array_length(roster),
    'withdrawn', jsonb_array_length(tours),
    'walkovers', walkover_count);
end $$;

revoke execute on function public.remove_team(uuid, text) from public, anon;
grant execute on function public.remove_team(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. restore_team(team): admin only. The captain must still be a player who isn't on
--    another team for this game. Former members come back if they still can; the others
--    are listed in the result so the captain can invite them again.
-- ---------------------------------------------------------------------------
create or replace function public.restore_team(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  last_removal record;
  member record;
  restored uuid[] := '{}';
  skipped text[] := '{}';
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can restore a removed team.';
  end if;

  select tm.id, tm.name, tm.captain_id, tm.game_id, tm.is_removed, g.name as game_name
    into t
  from public.teams tm
  join public.games g on g.id = tm.game_id
  where tm.id = p_team_id
  for update of tm;

  if not found then
    raise exception 'Team not found.';
  end if;
  if not t.is_removed then
    raise exception 'This team isn''t removed.';
  end if;

  if not exists (select 1 from public.profiles where id = t.captain_id and role = 'player') then
    raise exception 'The captain no longer has a player account, so this team can''t be restored.';
  end if;
  if exists (
    select 1 from public.team_members tm
    join public.teams x on x.id = tm.team_id
    where tm.user_id = t.captain_id and x.game_id = t.game_id
  ) then
    raise exception 'The captain is now on another % team, so this team can''t be restored.', t.game_name;
  end if;

  select * into last_removal
  from public.team_removals
  where team_id = p_team_id and restored_at is null
  order by removed_at desc
  limit 1;

  perform set_config('app.removing_team', 'on', true);

  update public.teams
  set is_removed = false, removed_by = null, removed_at = null
  where id = p_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, t.captain_id, 'captain');

  -- Former players: the normal roster checks apply (still a player, has a game profile,
  -- not on another team for this game). Anyone who fails them is skipped.
  for member in
    select x.user_id, x.full_name
    from jsonb_to_recordset(coalesce(last_removal.roster, '[]'::jsonb)) as x(user_id uuid, full_name text, role text)
    where x.role = 'player'
  loop
    begin
      insert into public.team_members (team_id, user_id, role)
      values (p_team_id, member.user_id, 'player');
      restored := restored || member.user_id;
    exception when others then
      skipped := skipped || coalesce(member.full_name, 'A player');
    end;
  end loop;

  if last_removal.id is not null then
    update public.team_removals
    set restored_by = auth.uid(), restored_at = now()
    where id = last_removal.id;
  end if;

  perform set_config('app.removing_team', 'off', true);

  perform public.notify_users(restored || t.captain_id, 'team_restored', 'Your team was restored',
    format('%s (%s) was restored by the organizers. Withdrawn registrations and walkovers stay as they were.',
           t.name, t.game_name),
    '/teams/' || p_team_id);

  perform public.log_activity('team.restored', 'team', p_team_id, jsonb_build_object(
    'team_name', t.name,
    'game', t.game_name,
    'members', coalesce(array_length(restored, 1), 0) + 1,
    'skipped', to_jsonb(skipped)));

  return jsonb_build_object(
    'members', coalesce(array_length(restored, 1), 0) + 1,
    'skipped', to_jsonb(skipped));
end $$;

revoke execute on function public.restore_team(uuid) from public, anon;
grant execute on function public.restore_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. list_teams(): latest version from 202611011300_team_join_requests, without removed teams
-- ---------------------------------------------------------------------------
create or replace function public.list_teams(
  p_search text default null,
  p_game_id text default null,
  p_recruiting_only boolean default false,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid, name text, description text, game_id text, game_name text,
  captain_id uuid, captain_name text, member_count int, max_players int,
  recruiting boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.description, t.game_id, g.name, t.captain_id, p.full_name,
         (select count(*)::int from public.team_members tm where tm.team_id = t.id),
         g.max_players, t.recruiting, t.created_at
  from public.teams t
  join public.games g on g.id = t.game_id
  left join public.profiles p on p.id = t.captain_id
  where auth.uid() is not null
    and not t.is_removed
    and (p_game_id is null or t.game_id = p_game_id)
    and (not p_recruiting_only or t.recruiting)
    -- plain substring search (no LIKE wildcards to escape)
    and (coalesce(trim(p_search), '') = '' or position(lower(trim(p_search)) in lower(t.name)) > 0)
  order by lower(t.name)
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke execute on function public.list_teams(text, text, boolean, int, int) from public, anon;
grant execute on function public.list_teams(text, text, boolean, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Notification types: latest list from 202611011300_team_join_requests + team_removed,
--    team_restored
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved', 'registration_rejected', 'registration_removed',
  'registration_submitted', 'registration_withdrawn',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'checkin_open', 'match_forfeit',
  'result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected',
  'tournament_cancelled',
  'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'team_added',  -- no longer sent (players join by invite); kept for older rows
  'member_left', 'member_removed',
  'join_request', 'join_request_accepted', 'join_request_declined',
  'student_verified', 'student_rejected', 'student_revoked',
  'verification_submitted', 'role_changed',
  'prediction_result',
  'team_removed', 'team_restored'
));

commit;
