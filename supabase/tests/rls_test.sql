-- pgTAP: RLS spot-checks on the policies the app depends on most.
-- Fixtures as postgres (RLS bypassed, triggers off for speed), then
-- `set local role authenticated/anon` + a request.jwt.claims sub to act as a user.

begin;

create extension if not exists pgtap;

select plan(9);

set local session_replication_role = 'replica';

create temp table fx (key text primary key, val uuid);
-- the tests below switch roles; let them read the fixture ids
grant select on fx to authenticated, anon;

-- two regular users + admin; two teams neither user belongs to
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
       'authenticated', 'rls' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 4) i;

insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'RLS ' || email from auth.users where email like 'rls%@test.dev';
update public.profiles set role = 'admin' where email = 'rls4@test.dev';

insert into fx select 'alice', id from auth.users where email = 'rls1@test.dev';
insert into fx select 'bob',   id from auth.users where email = 'rls2@test.dev';
insert into fx select 'carol', id from auth.users where email = 'rls3@test.dev';
insert into fx select 'admin', id from auth.users where email = 'rls4@test.dev';

do $$
declare
  admin_id uuid := (select val from fx where key = 'admin');
  t_id uuid; m_id uuid;
begin
  insert into public.tournaments (name, game_id, created_by)
  values ('RLS Cup', 'tekken8', admin_id) returning id into t_id;
  insert into fx values ('tournament', t_id);

  insert into public.teams (name, game_id, captain_id)
  values ('RLS Team A', 'tekken8', admin_id) returning id into m_id;
  insert into fx values ('team_a', m_id);
  insert into public.teams (name, game_id, captain_id)
  values ('RLS Team B', 'tekken8', admin_id) returning id into m_id;
  insert into fx values ('team_b', m_id);

  -- a scheduled match between the two teams, for predictions
  insert into public.matches (tournament_id, round, match_number, team_a_id, team_b_id, scheduled_at)
  values (t_id, 1, 1,
          (select val from fx where key = 'team_a'),
          (select val from fx where key = 'team_b'),
          now() + interval '1 day')
  returning id into m_id;
  insert into fx values ('match', m_id);

  -- a result submission on that match (the two teams' members + staff only)
  insert into public.match_result_submissions (match_id, team_id, submitted_by, score_a, score_b, proof_path)
  values (m_id, (select val from fx where key = 'team_a'), admin_id, 2, 0, 'proof.png');

  insert into public.announcements (title, body, created_by)
  values ('RLS announcement', 'body', admin_id);

  insert into public.tournament_registrations (tournament_id, user_id, team_id, status)
  values (t_id, admin_id, (select val from fx where key = 'team_a'), 'approved');
end $$;

set local session_replication_role = 'origin';

-- ---------- act as Alice (authenticated) ----------

set local role = 'authenticated';
select set_config('request.jwt.claims',
  '{"sub":"' || (select val from fx where key = 'alice') || '","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.predictions (user_id, match_id, predicted_winner_team_id)
    values ((select val from fx where key = 'alice'),
            (select val from fx where key = 'match'),
            (select val from fx where key = 'team_a'))$$,
  'a user can insert their own prediction');

select throws_matching(
  $$insert into public.predictions (user_id, match_id, predicted_winner_team_id)
    values ((select val from fx where key = 'bob'),
            (select val from fx where key = 'match'),
            (select val from fx where key = 'team_a'))$$,
  'row-level security',
  'a user cannot insert a prediction as someone else');

-- Bob inserts his own prediction first, then Alice must still see only hers
select set_config('request.jwt.claims',
  '{"sub":"' || (select val from fx where key = 'bob') || '","role":"authenticated"}', true);
insert into public.predictions (user_id, match_id, predicted_winner_team_id)
values ((select val from fx where key = 'bob'),
        (select val from fx where key = 'match'),
        (select val from fx where key = 'team_b'));

select set_config('request.jwt.claims',
  '{"sub":"' || (select val from fx where key = 'alice') || '","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.predictions),
  1, 'a user sees only their own predictions (Bob''s insert above is invisible to Alice)');

select is_empty(
  $$update public.profiles set full_name = 'hacked'
    where email = 'rls2@test.dev' returning id$$,
  'a user cannot update another user''s profile');

select lives_ok(
  $$update public.profiles set full_name = 'Alice Renamed'
    where email = 'rls1@test.dev'$$,
  'a user can update their own profile');

select isnt_empty(
  $$select * from public.announcements$$,
  'logged-in users can read announcements');

select is_empty(
  $$select * from public.match_result_submissions$$,
  'a user outside the two teams cannot read result submissions');

select isnt_empty(
  $$select * from public.tournament_registrations$$,
  'logged-in users can read registrations');

-- ---------- anon ----------

set local role = 'anon';
select set_config('request.jwt.claims', '', true);

select is_empty(
  $$select * from public.announcements$$,
  'logged-out visitors cannot read announcements');

select * from finish();
rollback;
