-- Public tournament pages (/t/[id]) and calendar files (/calendar/...)
-- Logged-out visitors can read tournaments and matches, but not teams, registrations or
-- streams. Instead of opening those tables, these two functions return only what a public page
-- needs: team NAMES (no rosters, captains or emails), matches and live stream links.
-- (The Privacy Notice already says team names, brackets and results are public.)
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. get_public_tournament(id): everything the public tournament page shows, as one JSON object
--    (null when the tournament doesn't exist)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_tournament(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', t.id, 'name', t.name, 'description', t.description, 'rules', t.rules,
      'game', t.game, 'game_id', t.game_id, 'status', t.status,
      'start_date', t.start_date, 'end_date', t.end_date,
      'registration_deadline', t.registration_deadline, 'max_participants', t.max_participants,
      'requires_verification', t.requires_verification),
    -- Approved teams, plus any team that is in the bracket
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object('id', tm.id, 'name', tm.name) order by tm.name), '[]'::jsonb)
      from public.teams tm
      where tm.id in (
        select r.team_id from public.tournament_registrations r
        where r.tournament_id = t.id and r.status = 'approved'
        union
        select unnest(array[m.team_a_id, m.team_b_id]) from public.matches m where m.tournament_id = t.id
      )
    ),
    'approved_count', (
      select count(*) from public.tournament_registrations r
      where r.tournament_id = t.id and r.status = 'approved'
    ),
    'matches', (
      select coalesce(jsonb_agg(to_jsonb(m) - 'checkin_notified_at' order by m.round, m.match_number), '[]'::jsonb)
      from public.matches m where m.tournament_id = t.id
    ),
    'live_streams', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'title', s.title, 'facebook_url', s.facebook_url, 'match_id', s.match_id)
             order by s.created_at), '[]'::jsonb)
      from public.streams s
      where s.tournament_id = t.id and s.status = 'live'
    )
  )
  from public.tournaments t
  where t.id = p_tournament_id
$$;

revoke execute on function public.get_public_tournament(uuid) from public;
grant execute on function public.get_public_tournament(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_public_calendar(tournament, team, match): scheduled matches for the .ics files.
--    Pass exactly one of the three. Matches without a time and cancelled tournaments are skipped.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_calendar(
  p_tournament_id uuid default null,
  p_team_id uuid default null,
  p_match_id uuid default null
)
returns table (
  match_id uuid,
  tournament_id uuid,
  tournament_name text,
  game text,
  round int,
  round_count int,
  match_number int,
  team_a text,
  team_b text,
  scheduled_at timestamptz,
  status text,
  score_a int,
  score_b int,
  updated_at timestamptz,
  calendar_name text     -- e.g. the tournament or team name, for the calendar's title
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, t.id, t.name, t.game, m.round,
         (select max(m2.round) from public.matches m2 where m2.tournament_id = m.tournament_id),
         m.match_number, ta.name, tb.name, m.scheduled_at, m.status, m.score_a, m.score_b, m.updated_at,
         coalesce((select name from public.teams where id = p_team_id), t.name)
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  left join public.teams ta on ta.id = m.team_a_id
  left join public.teams tb on tb.id = m.team_b_id
  where m.scheduled_at is not null
    and t.status <> 'cancelled'
    -- byes aren't real matches
    and not (m.round = 1 and (m.team_a_id is null or m.team_b_id is null))
    and (
      (p_match_id is not null and m.id = p_match_id)
      or (p_match_id is null and p_tournament_id is not null and m.tournament_id = p_tournament_id)
      or (p_match_id is null and p_tournament_id is null and p_team_id is not null
          and p_team_id in (m.team_a_id, m.team_b_id))
    )
  order by m.scheduled_at
  limit 500
$$;

revoke execute on function public.get_public_calendar(uuid, uuid, uuid) from public;
grant execute on function public.get_public_calendar(uuid, uuid, uuid) to anon, authenticated;

commit;
