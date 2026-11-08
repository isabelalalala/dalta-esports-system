-- Phase 3: profile pictures and the first-login quick tour.
--
-- 1. profiles.avatar_url: public address of the picture in the `avatars` bucket. It must point
--    into the user's own folder (CHECK), so nobody can show a picture from elsewhere.
--    Only the user changes their own picture; an admin can only REMOVE one, through
--    admin_remove_avatar(user, reason), which logs it and tells the user.
-- 2. Storage bucket `avatars`: public read (pictures are shown on rosters, comments, ...),
--    JPG/PNG/WebP, 2 MB. Users write only inside <their id>/...; admins may delete any picture.
-- 3. profiles.tour_dismissed_at: set when the user finishes or skips the quick tour, so it is
--    never shown again (on any device).
-- 4. get_team_roster(), search_players(), get_team_join_requests() also return avatar_url.
--    Dropped and re-created because their returned columns change (latest versions copied:
--    202610171000_student_verification, 202610171300_team_invites, 202611011300_team_join_requests).
-- 5. Notification type 'avatar_removed' (full list copied from 202611081000_team_removal).
--
-- Privacy Notice: profile pictures are new personal data that other users can see, so
-- PRIVACY_NOTICE_VERSION changes with this feature (everyone agrees again).
--
-- Run in the Supabase SQL Editor after 202611081300_match_drafts.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists tour_dismissed_at timestamptz;

alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  avatar_url is null
  or (char_length(avatar_url) <= 500
      and avatar_url like 'https://%/storage/v1/object/public/avatars/' || id::text || '/%')
);

-- Someone else's picture can only be removed through admin_remove_avatar() (flag
-- app.removing_avatar), never replaced. The SQL Editor (no auth.uid()) may change anything.
create or replace function public.protect_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url
     and auth.uid() is not null
     and auth.uid() <> new.id
     and coalesce(current_setting('app.removing_avatar', true), '') <> 'on' then
    raise exception 'Only the owner can change a profile picture. Admins can remove one with "Remove picture".';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_avatar on public.profiles;
create trigger profiles_protect_avatar
  before update of avatar_url on public.profiles
  for each row execute function public.protect_avatar();

-- ---------------------------------------------------------------------------
-- 2. Storage bucket and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users replace their own avatar" on storage.objects;
create policy "Users replace their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Listing/deleting needs select. Public addresses work without it (public bucket).
drop policy if exists "Users and admins see avatar files" on storage.objects;
create policy "Users and admins see avatar files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.get_my_role() = 'admin'));

drop policy if exists "Users delete their own avatar, admins any" on storage.objects;
create policy "Users delete their own avatar, admins any"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.get_my_role() = 'admin'));

-- ---------------------------------------------------------------------------
-- 3. admin_remove_avatar(user, reason): clears the picture, logs it, tells the user.
--    The app deletes the file itself afterwards (storage policy above).
-- ---------------------------------------------------------------------------
create or replace function public.admin_remove_avatar(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := trim(coalesce(p_reason, ''));
  target_name text;
begin
  if coalesce(public.get_my_role(), '') <> 'admin' then
    raise exception 'Only admins can remove profile pictures.';
  end if;
  if char_length(clean_reason) < 3 then
    raise exception 'Please give a reason (the user will see it).';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Unnamed user') into target_name
  from public.profiles where id = p_user_id and avatar_url is not null;
  if not found then
    raise exception 'This user has no profile picture.';
  end if;

  perform set_config('app.removing_avatar', 'on', true);
  update public.profiles set avatar_url = null where id = p_user_id;
  perform set_config('app.removing_avatar', 'off', true);

  perform public.log_activity('user.avatar_removed', 'user', p_user_id,
    jsonb_build_object('user_name', target_name, 'note', left(clean_reason, 300)));

  perform public.notify_users(array[p_user_id], 'avatar_removed', 'Your profile picture was removed',
    'An admin removed your profile picture. Reason: ' || left(clean_reason, 300) ||
    ' You can upload a different one on your profile.', '/profile');
end $$;

revoke execute on function public.admin_remove_avatar(uuid, text) from public, anon;
grant execute on function public.admin_remove_avatar(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Pictures in rosters, player search and join requests
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
  is_verified boolean,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select tm.user_id, p.full_name, gp.ign, gp.in_game_role, tm.role, tm.joined_at, p.is_verified, p.avatar_url
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
returns table (
  user_id uuid, full_name text, ign text, in_game_role text, rank text, is_verified boolean, invited boolean,
  avatar_url text
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
         ),
         p.avatar_url
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

drop function if exists public.get_team_join_requests(uuid);
create function public.get_team_join_requests(p_team_id uuid)
returns table (
  request_id uuid, user_id uuid, full_name text, ign text, in_game_role text, rank text,
  is_verified boolean, message text, created_at timestamptz, avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.user_id, p.full_name, gp.ign, gp.in_game_role, gp.rank, p.is_verified,
         r.message, r.created_at, p.avatar_url
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
-- 5. Notification types: list from 202611081000_team_removal + avatar_removed
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
  'avatar_removed'
));

commit;
