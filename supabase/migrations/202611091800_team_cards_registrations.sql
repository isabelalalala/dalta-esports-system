-- Phase 10: better team cards and registration cards
--
-- 1. teams.logo_url: public address of the team's logo in the new `team-logos` bucket. It must
--    point into that team's own folder (CHECK). Only the captain changes it (the existing update
--    policy); admins/staff can only REMOVE one, through remove_team_logo(team, reason), which logs
--    it and tells the captain (flag app.removing_team_logo, trigger protect_team_logo()).
-- 2. Storage bucket `team-logos`: public read (logos are shown on team cards), JPG/PNG/WebP, 2 MB,
--    paths <team id>/<random>.webp. The captain writes only in their team's folder; admins and
--    staff may delete any logo (after remove_team_logo()).
-- 3. teams.looking_for (jsonb): what a recruiting team needs, picked by the captain from that game's
--    profile form (202611091400_game_profile_schemas): { "roles": [role option ids, max 3],
--    "rank_min": rank option id | null }. Checked by check_team_looking_for(). Shown only while
--    the team is recruiting.
-- 4. tournament_registrations.rejection_reason: optional reason an organizer gives when
--    rejecting (max 300 characters). Only admin/staff set it; it is cleared automatically when the
--    status changes to anything else (trigger clean_registration_reason()). notify_registration()
--    (latest: 202610181500_notification_audit_gaps) adds it to the captain's notification.
-- 5. list_teams() (latest: 202611081000_team_removal) is dropped and re-created with more columns
--    (logo, looking_for, captain avatar, first member avatars, is_member, my join request, total
--    count) and options: sort, role and rank filters. Still logged-in only and names/avatars only,
--    which logged-in users already see on rosters.
-- 6. Notification type 'team_logo_removed' (full list copied from 202611081500_comments_moderation).
--
-- No new table, so no new RLS policies besides the storage ones. The Privacy Notice doesn't change:
-- team logos and rejection reasons are not personal data.
-- Run in the Supabase SQL Editor after 202611091700_match_ticker.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Team logo
-- ---------------------------------------------------------------------------
alter table public.teams
  add column if not exists logo_url text,
  add column if not exists looking_for jsonb not null default '{}'::jsonb;

alter table public.teams drop constraint if exists teams_logo_url_check;
alter table public.teams add constraint teams_logo_url_check check (
  logo_url is null
  or (char_length(logo_url) <= 500
      and logo_url like 'https://%/storage/v1/object/public/team-logos/' || id::text || '/%')
);

-- Only the captain changes the logo (update policy); anyone else only through remove_team_logo().
create or replace function public.protect_team_logo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.logo_url is distinct from old.logo_url
     and auth.uid() is not null
     and auth.uid() is distinct from new.captain_id
     and coalesce(current_setting('app.removing_team_logo', true), '') <> 'on' then
    raise exception 'Only the captain can change the team logo. Organizers can remove one with "Remove logo".';
  end if;
  return new;
end $$;

drop trigger if exists teams_protect_logo on public.teams;
create trigger teams_protect_logo
  before update of logo_url on public.teams
  for each row execute function public.protect_team_logo();

-- ---------------------------------------------------------------------------
-- 2. Storage bucket and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-logos', 'team-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- The folder name is the team id; the caller must be that team's captain
create or replace function public.is_team_logo_folder_owner(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id::text = p_folder and t.captain_id = auth.uid() and not t.is_removed
  )
$$;
revoke execute on function public.is_team_logo_folder_owner(text) from public, anon;
grant execute on function public.is_team_logo_folder_owner(text) to authenticated;

drop policy if exists "Captains upload their team logo" on storage.objects;
create policy "Captains upload their team logo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'team-logos' and public.is_team_logo_folder_owner((storage.foldername(name))[1]));

drop policy if exists "Captains replace their team logo" on storage.objects;
create policy "Captains replace their team logo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'team-logos' and public.is_team_logo_folder_owner((storage.foldername(name))[1]))
  with check (bucket_id = 'team-logos' and public.is_team_logo_folder_owner((storage.foldername(name))[1]));

-- Listing/deleting needs select. Public addresses work without it (public bucket).
drop policy if exists "Captains and organizers see team logo files" on storage.objects;
create policy "Captains and organizers see team logo files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'team-logos'
         and (public.is_team_logo_folder_owner((storage.foldername(name))[1])
              or public.get_my_role() in ('admin', 'staff')));

drop policy if exists "Captains and organizers delete team logo files" on storage.objects;
create policy "Captains and organizers delete team logo files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'team-logos'
         and (public.is_team_logo_folder_owner((storage.foldername(name))[1])
              or public.get_my_role() in ('admin', 'staff')));

