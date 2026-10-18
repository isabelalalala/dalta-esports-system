-- Terms of Service acceptance (Module 1)
-- - profiles.tos_version / tos_accepted_at: which version of the Terms of Service
--   (/terms) the user accepted, and when. Accepting the terms also records the
--   sign-up declaration "I am at least 18, or I have my parent's/guardian's consent".
-- - Sign-up saves the acceptance from the register form (handle_new_user).
-- - accept_tos(): users who didn't accept at sign-up (older accounts, accounts added
--   by an admin) accept later on /terms/accept.
-- - Nobody can change the tos columns directly, not even admins: only the user can
--   accept, through accept_tos(). The SQL Editor (no auth.uid()) may too.
-- Same shape as 202610170900_privacy_consent. NOTE: protect_profile_role below is
-- based on its latest definition in 202610181200_integrity_hardening (which added
-- the created_at guard); any re-definition must carry all prior guards forward.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns. Existing users have not accepted yet (null); they are asked on /terms/accept.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists tos_version text;
alter table public.profiles add column if not exists tos_accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Sign-up: same as before (see 202610170900_privacy_consent), plus the ToS
--    acceptance. The register form sends tos_consent = true and the ToS version.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consented boolean := coalesce(new.raw_user_meta_data ->> 'privacy_consent', '') = 'true';
  tos_accepted boolean := coalesce(new.raw_user_meta_data ->> 'tos_consent', '') = 'true';
begin
  insert into public.profiles (id, email, full_name, role, privacy_consent_at, privacy_consent_version, tos_accepted_at, tos_version)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case when new.raw_user_meta_data ->> 'role' = 'player' then 'player' else 'spectator' end,
    case when consented then now() end,
    case when consented then nullif(trim(new.raw_user_meta_data ->> 'privacy_notice_version'), '') end,
    case when tos_accepted then now() end,
    case when tos_accepted then nullif(trim(new.raw_user_meta_data ->> 'tos_version'), '') end
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Profile protection: same rules as 202610181200_integrity_hardening, plus the
--    tos columns can only change through accept_tos() (below), which sets a flag
--    for its own transaction. The SQL Editor (no auth.uid()) may too.
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

  -- The Terms of Service are only accepted by the user, through accept_tos().
  if (new.tos_version is distinct from old.tos_version
      or new.tos_accepted_at is distinct from old.tos_accepted_at)
     and auth.uid() is not null
     and coalesce(current_setting('app.accepting_tos', true), '') <> 'on' then
    raise exception 'The Terms of Service can only be accepted by the account owner on the accept page.';
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4. accept_tos(version): the logged-in user accepts the Terms of Service.
-- ---------------------------------------------------------------------------
create or replace function public.accept_tos(p_version text)
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
    raise exception 'The Terms of Service version is missing.';
  end if;

  -- Lets the profile trigger accept this change. "true" = only for this transaction.
  perform set_config('app.accepting_tos', 'on', true);

  update public.profiles
  set tos_version = trim(p_version), tos_accepted_at = now()
  where id = auth.uid();

  perform set_config('app.accepting_tos', 'off', true);
end $$;

revoke execute on function public.accept_tos(text) from public, anon;
grant execute on function public.accept_tos(text) to authenticated;

commit;
