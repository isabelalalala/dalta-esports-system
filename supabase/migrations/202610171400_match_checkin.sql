-- Match check-in (part 1 of check-in and result submission)
-- - tournaments.checkin_window_minutes: check-in opens this many minutes before scheduled_at and
--   closes at scheduled_at. 0 = no check-in for that tournament. Default 30.
-- - match_checkins: one row per team per match, created by the captain with check_in_match().
--   Changing a match's time clears its check-ins.
-- - declare_forfeit(): staff give the win to one team; the winner advances as usual.
--   matches.is_forfeit marks it (only that function can set it).
-- - pg_cron runs send_checkin_open_notifications() every 5 minutes ("check-in is open").
-- Times are compared with the database clock (now()), so a wrong phone clock doesn't matter.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists checkin_window_minutes int not null default 30
    check (checkin_window_minutes between 0 and 240);

alter table public.matches
  add column if not exists is_forfeit boolean not null default false,
  -- When the "check-in is open" notification was sent (so it's sent once)
  add column if not exists checkin_notified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. match_checkins
-- ---------------------------------------------------------------------------
create table public.match_checkins (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  checked_in_by uuid references public.profiles (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  unique (match_id, team_id)
);

alter table public.match_checkins enable row level security;

create policy "Logged-in users can view check-ins"
  on public.match_checkins for select
  to authenticated
  using (true);
-- No insert/update/delete policies: captains check in with check_in_match(),
-- and check-ins are cleared by the trigger below when the match time changes.

-- Realtime: the match page shows the other team checking in without refreshing
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_checkins'
  ) then
    alter publication supabase_realtime add table public.match_checkins;
  end if;
end $$;

-- Opening and closing time of a match's check-in (null when there is no check-in)
create or replace function public.checkin_window(p_match_id uuid)
returns table (opens_at timestamptz, closes_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.scheduled_at - make_interval(mins => t.checkin_window_minutes), m.scheduled_at
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id
    and m.scheduled_at is not null
    and t.checkin_window_minutes > 0
$$;

revoke execute on function public.checkin_window(uuid) from public, anon, authenticated;

-- check_in_match(match): the captain of one of the two teams checks their team in
create or replace function public.check_in_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  my_team uuid;
  w record;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found.';
  end if;

  select t.id into my_team
  from public.teams t
  where t.id in (m.team_a_id, m.team_b_id) and t.captain_id = auth.uid();
  if my_team is null then
    raise exception 'Only the captain of a team in this match can check in.';
  end if;

  if m.status <> 'scheduled' then
    raise exception 'Check-in is closed: the match has already started or finished.';
  end if;

  select * into w from public.checkin_window(p_match_id);
  if not found then
    raise exception 'This match has no check-in (no time set, or check-in is off for the tournament).';
  end if;
  if now() < w.opens_at then
    raise exception 'Check-in opens at % (PH time).',
      to_char(w.opens_at at time zone 'Asia/Manila', 'FMHH12:MI AM, Mon FMDD');
  end if;
  if now() >= w.closes_at then
    raise exception 'Check-in closed at the match time. Contact a tournament staff member.';
  end if;

  insert into public.match_checkins (match_id, team_id, checked_in_by)
  values (p_match_id, my_team, auth.uid())
  on conflict (match_id, team_id) do nothing;
end $$;

revoke execute on function public.check_in_match(uuid) from public, anon;
grant execute on function public.check_in_match(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Match updates:
--    - a new time clears the check-ins and allows a new "check-in is open" notification
--    - is_forfeit is only set by declare_forfeit(); any other change to the result clears it
-- ---------------------------------------------------------------------------
create or replace function public.match_checkin_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at then
    delete from public.match_checkins where match_id = new.id;
    new.checkin_notified_at := null;
  end if;

  if coalesce(current_setting('app.declaring_forfeit', true), '') <> 'on' then
    if new.is_forfeit and not old.is_forfeit then
      raise exception 'Use "Declare forfeit" on the match page to give a forfeit win.';
    end if;
    if new.winner_team_id is distinct from old.winner_team_id
       or new.status is distinct from old.status
       or new.score_a is distinct from old.score_a
       or new.score_b is distinct from old.score_b then
      new.is_forfeit := false;
    end if;
  end if;

  return new;
end $$;

create trigger matches_checkin_rules
  before update on public.matches
  for each row execute function public.match_checkin_rules();

-- ---------------------------------------------------------------------------
-- 4. declare_forfeit(match, winner): admin/staff, after the match time, before it's completed.
--    The advance trigger moves the winner into the next match.
-- ---------------------------------------------------------------------------
create or replace function public.declare_forfeit(p_match_id uuid, p_winner_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  loser uuid;
  winner_name text;
  loser_name text;
  tour_name text;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only tournament staff can declare a forfeit.';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;
  if m.status = 'completed' then
    raise exception 'This match is already completed.';
  end if;
  if m.team_a_id is null or m.team_b_id is null then
    raise exception 'Both teams must be known before a forfeit can be declared.';
  end if;
  if p_winner_team_id is null or p_winner_team_id not in (m.team_a_id, m.team_b_id) then
    raise exception 'Choose one of the two teams as the winner.';
  end if;
  if m.scheduled_at is null or now() < m.scheduled_at then
    raise exception 'A forfeit can only be declared after the scheduled match time.';
  end if;

  perform set_config('app.declaring_forfeit', 'on', true);
  update public.matches
  set status = 'completed', winner_team_id = p_winner_team_id,
      score_a = null, score_b = null, is_forfeit = true
  where id = p_match_id;
  perform set_config('app.declaring_forfeit', 'off', true);

  loser := case when p_winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  select name into winner_name from public.teams where id = p_winner_team_id;
  select name into loser_name from public.teams where id = loser;
  select name into tour_name from public.tournaments where id = m.tournament_id;

  perform public.notify_users(public.team_member_ids(array[m.team_a_id, m.team_b_id]),
    'match_forfeit', 'Match decided by forfeit',
    format('%s wins %s vs %s (%s) by forfeit.', winner_name, winner_name, loser_name, tour_name),
    '/matches/' || p_match_id);
end $$;

revoke execute on function public.declare_forfeit(uuid, uuid) from public, anon;
grant execute on function public.declare_forfeit(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Activity log: same as 202610171100_activity_log, plus "forfeit" in the details
-- ---------------------------------------------------------------------------
create or replace function public.log_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tour_name text;
  team_count int;
begin
  if pg_trigger_depth() > 1 then return null; end if;

  select name into tour_name from public.tournaments where id = new.tournament_id;

  if tg_op = 'INSERT' then
    if new.next_match_id is not null then return null; end if;
    select count(*) into team_count
    from public.tournament_registrations
    where tournament_id = new.tournament_id and status = 'approved';

    perform public.log_activity('bracket.generated', 'tournament', new.tournament_id,
      jsonb_build_object('tournament_name', tour_name, 'tournament_id', new.tournament_id,
                         'rounds', new.round, 'teams', team_count));
    return null;
  end if;

  if new.winner_team_id is not distinct from old.winner_team_id
     and new.score_a is not distinct from old.score_a
     and new.score_b is not distinct from old.score_b then
    return null;
  end if;

  perform public.log_activity('match.result', 'match', new.id,
    jsonb_build_object(
      'tournament_name', tour_name,
      'tournament_id', new.tournament_id,
      'round', new.round,
      'round_count', (select max(round) from public.matches where tournament_id = new.tournament_id),
      'match_number', new.match_number,
      'team_a', (select name from public.teams where id = new.team_a_id),
      'team_b', (select name from public.teams where id = new.team_b_id),
      'score_a', new.score_a,
      'score_b', new.score_b,
      'winner', (select name from public.teams where id = new.winner_team_id),
      'forfeit', new.is_forfeit));
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Notifications: "check-in is open" (sent by pg_cron) and "decided by forfeit"
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved', 'registration_rejected',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'checkin_open', 'match_forfeit',
  'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'team_added',  -- no longer sent (players join by invite); kept for older rows
  'member_left', 'member_removed',
  'student_verified', 'student_rejected', 'student_revoked'
));

-- Notifies both captains of matches whose check-in has opened. Run by pg_cron every
-- 5 minutes; each match is notified once (checkin_notified_at). Returns how many matches.
create or replace function public.send_checkin_open_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  sent int := 0;
begin
  for m in
    select mt.id, mt.team_a_id, mt.team_b_id, mt.scheduled_at, tr.name as tour_name,
           ta.name as name_a, tb.name as name_b, ta.captain_id as captain_a, tb.captain_id as captain_b
    from public.matches mt
    join public.tournaments tr on tr.id = mt.tournament_id
    left join public.teams ta on ta.id = mt.team_a_id
    left join public.teams tb on tb.id = mt.team_b_id
    where mt.status = 'scheduled'
      and mt.scheduled_at is not null
      and mt.checkin_notified_at is null
      and tr.checkin_window_minutes > 0
      and now() >= mt.scheduled_at - make_interval(mins => tr.checkin_window_minutes)
      and now() < mt.scheduled_at
    for update of mt
  loop
    perform public.notify_users(array[m.captain_a, m.captain_b], 'checkin_open', 'Check-in is open',
      format('Check in for %s vs %s (%s) before %s (PH time).',
             coalesce(m.name_a, 'TBD'), coalesce(m.name_b, 'TBD'), m.tour_name,
             to_char(m.scheduled_at at time zone 'Asia/Manila', 'FMHH12:MI AM')),
      '/matches/' || m.id);
    update public.matches set checkin_notified_at = now() where id = m.id;
    sent := sent + 1;
  end loop;
  return sent;
end $$;

revoke execute on function public.send_checkin_open_notifications() from public, anon, authenticated;

-- Every 5 minutes. Scheduling with the same name again replaces the job.
-- (pg_cron must be enabled: Database -> Extensions -> pg_cron.)
select cron.schedule(
  'dalta-checkin-open-notifications',
  '*/5 * * * *',
  'select public.send_checkin_open_notifications()'
);

-- ---------------------------------------------------------------------------
-- 7. "Needs attention" for staff (admin/staff). Part 1: matches whose check-in has closed
--    while a team hasn't checked in. Results are added in the next migration.
-- ---------------------------------------------------------------------------
create or replace function public.get_needs_attention()
returns table (
  kind text,              -- 'no_checkin'
  match_id uuid,
  tournament_id uuid,
  tournament_name text,
  round int,
  round_count int,
  match_number int,
  team_a text,
  team_b text,
  detail text,
  since timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
-- (the output columns match_id, round, ... share names with table columns; use the columns)
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only tournament staff can see this list.';
  end if;

  return query
  select 'no_checkin'::text, m.id, tr.id, tr.name, m.round,
         (select max(m2.round) from public.matches m2 where m2.tournament_id = m.tournament_id),
         m.match_number, ta.name, tb.name,
         -- Which teams are missing
         'Not checked in: ' || concat_ws(', ',
           case when not exists (select 1 from public.match_checkins c where c.match_id = m.id and c.team_id = m.team_a_id) then ta.name end,
           case when not exists (select 1 from public.match_checkins c where c.match_id = m.id and c.team_id = m.team_b_id) then tb.name end),
         m.scheduled_at
  from public.matches m
  join public.tournaments tr on tr.id = m.tournament_id
  join public.teams ta on ta.id = m.team_a_id
  join public.teams tb on tb.id = m.team_b_id
  where m.status = 'scheduled'
    and m.scheduled_at is not null
    and m.scheduled_at <= now()
    and tr.checkin_window_minutes > 0
    and (select count(*) from public.match_checkins c where c.match_id = m.id) < 2
  order by m.scheduled_at;
end $$;

revoke execute on function public.get_needs_attention() from public, anon;
grant execute on function public.get_needs_attention() to authenticated;

commit;
