-- Base schema: the tables that existed before the migration files.
-- profiles, tournaments and tournament_registrations were created by hand in the
-- first Supabase project, so no migration created them — and 202610151200 failed
-- on a fresh project. This file runs first in filename order and creates them.
--
-- Deliberately minimal: only the columns the later migrations expect. Everything
-- they replace (old CHECK/unique constraints, policies, the original sign-up
-- trigger) is dropped or rebuilt by the migrations themselves, so it is not
-- repeated here. RLS is enabled (deny-all) until the migrations add policies.
--
-- Safe to run on a database that already has the tables: nothing is changed.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. profiles: one row per auth.users account.
--    Role has no CHECK or default yet — 202610161200 adds both.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text,
  -- 202610161900 also adds created_at (if not exists) — kept here because it is
  -- part of the documented schema and backfills nothing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- 2. tournaments.
--    game_id, rules, requires_verification and checkin_window_minutes are added
--    by later migrations; status gets its CHECK and default in 202610161600.
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  game text,
  start_date timestamptz,
  end_date timestamptz,
  registration_deadline timestamptz,
  max_participants int,
  status text,
  -- 202610161300 drops the not-null so deleting a user keeps their tournaments
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

-- ---------------------------------------------------------------------------
-- 3. tournament_registrations: teams registered by name (team_id comes in
--    202610151200). status gets its CHECK, default and not-null in 202610161500.
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  team_name text not null,
  status text,
  registered_at timestamptz not null default now()
);

alter table public.tournament_registrations enable row level security;

commit;
