-- Team invites (Module 2): players join a team by accepting the captain's invite.
-- - team_invites: the captain invites (insert) and cancels (update); the invited player
--   accepts or declines with respond_to_team_invite(). Accepting adds them to team_members.
-- - Captains can no longer add players directly.
-- - transfer_team_captaincy(): the captain hands the team to another member.
-- - The roster is locked while the team is registered (pending/approved) for a tournament
--   that hasn't ended. Admin/staff can still remove players.
-- - Notifications: invite received (player), accepted/declined (captain), made captain,
--   member left (captain), removed from team (player).
-- Roster sizes stay as they are in games (MLBB/Valorant/LoL/CODM 5-6, Tekken 8 1-1).
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  invited_user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- Only one open invite per team and player (old answered ones may stay)
create unique index team_invites_one_pending
  on public.team_invites (team_id, invited_user_id)
  where status = 'pending';

create index team_invites_invited_idx on public.team_invites (invited_user_id) where status = 'pending';

alter table public.team_invites enable row level security;

create policy "Invited player and captain can view invites"
  on public.team_invites for select
  to authenticated
  using (
    invited_user_id = auth.uid()
    or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );

create policy "Captain can invite players"
  on public.team_invites for insert
  to authenticated
  with check (
    status = 'pending'
    and invited_by = auth.uid()
    and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );

-- Captain: pending -> cancelled only (the trigger below guards the other columns).
-- Accepting and declining go through respond_to_team_invite().
create policy "Captain can cancel invites"
  on public.team_invites for update
  to authenticated
  using (
    status = 'pending'
    and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  )
  with check (
    status = 'cancelled'
    and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );
-- No delete policy: answered invites stay as history.

-- ---------------------------------------------------------------------------
-- 2. Invite rules with readable messages (the same rules are checked again on accept)
-- ---------------------------------------------------------------------------
create or replace function public.check_team_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team record;
  member_count int;
begin
  select t.captain_id, t.game_id, g.name as game_name, g.max_players
    into team
  from public.teams t join public.games g on g.id = t.game_id
  where t.id = new.team_id;

  if not found then
    raise exception 'Team not found.';
  end if;

  if team.max_players <= 1 then
    raise exception '% teams have only one player, so there''s no one to invite.', team.game_name;
  end if;

  if new.invited_user_id = team.captain_id then
    raise exception 'You can''t invite yourself.';
  end if;

  if not exists (select 1 from public.profiles where id = new.invited_user_id and role = 'player') then
    raise exception 'Only player accounts can be invited.';
  end if;

  if not exists (
    select 1 from public.player_game_profiles
    where user_id = new.invited_user_id and game_id = team.game_id
  ) then
    raise exception 'This player has no % game profile yet.', team.game_name;
  end if;

  if exists (select 1 from public.team_members where team_id = new.team_id and user_id = new.invited_user_id) then
    raise exception 'This player is already on your team.';
  end if;

  if exists (
    select 1 from public.team_members tm join public.teams t on t.id = tm.team_id
    where tm.user_id = new.invited_user_id and t.game_id = team.game_id
  ) then
    raise exception 'That player is already on another % team.', team.game_name;
  end if;

  if exists (
    select 1 from public.team_invites
    where team_id = new.team_id and invited_user_id = new.invited_user_id and status = 'pending'
  ) then
    raise exception 'This player already has an invite from your team.';
  end if;

  select count(*) into member_count from public.team_members where team_id = new.team_id;
  if member_count >= team.max_players then
    raise exception 'Your team is full (%/% players).', member_count, team.max_players;
  end if;

  new.status := 'pending';
  new.created_at := now();
  new.responded_at := null;
  return new;
end $$;

create trigger team_invites_check
  before insert on public.team_invites
  for each row execute function public.check_team_invite();

-- Updates: only a cancel by the captain, or an answer through respond_to_team_invite()
-- (which sets a flag for its own transaction). The SQL Editor (no auth.uid()) may change anything.
create or replace function public.protect_team_invite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.answering_invite', true), '') <> 'on' then
    if new.team_id is distinct from old.team_id
       or new.invited_user_id is distinct from old.invited_user_id
       or new.invited_by is distinct from old.invited_by
       or new.created_at is distinct from old.created_at
       or not (old.status = 'pending' and new.status = 'cancelled') then
      raise exception 'You can only cancel a pending invite.';
    end if;
  end if;

  if new.status is distinct from old.status then
    new.responded_at := now();
  end if;
  return new;
end $$;

create trigger team_invites_protect
  before update on public.team_invites
  for each row execute function public.protect_team_invite();

-- ---------------------------------------------------------------------------
-- 3. Players join only by accepting an invite (or by creating their own team)
-- ---------------------------------------------------------------------------
drop policy if exists "Captain can add players" on public.team_members;

-- respond_to_team_invite(invite, accept): the invited player accepts or declines.
-- Accepting runs the usual roster checks (check_team_member: team full, one team per game,
-- verified students for registered teams) and cancels their other open invites for that game.
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

