-- Admin user management (Module 1, other-account actions)
-- - profiles.created_at (join date).
-- - The last administrator can't be demoted.
-- - admin_delete_user(target): admins delete other users without the service role key.
-- Changing roles and names already works for admins (policy "Admins can update any profile"
-- and the role-change trigger from 202610161200_role_security).
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Join date. Existing users get their sign-up date from auth.users;
--    new users get now() from the default.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists created_at timestamptz not null default now();

update public.profiles p
set created_at = u.created_at
from auth.users u
where u.id = p.id;

-- ---------------------------------------------------------------------------
-- 2. Role-change rules (replaces the version from 202610161200_role_security):
--    - only admins (or the SQL Editor) can change roles
--    - id and email can't be edited by logged-in users
--    - NEW: the last administrator can't be demoted
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

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. admin_delete_user(target): an admin deletes another user's account.
--    security definer so it can delete from auth.users without the service role key.
--    Everything linked to the user is removed by the existing ON DELETE rules.
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_with_players text;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'admin' then
    raise exception 'Only administrators can delete users.';
  end if;

  if target = auth.uid() then
    raise exception 'You can''t delete your own account here. Use My Profile instead.';
  end if;

  if not exists (select 1 from auth.users where id = target) then
    raise exception 'User not found.';
  end if;

  -- Deleting a captain deletes their team, so don't do that to the teammates.
  select t.name into team_with_players
  from public.teams t
  where t.captain_id = target
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = t.id and tm.user_id <> target
    )
  limit 1;

  if team_with_players is not null then
    raise exception 'This user is the captain of %, which has other players. Remove the players or delete the team first.', team_with_players;
  end if;

  -- (A team that is already in a tournament bracket also can't be deleted;
  -- the teams trigger refuses with its own message.)
  delete from auth.users where id = target;
end $$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

commit;
