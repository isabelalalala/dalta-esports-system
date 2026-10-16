-- "Watching now" presence, re-done as a heartbeat table.
--
-- The old design used a public Supabase Realtime presence channel
-- (viewers-<stream id>, key = user id). Anyone holding the anon key could track()
-- arbitrary keys to inflate the count organizers see, and could read the user ids
-- of everyone watching. This migration replaces it with stream_presence:
-- viewers upsert their own row every ~45 s while the watch page is open and
-- delete it when they leave; nobody can select the table (viewer ids never leave
-- the database); organizers get only counts through get_live_viewer_counts().
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. stream_presence: one row per person per stream, kept fresh by heartbeats.
-- ---------------------------------------------------------------------------
create table public.stream_presence (
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_seen timestamptz not null default now(),
  primary key (stream_id, user_id)
);

alter table public.stream_presence enable row level security;

-- No select policy on purpose: nobody reads rows, only the counts RPC below.

-- Viewers heartbeat their own row. Only players and spectators count as viewers
-- (same exclusion the presence channel and stream_views reports use).
create policy "Viewers can add their own presence"
  on public.stream_presence for insert
  to authenticated
  with check (
    user_id = auth.uid() and public.get_my_role() in ('player', 'spectator')
  );

create policy "Viewers can refresh their own presence"
  on public.stream_presence for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid() and public.get_my_role() in ('player', 'spectator')
  );

create policy "Viewers can remove their own presence"
  on public.stream_presence for delete
  to authenticated
  using (user_id = auth.uid());

-- The server owns last_seen so a viewer can't keep a stale row alive forever.
create or replace function public.check_stream_presence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_seen := now();
  return new;
end $$;

create trigger stream_presence_check
  before insert or update on public.stream_presence
  for each row execute function public.check_stream_presence();

-- ---------------------------------------------------------------------------
-- 2. get_live_viewer_counts: the only way to read presence, counts only.
-- ---------------------------------------------------------------------------
create or replace function public.get_live_viewer_counts(p_stream_ids uuid[])
returns table (stream_id uuid, viewers bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.get_my_role() not in ('admin', 'staff') then
    raise exception 'Only organizers can view live viewer counts.';
  end if;

  return query
    select p.stream_id, count(*)
    from public.stream_presence p
    where p.stream_id = any (p_stream_ids)
      and p.last_seen > now() - interval '90 seconds'
    group by p.stream_id;
end $$;

revoke all on function public.get_live_viewer_counts(uuid[]) from public, anon;
grant execute on function public.get_live_viewer_counts(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cleanup: rows whose owners closed the tab without a clean unmount.
--    Beats older than 90 s already stop counting; this just reclaims the rows.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_stream_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.stream_presence
  where last_seen < now() - interval '15 minutes';
end $$;

revoke execute on function public.cleanup_stream_presence() from public, anon, authenticated;

-- Every 5 minutes. Scheduling with the same name again replaces the job.
select cron.schedule(
  'dalta-stream-presence-cleanup',
  '*/5 * * * *',
  'select public.cleanup_stream_presence()'
);

commit;
