-- Role security (Module 1)
-- - Only the 4 known roles can be stored in profiles.role.
-- - Profiles are created by a trigger on sign-up; users can only pick player or spectator.
-- - Nobody can change their own role (only admins, or you in the SQL Editor).
-- - Replaces all policies on profiles.
--
-- Runs as one transaction: if any statement fails, nothing is changed.
--
-- To make someone an admin or staff member, run this in the SQL Editor:
--   update public.profiles set role = 'admin' where email = 'someone@example.com';

begin;

-- ---------------------------------------------------------------------------
-- 1. Clean up existing role values.
--    The app uses 'spectator' for Audience / Spectator, so 'audience' is renamed.
--    Any other unknown value stops the migration so you can decide what it should be.
-- ---------------------------------------------------------------------------
update public.profiles set role = 'spectator' where role = 'audience';

do $$
declare
  bad_roles text;
begin
  select string_agg(distinct coalesce(role, 'NULL'), ', ') into bad_roles
  from public.profiles
  where role is null or role not in ('admin', 'staff', 'player', 'spectator');

  if bad_roles is not null then
    raise exception 'Unknown role values in profiles: %. Fix them, then run this again.', bad_roles;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'staff', 'player', 'spectator'));

alter table public.profiles alter column role set default 'spectator';
alter table public.profiles alter column role set not null;

-- ---------------------------------------------------------------------------
-- 2. get_my_role(): role of the logged-in user, for use in RLS policies.
--    security definer so policies on profiles don't recurse into themselves.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Older name used by the team registration policies. Kept as a wrapper so
-- those policies keep working; new code should use get_my_role().
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_role()
$$;

-- ---------------------------------------------------------------------------
-- 3. Create the profile automatically when someone signs up.
--    Role comes from the sign-up form but only 'player' is accepted;
--    anything else (including 'admin' or 'staff') becomes 'spectator'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case when new.raw_user_meta_data ->> 'role' = 'player' then 'player' else 'spectator' end
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- Remove the old sign-up trigger(s): any trigger on auth.users whose function
-- writes to public.profiles. Otherwise the old one would still copy the role
-- from the form. Each dropped trigger is listed in the output.
do $$
declare
  trg record;
begin
  for trg in
    select t.tgname, p.proname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and pg_get_functiondef(p.oid) ilike '%profiles%'
  loop
    raise notice 'Dropping old trigger % on auth.users (function %)', trg.tgname, trg.proname;
    execute format('drop trigger %I on auth.users', trg.tgname);
  end loop;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before any trigger existed get a spectator profile.
insert into public.profiles (id, email, role)
select u.id, u.email, 'spectator'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---------------------------------------------------------------------------
-- 4. Block role changes unless the person making the change is an admin.
--    auth.uid() is null in the SQL Editor, so you can still change roles there.
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

  -- The id and email must match auth.users, so they can't be edited here either.
  if new.id is distinct from old.id or new.email is distinct from old.email then
    if auth.uid() is not null then
      raise exception 'The account id and email can''t be changed here.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- 5. Replace all policies on profiles.
--    Policies are combined with OR, so any old permissive one would still apply.
--    Each dropped policy is listed in the output.
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    raise notice 'Dropping old policy on profiles: %', pol.policyname;
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Admin/staff can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'));

-- Role changes are blocked by the trigger in section 4.
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- No insert policy: profiles are created by handle_new_user().
-- No delete policy: profiles can't be deleted from the app.

commit;
