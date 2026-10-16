-- pgTAP: generate_bracket math, winner advance, result locks.
-- Fixtures are inserted with triggers off (session_replication_role=replica)
-- because the check_* triggers need full rosters/verification; the bracket
-- function only reads tournament_registrations.

begin;

create extension if not exists pgtap;

select plan(14);

-- ---------- fixtures ----------

set local session_replication_role = 'replica';

create temp table fx (key text primary key, val uuid);

-- 7 users: one admin + 6 captains
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
       'authenticated', 'fx' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 7) i;

insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Fixture ' || email from auth.users where email like 'fx%@test.dev';

update public.profiles set role = 'admin' where email = 'fx1@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'fx1@test.dev';

-- 6 teams + tournament + approved registrations
do $$
declare
  admin_id uuid := (select val from fx where key = 'admin');
  t_id uuid;
  cap uuid;
begin
  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants, created_by)
  values ('Bracket Test Cup', 'Tekken 8', 'tekken8', '2030-01-10', '2030-01-12', '2030-01-05', 16, admin_id)
  returning id into t_id;
  insert into fx values ('tournament', t_id);

  for i in 1..6 loop
    select id into cap from auth.users where email = 'fx' || (i + 1) || '@test.dev';
    insert into public.teams (name, game_id, captain_id)
    values ('Bracket Team ' || i, 'tekken8', cap)
    returning id into t_id;
    insert into public.tournament_registrations (tournament_id, user_id, team_id, status)
    values ((select val from fx where key = 'tournament'), cap, t_id, 'approved');
  end loop;

  -- a second tournament with only 1 approved team (for the <2 guard)
  insert into public.tournaments (name, game_id, created_by)
  values ('Tiny Cup', 'tekken8', admin_id)
  returning id into t_id;
  insert into fx values ('tiny', t_id);
  insert into public.tournament_registrations (tournament_id, user_id, team_id, status)
  values (t_id, admin_id, (select id from public.teams order by name limit 1), 'approved');
end $$;

set local session_replication_role = 'origin';

-- run generate_bracket as the admin (get_my_role() reads auth.uid())
select set_config('request.jwt.claims',
  '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);

-- ---------- tests ----------

select is(
  public.generate_bracket((select val from fx where key = 'tournament')),
  7, 'generate_bracket returns bracket_size - 1 for 6 teams (bracket of 8)');

select is(
  (select count(*)::int from public.matches where tournament_id = (select val from fx where key = 'tournament')),
  7, 'creates 7 matches');

select results_eq(
  $$select round, count(*)::int from public.matches
    where tournament_id = (select val from fx where key = 'tournament')
    group by round order by round$$,
  $$values (1, 4), (2, 2), (3, 1)$$,
  'round sizes are 4/2/1');

select is(
  (select count(*)::int from public.matches
    where tournament_id = (select val from fx where key = 'tournament')
      and round = 1 and status = 'completed' and team_b_id is null and winner_team_id = team_a_id),
  2, 'two byes (8 - 6), completed with the single team as winner');

select is(
  (select count(distinct t)::int from (
     select team_a_id t from public.matches
      where tournament_id = (select val from fx where key = 'tournament') and round = 1
     union all
     select team_b_id from public.matches
      where tournament_id = (select val from fx where key = 'tournament') and round = 1) s
   where t is not null),
  6, 'every approved team fills exactly one round-1 slot');

select is(
  (select count(*)::int from public.matches
    where tournament_id = (select val from fx where key = 'tournament')
      and round = 1 and team_a_id is not null and team_b_id is not null and status = 'scheduled' and winner_team_id is null),
  2, 'two real round-1 matches, scheduled and undecided');

-- every non-final match points at ceil(m/2) in the next round, same tournament
select is_empty(
  $$select m.* from public.matches m
    left join public.matches n on n.id = m.next_match_id
    where m.tournament_id = (select val from fx where key = 'tournament')
      and ((m.next_match_id is null) <> (m.round = 3)
        or (n.tournament_id <> m.tournament_id or n.round <> m.round + 1 or n.match_number <> (m.match_number + 1) / 2))$$,
  'next_match_id wiring: ceil(m/2) of next round, final has none');

-- bye winners auto-advanced by the insert trigger into round 2 team_a slots
select is(
  (select count(*)::int from public.matches
    where tournament_id = (select val from fx where key = 'tournament') and round = 2
      and team_a_id is not null),
  2, 'both round-2 team_a slots filled by the two bye winners');

-- winner advance on a real match: round-1 match 2 (even) -> team_b of round-2 match 1
do $$
declare
  w uuid;
begin
  update public.matches
    set winner_team_id = team_b_id, status = 'completed', score_a = 0, score_b = 2
    where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 2
    returning winner_team_id into w;
  perform set_config('fx.winner', w::text, true);
end $$;

select is(
  (select team_b_id from public.matches
    where tournament_id = (select val from fx where key = 'tournament') and round = 2 and match_number = 1),
  current_setting('fx.winner')::uuid,
  'winner of even round-1 match fills team_b of the next match');

-- clearing the winner empties the slot again
update public.matches
  set winner_team_id = null, status = 'scheduled'
  where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 2;

select ok(
  (select team_b_id is null from public.matches
    where tournament_id = (select val from fx where key = 'tournament') and round = 2 and match_number = 1),
  'clearing the winner empties the advanced slot');

-- re-set the winner so the next match has both teams (a match can't go live otherwise)
update public.matches
  set winner_team_id = team_b_id, status = 'completed'
  where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 2;

-- result lock: once the next match is live, the feeder result can't change
update public.matches
  set status = 'live'
  where tournament_id = (select val from fx where key = 'tournament') and round = 2 and match_number = 1;

select throws_ok(
  $$update public.matches
     set winner_team_id = team_a_id, score_a = 3, score_b = 0
     where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 2$$,
  'The next match has already started, so this result can''t be changed.',
  'changing a result after the next match started is refused');

-- regenerate guard: a completed real match blocks regeneration
update public.matches set status = 'live'
  where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 4;

select throws_ok(
  $$select public.generate_bracket((select val from fx where key = 'tournament'))$$,
  'A match has already started or finished, so the bracket can''t be regenerated.',
  'regeneration refused once a real match started');

-- <2 approved teams guard
select throws_ok(
  $$select public.generate_bracket((select val from fx where key = 'tiny'))$$,
  'At least 2 approved teams are needed to generate a bracket (there are 1).',
  'refuses a bracket with fewer than 2 approved teams');

-- non-admin guard
select set_config('request.jwt.claims',
  '{"sub":"' || (select id from auth.users where email = 'fx2@test.dev') || '"}', true);

select throws_ok(
  $$select public.generate_bracket((select val from fx where key = 'tournament'))$$,
  'Only admin and staff can generate brackets.',
  'players cannot generate brackets');

select * from finish();
rollback;