revoke execute on function public.respond_to_team_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_team_invite(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Transfer captaincy. The captain can't otherwise be changed (protect_team_fields).
-- ---------------------------------------------------------------------------
create or replace function public.protect_team_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.game_id is distinct from old.game_id then
    raise exception 'A team''s game can''t be changed. Create a new team instead.';
  end if;
  if new.captain_id is distinct from old.captain_id
     and coalesce(current_setting('app.transferring_captain', true), '') <> 'on' then
    raise exception 'Use "Make captain" on the team page to change the captain.';
  end if;
  return new;
end $$;

create or replace function public.transfer_team_captaincy(p_team_id uuid, p_new_captain uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_captain uuid;
  team_name text;
begin
  select captain_id, name into current_captain, team_name
  from public.teams where id = p_team_id
  for update;

  if not found then
    raise exception 'Team not found.';
  end if;
  if current_captain is distinct from auth.uid() then
    raise exception 'Only the captain can hand over the team.';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_new_captain and role = 'player'
  ) then
    raise exception 'The new captain must be a player on this team.';
  end if;

  perform set_config('app.transferring_captain', 'on', true);
  update public.team_members set role = 'player'
  where team_id = p_team_id and user_id = current_captain;
  update public.team_members set role = 'captain'
  where team_id = p_team_id and user_id = p_new_captain;
  update public.teams set captain_id = p_new_captain where id = p_team_id;
  perform set_config('app.transferring_captain', 'off', true);

  perform public.notify_users(array[p_new_captain], 'team_captain', 'You are now captain',
    format('You are now the captain of %s.', team_name), '/teams/' || p_team_id);
end $$;

revoke execute on function public.transfer_team_captaincy(uuid, uuid) from public, anon;
grant execute on function public.transfer_team_captaincy(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Roster lock: no leaving or removing while the team is registered (pending/approved)
--    for a tournament that hasn't ended. Admin/staff can still remove players.
--    Deleting the whole team or an account (cascades) is not blocked here.
-- ---------------------------------------------------------------------------
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
     or coalesce(public.get_my_role(), '') in ('admin', 'staff') then
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

create trigger team_members_leave_check
  before delete on public.team_members
  for each row execute function public.check_team_member_leave();

-- ---------------------------------------------------------------------------
-- 6. Lookups. Players can't read other people's profiles, so names come from here.
-- ---------------------------------------------------------------------------

-- My open invites, with what the player needs to decide
create or replace function public.get_my_team_invites()
returns table (
  invite_id uuid,
  team_id uuid,
  team_name text,
  game_name text,
  captain_name text,
  member_count int,
  max_players int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, t.id, t.name, g.name, p.full_name,
         (select count(*)::int from public.team_members tm where tm.team_id = t.id),
         g.max_players, i.created_at
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  join public.games g on g.id = t.game_id
  left join public.profiles p on p.id = t.captain_id
  where i.invited_user_id = auth.uid() and i.status = 'pending'
  order by i.created_at desc
$$;

revoke execute on function public.get_my_team_invites() from public, anon;
grant execute on function public.get_my_team_invites() to authenticated;

-- A team's open invites (captain only)
create or replace function public.get_team_invites(p_team_id uuid)
returns table (invite_id uuid, user_id uuid, full_name text, ign text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.invited_user_id, p.full_name, gp.ign, i.created_at
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  join public.profiles p on p.id = i.invited_user_id
  left join public.player_game_profiles gp on gp.user_id = i.invited_user_id and gp.game_id = t.game_id
  where i.team_id = p_team_id and i.status = 'pending' and t.captain_id = auth.uid()
  order by i.created_at
$$;

revoke execute on function public.get_team_invites(uuid) from public, anon;
grant execute on function public.get_team_invites(uuid) to authenticated;

-- Player search for the captain: same as 202610171000_student_verification, plus
-- "invited" = already has an open invite from the captain's team for this game.
drop function if exists public.search_players(text, text);

create function public.search_players(p_game_id text, p_search text)
returns table (
  user_id uuid, full_name text, ign text, in_game_role text, rank text, is_verified boolean, invited boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, gp.ign, gp.in_game_role, gp.rank, p.is_verified,
         exists (
           select 1 from public.team_invites i
           join public.teams t on t.id = i.team_id
           where i.invited_user_id = p.id and i.status = 'pending'
             and t.captain_id = auth.uid() and t.game_id = p_game_id
         )
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

-- ---------------------------------------------------------------------------
-- 7. Notifications
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved', 'registration_rejected',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'team_added',  -- no longer sent (players join by invite); kept for older rows
  'member_left', 'member_removed',
  'student_verified', 'student_rejected', 'student_revoked'
));

-- Players aren't added directly anymore, so "added to a team" is replaced by invites
drop trigger if exists team_members_notify on public.team_members;
drop function if exists public.notify_team_member();

-- New invite -> the player; accepted / declined -> the captain
create or replace function public.notify_team_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team record;
  player_name text;
begin
  select t.name, t.captain_id, g.name as game_name, coalesce(nullif(trim(c.full_name), ''), 'A captain') as captain_name
    into team
  from public.teams t
  join public.games g on g.id = t.game_id
  left join public.profiles c on c.id = t.captain_id
  where t.id = new.team_id;

  if tg_op = 'INSERT' then
    perform public.notify_users(array[new.invited_user_id], 'team_invite', 'Team invite',
      format('%s invited you to join %s (%s).', team.captain_name, team.name, team.game_name), '/teams');
  elsif new.status in ('accepted', 'declined') and old.status = 'pending' then
    select coalesce(nullif(trim(full_name), ''), 'A player') into player_name
    from public.profiles where id = new.invited_user_id;

    perform public.notify_users(array[team.captain_id], 'invite_' || new.status,
      case when new.status = 'accepted' then 'Invite accepted' else 'Invite declined' end,
      format('%s %s your invite to %s.', player_name, new.status, team.name), '/teams/' || new.team_id);
  end if;
  return null;
end $$;

create trigger team_invites_notify
  after insert or update on public.team_invites
  for each row execute function public.notify_team_invite();

-- Member left -> the captain; removed by someone else -> that player.
-- Not for whole-team or account deletions (cascades).
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
  if pg_trigger_depth() > 1 or old.role = 'captain' then return null; end if;

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

create trigger team_members_notify_left
  after delete on public.team_members
  for each row execute function public.notify_team_member_left();

commit;