-- remove_team_logo(team, reason): clears the logo, logs it, tells the captain.
-- The app deletes the file itself afterwards (storage policy above).
create or replace function public.remove_team_logo(p_team_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := trim(coalesce(p_reason, ''));
  team_name text;
  captain uuid;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only organizers can remove team logos.';
  end if;
  if char_length(clean_reason) < 3 then
    raise exception 'Please give a reason (the captain will see it).';
  end if;

  select name, captain_id into team_name, captain
  from public.teams where id = p_team_id and logo_url is not null and not is_removed;
  if not found then
    raise exception 'This team has no logo.';
  end if;

  perform set_config('app.removing_team_logo', 'on', true);
  update public.teams set logo_url = null where id = p_team_id;
  perform set_config('app.removing_team_logo', 'off', true);

  perform public.log_activity('team.logo_removed', 'team', p_team_id,
    jsonb_build_object('team_name', team_name, 'note', left(clean_reason, 300)));

  perform public.notify_users(array[captain], 'team_logo_removed', 'Your team logo was removed',
    format('An organizer removed the logo of %s. Reason: %s You can upload a different one on the team page.',
           team_name, left(clean_reason, 300)),
    '/teams/' || p_team_id::text);
end $$;

revoke execute on function public.remove_team_logo(uuid, text) from public, anon;
grant execute on function public.remove_team_logo(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. "Looking for": roles (max 3) and a minimum rank from the game's profile form
-- ---------------------------------------------------------------------------
create or replace function public.check_team_looking_for()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  game_schema jsonb;
  role_field jsonb;
  rank_field jsonb;
  role_id text;
  roles jsonb;
begin
  if new.looking_for is null or new.looking_for = '{}'::jsonb then
    new.looking_for := '{}'::jsonb;
    return new;
  end if;
  if jsonb_typeof(new.looking_for) <> 'object' then
    raise exception '"Looking for" has the wrong format.';
  end if;

  select profile_schema into game_schema from public.games where id = new.game_id;
  role_field := public.game_profile_field(game_schema, 'role');
  rank_field := public.game_profile_field(game_schema, 'rank');
  roles := coalesce(new.looking_for -> 'roles', '[]'::jsonb);

  if jsonb_typeof(roles) <> 'array' then
    raise exception '"Looking for" roles have the wrong format.';
  end if;
  if jsonb_array_length(roles) > 3 then
    raise exception 'Pick at most 3 roles the team is looking for.';
  end if;
  for role_id in select jsonb_array_elements_text(roles) loop
    if role_field is null or public.game_profile_option(role_field, role_id) is null then
      raise exception 'One of the roles isn''t a role of this game.';
    end if;
  end loop;

  if coalesce(new.looking_for ->> 'rank_min', '') <> ''
     and (rank_field is null or public.game_profile_option(rank_field, new.looking_for ->> 'rank_min') is null) then
    raise exception 'The minimum rank isn''t a rank of this game.';
  end if;

  -- Keep only the two known keys (no extra data in the column)
  new.looking_for := jsonb_strip_nulls(jsonb_build_object(
    'roles', (select coalesce(jsonb_agg(distinct r), '[]'::jsonb) from jsonb_array_elements_text(roles) r),
    'rank_min', nullif(new.looking_for ->> 'rank_min', '')
  ));
  return new;
end $$;

drop trigger if exists teams_check_looking_for on public.teams;
create trigger teams_check_looking_for
  before insert or update of looking_for on public.teams
  for each row execute function public.check_team_looking_for();

-- ---------------------------------------------------------------------------
-- 4. Rejection reason on registrations
-- ---------------------------------------------------------------------------
alter table public.tournament_registrations
  add column if not exists rejection_reason text;

alter table public.tournament_registrations drop constraint if exists tournament_registrations_rejection_reason_check;
alter table public.tournament_registrations add constraint tournament_registrations_rejection_reason_check
  check (rejection_reason is null or char_length(rejection_reason) <= 300);

create or replace function public.clean_registration_reason()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rejection_reason := nullif(trim(coalesce(new.rejection_reason, '')), '');
  -- Only an organizer (or the SQL Editor) writes a reason
  if new.rejection_reason is distinct from old.rejection_reason
     and new.rejection_reason is not null
     and auth.uid() is not null
     and coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only organizers can give a rejection reason.';
  end if;
  -- A reason belongs to a rejection: any other status clears it
  if new.status <> 'rejected' then
    new.rejection_reason := null;
  end if;
  return new;
end $$;

drop trigger if exists tournament_registrations_clean_reason on public.tournament_registrations;
create trigger tournament_registrations_clean_reason
  before update on public.tournament_registrations
  for each row execute function public.clean_registration_reason();

-- Latest version (202610181500_notification_audit_gaps) + the reason in the rejection message
create or replace function public.notify_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_name text;
  captain uuid;
  tour_name text;
begin
  if tg_op = 'DELETE' then
    select tm.name, tm.captain_id into team_name, captain from public.teams tm where tm.id = old.team_id;
    select name into tour_name from public.tournaments where id = old.tournament_id;

    perform public.notify_users(
      array[coalesce(captain, old.user_id)],
      'registration_removed',
      'Registration removed',
      format('%s was removed from %s.', coalesce(team_name, old.team_name, 'Your team'), tour_name),
      '/registrations');
    return null;
  end if;

  if new.status is not distinct from old.status or new.status not in ('approved', 'rejected') then
    return null;
  end if;

  select tm.name, tm.captain_id into team_name, captain from public.teams tm where tm.id = new.team_id;
  select name into tour_name from public.tournaments where id = new.tournament_id;

  perform public.notify_users(
    array[coalesce(captain, new.user_id)],
    'registration_' || new.status,
    case when new.status = 'approved' then 'Registration approved' else 'Registration rejected' end,
    format('%s was %s for %s.', coalesce(team_name, new.team_name, 'Your team'), new.status, tour_name)
      || case when new.status = 'rejected' and new.rejection_reason is not null
              then ' Reason: ' || new.rejection_reason else '' end,
    '/registrations');
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 5. list_teams(): richer rows for the team cards, sorting and role/rank filters
--    p_sort: 'newest' | 'name' (default) | 'members' | 'recruiting'
--    p_role: a role option id the team is looking for
--    p_rank: a rank option id: teams whose minimum rank is at or below it (or have none)
--    p_mine: only teams the caller is on (the "My teams" tab uses the same cards)
-- ---------------------------------------------------------------------------
drop function if exists public.list_teams(text, text, boolean, int, int);
create function public.list_teams(
  p_search text default null,
  p_game_id text default null,
  p_recruiting_only boolean default false,
  p_limit int default 50,
  p_offset int default 0,
  p_sort text default 'name',
  p_role text default null,
  p_rank text default null,
  p_mine boolean default false
)
returns table (
  id uuid, name text, description text, game_id text, game_name text,
  captain_id uuid, captain_name text, member_count int, max_players int,
  recruiting boolean, created_at timestamptz,
  logo_url text, looking_for jsonb, captain_avatar text, member_avatars jsonb,
  is_member boolean, my_request text, total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with team_rows as (
    select t.id, t.name, t.description, t.game_id, g.name as game_name, t.captain_id,
           p.full_name as captain_name,
           (select count(*)::int from public.team_members tm where tm.team_id = t.id) as member_count,
           g.max_players, t.recruiting, t.created_at, t.logo_url, t.looking_for,
           p.avatar_url as captain_avatar,
           -- First 5 members (captain first) for the avatar row: first name + avatar only
           (select coalesce(jsonb_agg(jsonb_build_object('name', m.short_name, 'avatar_url', m.avatar_url)), '[]'::jsonb)
            from (
              select split_part(coalesce(nullif(trim(mp.full_name), ''), 'Player'), ' ', 1) as short_name,
                     mp.avatar_url
              from public.team_members tm
              join public.profiles mp on mp.id = tm.user_id
              where tm.team_id = t.id
              order by tm.role = 'captain' desc, tm.joined_at
              limit 5
            ) m) as member_avatars,
           exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid()) as is_member,
           (select r.status from public.team_join_requests r
            where r.team_id = t.id and r.user_id = auth.uid() and r.status = 'pending' limit 1) as my_request
    from public.teams t
    join public.games g on g.id = t.game_id
    left join public.profiles p on p.id = t.captain_id
    where auth.uid() is not null
      and not t.is_removed
      and (p_game_id is null or t.game_id = p_game_id)
      and (not p_recruiting_only or t.recruiting)
      and (not p_mine or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid()))
      -- plain substring search (no LIKE wildcards to escape)
      and (coalesce(trim(p_search), '') = '' or position(lower(trim(p_search)) in lower(t.name)) > 0)
      and (coalesce(p_role, '') = '' or (t.recruiting and coalesce(t.looking_for -> 'roles', '[]'::jsonb) ? p_role))
      and (coalesce(p_rank, '') = ''
           or coalesce(t.looking_for ->> 'rank_min', '') = ''
           or public.game_rank_id_position(t.game_id, t.looking_for ->> 'rank_min')
              <= public.game_rank_id_position(t.game_id, p_rank))
  )
  select r.*, count(*) over () as total_count
  from team_rows r
  order by
    case when p_sort = 'recruiting' then (not r.recruiting or r.member_count >= r.max_players) end,
    case when p_sort = 'newest' then r.created_at end desc,
    case when p_sort = 'members' then r.member_count end desc,
    lower(r.name)
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke execute on function public.list_teams(text, text, boolean, int, int, text, text, text, boolean) from public, anon;
grant execute on function public.list_teams(text, text, boolean, int, int, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Notification types: latest list (202611081500_comments_moderation) + team_logo_removed
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
  'team_removed', 'team_restored',
  'avatar_removed',
  'warning_issued', 'warning_removed', 'content_restored',
  'account_flagged', 'ban_review', 'ban_dismissed', 'account_unbanned',
  'team_logo_removed'
));

commit;
