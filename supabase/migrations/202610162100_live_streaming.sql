-- Live Streaming (Module 4)
-- - streams: Facebook Live links per tournament (optionally for one match).  [DFD: D3 Streaming & Match Stat DB]
-- - stream_views: one row per person, per stream, per day, for viewership stats (Module 6).
-- - matches is added to Supabase Realtime, so watch pages update scores without refreshing.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. streams
-- ---------------------------------------------------------------------------
create table public.streams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  -- Optional: the stream shows one match. Regenerating the bracket deletes
  -- matches, so the link is just cleared then.
  match_id uuid references public.matches (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  -- Link validation ("Live Stream Link Validated Status"): only https facebook.com links,
  -- because the app plays them with Facebook's embedded video player.
  facebook_url text not null
    check (facebook_url ~* '^https://(www\.|m\.|web\.)?facebook\.com/.+'),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index streams_tournament_idx on public.streams (tournament_id);

alter table public.streams enable row level security;

create policy "Logged-in users can view streams"
  on public.streams for select
  to authenticated
  using (true);

create policy "Admin/staff can add streams"
  on public.streams for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'staff') and created_by = auth.uid());

create policy "Admin/staff can edit streams"
  on public.streams for update
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'))
  with check (public.get_my_role() in ('admin', 'staff'));

create policy "Admin/staff can delete streams"
  on public.streams for delete
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'));

-- Keeps updated_at current and checks that the match belongs to the same tournament.
create or replace function public.check_stream()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.match_id is not null and not exists (
    select 1 from public.matches
    where id = new.match_id and tournament_id = new.tournament_id
  ) then
    raise exception 'That match is not part of this tournament.';
  end if;

  return new;
end $$;

create trigger streams_check
  before insert or update on public.streams
  for each row execute function public.check_stream();

-- ---------------------------------------------------------------------------
-- 2. stream_views: who watched which stream on which day.
--    UNIQUE per day, so refreshing the watch page doesn't add more views.
-- ---------------------------------------------------------------------------
create table public.stream_views (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (stream_id, user_id, viewed_on)
);

alter table public.stream_views enable row level security;

-- Viewers record only their own view, for today.
create policy "Users record their own views"
  on public.stream_views for insert
  to authenticated
  with check (user_id = auth.uid() and viewed_on = current_date);

-- Viewing stats are for organizers (Module 6 reports).
create policy "Admin/staff can read views"
  on public.stream_views for select
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'));

-- ---------------------------------------------------------------------------
-- 3. Realtime for matches: watch pages receive score changes as they are saved.
--    The existing "Anyone can view matches" policy still decides who receives them.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

commit;
