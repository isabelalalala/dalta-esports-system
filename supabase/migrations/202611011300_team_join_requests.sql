-- Team directory + "Ask to join"
-- - teams.recruiting: the captain (or an organizer) opens the team to join requests
-- - team_join_requests: a player asks to join a recruiting team; the captain accepts or declines
--   with respond_to_join_request(). Accepting adds the player through the normal team_members
--   checks (roster size, one team per game, verification for registered tournaments).
-- - list_teams(): the "All teams" directory (captain name + roster count; profiles stay closed)
-- - get_team_join_requests(): open requests with names, for the captain and organizers
-- - notifications: join_request (captain), join_request_accepted / join_request_declined (player)
-- - activity log: team.join_request.accepted / team.join_request.declined
--
-- Invites keep working as before; requests are a second way in. Teams were already readable by
-- every logged-in user (202610151200), nothing new is opened to logged-out visitors.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Recruiting switch. Changed through set_team_recruiting() (captain or admin/staff);
--    the captain's existing update policy also allows it.
-- ---------------------------------------------------------------------------
alter table public.teams add column if not exists recruiting boolean not null default false;

create or replace function public.set_team_recruiting(p_team_id uuid, p_recruiting boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  captain uuid;
  solo boolean;
begin
  select t.captain_id, g.max_players <= 1 into captain, solo
  from public.teams t join public.games g on g.id = t.game_id
  where t.id = p_team_id;

  if not found then
    raise exception 'Team not found.';
  end if;
  if captain is distinct from auth.uid() and coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only the team captain can change this.';
  end if;
  if p_recruiting and solo then
    raise exception 'Solo teams have only one player, so they can''t recruit.';
  end if;

  update public.teams set recruiting = p_recruiting where id = p_team_id;
end $$;

revoke execute on function public.set_team_recruiting(uuid, boolean) from public, anon;
grant execute on function public.set_team_recruiting(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Join requests
-- ---------------------------------------------------------------------------
create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Optional note to the captain ("I main jungle, Mythic rank")
  message text check (message is null or char_length(message) <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- One open request per player per team
create unique index team_join_requests_one_open
  on public.team_join_requests (team_id, user_id) where status = 'pending';
create index team_join_requests_team_idx on public.team_join_requests (team_id, status);
create index team_join_requests_user_idx on public.team_join_requests (user_id, status);

alter table public.team_join_requests enable row level security;

-- The player who asked, the team's captain, and organizers
create policy "Player, captain and organizers view join requests"
  on public.team_join_requests for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
    or public.get_my_role() in ('admin', 'staff')
  );

create policy "Players ask to join for themselves"
  on public.team_join_requests for insert
  to authenticated
  with check (user_id = auth.uid());

-- "Cancel request" = delete your own open request
create policy "Players cancel their own open request"
  on public.team_join_requests for delete
  to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- No update policy: status changes only inside respond_to_join_request() (and when another
-- answer closes the request), both security definer.
revoke update on public.team_join_requests from anon, authenticated;

-- Same rules (and messages) as invites, checked when the request is made
create or replace function public.check_team_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team record;
  member_count int;
begin
  select t.captain_id, t.game_id, t.recruiting, g.name as game_name, g.max_players
    into team
  from public.teams t join public.games g on g.id = t.game_id
  where t.id = new.team_id;

  if not found then
    raise exception 'Team not found.';
  end if;

  if team.max_players <= 1 then
    raise exception '% teams have only one player, so they can''t take join requests.', team.game_name;
  end if;

  if not team.recruiting then
    raise exception 'This team isn''t recruiting right now.';
  end if;

  if not exists (select 1 from public.profiles where id = new.user_id and role = 'player') then
    raise exception 'Only player accounts can join teams.';
  end if;

  if not exists (
    select 1 from public.player_game_profiles
    where user_id = new.user_id and game_id = team.game_id
  ) then
    raise exception 'Add a % game profile on your Profile page first.', team.game_name;
  end if;

  if exists (select 1 from public.team_members where team_id = new.team_id and user_id = new.user_id) then
    raise exception 'You are already on this team.';
  end if;

  if exists (
    select 1 from public.team_members tm join public.teams t on t.id = tm.team_id
    where tm.user_id = new.user_id and t.game_id = team.game_id
  ) then
    raise exception 'You are already on a % team. Leave it first.', team.game_name;
  end if;

  if exists (
    select 1 from public.team_invites
    where team_id = new.team_id and invited_user_id = new.user_id and status = 'pending'
  ) then
    raise exception 'This team already invited you. Accept the invite on the Teams page.';
  end if;

  if exists (
    select 1 from public.team_join_requests
    where team_id = new.team_id and user_id = new.user_id and status = 'pending'
  ) then
    raise exception 'You already asked to join this team.';
  end if;

  select count(*) into member_count from public.team_members where team_id = new.team_id;
  if member_count >= team.max_players then
    raise exception 'This team is full (%/% players).', member_count, team.max_players;
  end if;

  new.message := nullif(trim(new.message), '');
  new.status := 'pending';
  new.created_at := now();
  new.responded_at := null;
  return new;
end $$;

create trigger team_join_requests_check
  before insert on public.team_join_requests
  for each row execute function public.check_team_join_request();

-- ---------------------------------------------------------------------------
-- 3. The captain answers. Accepting adds the player (team_members triggers check the roster
--    rules) and closes the player's other open requests and invites for the same game.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_join_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req record;
  team record;
begin
  select * into req from public.team_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;

  select captain_id, game_id into team from public.teams where id = req.team_id;
  if team.captain_id is distinct from auth.uid() then
    raise exception 'Only the team captain can answer join requests.';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request is no longer open.';
  end if;

  if p_accept then
    insert into public.team_members (team_id, user_id, role)
    values (req.team_id, req.user_id, 'player');

    -- One team per game: close their other open requests and invites for this game
    update public.team_join_requests r
    set status = 'cancelled', responded_at = now()
    from public.teams t
    where t.id = r.team_id and t.game_id = team.game_id
      and r.user_id = req.user_id and r.status = 'pending' and r.id <> req.id;

    perform set_config('app.answering_invite', 'on', true);
    update public.team_invites i
    set status = 'cancelled'
    from public.teams t
    where t.id = i.team_id and t.game_id = team.game_id
      and i.invited_user_id = req.user_id and i.status = 'pending';
    perform set_config('app.answering_invite', 'off', true);
  end if;

  update public.team_join_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = req.id;
end $$;

revoke execute on function public.respond_to_join_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_join_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lists for the app
-- ---------------------------------------------------------------------------
-- "All teams" directory. Captain name and roster count come from here because profiles
-- are readable only by their owner and organizers.
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

-- Open requests for one team, with the player's name and game profile.
-- Only the captain and organizers get rows.
create or replace function public.get_team_join_requests(p_team_id uuid)
returns table (
  request_id uuid, user_id uuid, full_name text, ign text, in_game_role text, rank text,
  is_verified boolean, message text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.user_id, p.full_name, gp.ign, gp.in_game_role, gp.rank, p.is_verified,
         r.message, r.created_at
  from public.team_join_requests r
  join public.teams t on t.id = r.team_id
  join public.profiles p on p.id = r.user_id
  left join public.player_game_profiles gp on gp.user_id = r.user_id and gp.game_id = t.game_id
  where r.team_id = p_team_id and r.status = 'pending'
    and (t.captain_id = auth.uid() or public.get_my_role() in ('admin', 'staff'))
  order by r.created_at
$$;

revoke execute on function public.get_team_join_requests(uuid) from public, anon;
grant execute on function public.get_team_join_requests(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Notifications: full type list (latest before this: 202611011200) + 3 new types
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
  'prediction_result'
));

create or replace function public.notify_team_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team record;
  player_name text;
begin
  select t.name, t.captain_id, g.name as game_name into team
  from public.teams t join public.games g on g.id = t.game_id
  where t.id = new.team_id;
  select coalesce(nullif(trim(full_name), ''), 'A player') into player_name
  from public.profiles where id = new.user_id;

  if tg_op = 'INSERT' then
    perform public.notify_users(array[team.captain_id], 'join_request', 'New join request',
      format('%s asked to join %s (%s).', player_name, team.name, team.game_name),
      '/teams/' || new.team_id);
  elsif new.status is distinct from old.status and new.status = 'accepted' then
    perform public.notify_users(array[new.user_id], 'join_request_accepted', 'Join request accepted',
      format('You are now on %s (%s).', team.name, team.game_name), '/teams/' || new.team_id);
  elsif new.status is distinct from old.status and new.status = 'declined' then
    perform public.notify_users(array[new.user_id], 'join_request_declined', 'Join request declined',
      format('%s didn''t accept your request this time.', team.name), '/teams');
  end if;
  return null;
end $$;

create trigger team_join_requests_notify
  after insert or update on public.team_join_requests
  for each row execute function public.notify_team_join_request();

-- ---------------------------------------------------------------------------
-- 6. Activity log: the captain's answer (names as they were; no emails)
-- ---------------------------------------------------------------------------
create or replace function public.log_team_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_name text;
  player_name text;
begin
  if new.status is not distinct from old.status or new.status not in ('accepted', 'declined') then
    return null;
  end if;

  select name into team_name from public.teams where id = new.team_id;
  select full_name into player_name from public.profiles where id = new.user_id;

  perform public.log_activity('team.join_request.' || new.status, 'team', new.team_id,
    jsonb_build_object('team_name', team_name, 'player_name', player_name));
  return null;
end $$;

create trigger team_join_requests_log
  after update on public.team_join_requests
  for each row execute function public.log_team_join_request();

-- Trigger functions aren't meant to be called directly
revoke execute on function public.check_team_join_request() from public, anon, authenticated;
revoke execute on function public.notify_team_join_request() from public, anon, authenticated;
revoke execute on function public.log_team_join_request() from public, anon, authenticated;

commit;
