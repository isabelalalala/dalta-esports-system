-- Privacy consent (Module 1, Data Privacy Act of 2012 / RA 10173)
-- - profiles.privacy_consent_at / privacy_consent_version: when the user agreed to the
--   Privacy Notice (/privacy) and to which version of it.
-- - Sign-up saves the consent from the register form (handle_new_user).
-- - give_privacy_consent(): users who didn't agree at sign-up (older accounts, accounts
--   added by an admin) agree later on /privacy/consent.
-- - Nobody can change the consent columns directly, not even admins: only the user can
--   give consent. Withdrawing consent = deleting the account (/profile).
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns. Existing users have no consent yet (null); they are asked on the dashboard.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists privacy_consent_at timestamptz;
alter table public.profiles add column if not exists privacy_consent_version text;

-- ---------------------------------------------------------------------------
-- 2. Sign-up: same as before (see 202610161200_role_security), plus the consent.
--    The register form sends privacy_consent = true and the notice version.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consented boolean := coalesce(new.raw_user_meta_data ->> 'privacy_consent', '') = 'true';
begin
  insert into public.profiles (id, email, full_name, role, privacy_consent_at, privacy_consent_version)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case when new.raw_user_meta_data ->> 'role' = 'player' then 'player' else 'spectator' end,
    case when consented then now() end,
    case when consented then nullif(trim(new.raw_user_meta_data ->> 'privacy_notice_version'), '') end
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Profile protection: same rules as 202610161900_admin_user_management, plus
--    the consent columns can only change through give_privacy_consent() (below),
--    which sets a flag for its own transaction. The SQL Editor (no auth.uid()) may too.
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
-- 4. give_privacy_consent(version): the logged-in user agrees to the Privacy Notice.
-- ---------------------------------------------------------------------------
create or replace function public.give_privacy_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;
  if p_version is null or length(trim(p_version)) = 0 then
    raise exception 'The Privacy Notice version is missing.';
  end if;

  -- Lets the profile trigger accept this change. "true" = only for this transaction.
  perform set_config('app.giving_privacy_consent', 'on', true);

  update public.profiles
  set privacy_consent_at = now(), privacy_consent_version = trim(p_version)
  where id = auth.uid();

  perform set_config('app.giving_privacy_consent', 'off', true);
end $$;

revoke execute on function public.give_privacy_consent(text) from public, anon;
grant execute on function public.give_privacy_consent(text) to authenticated;

commit;
