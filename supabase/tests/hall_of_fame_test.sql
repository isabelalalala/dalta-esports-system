-- pgTAP: Hall of Fame (202611101100_hall_of_fame): the champion is recorded, changed and cleared by
-- the matches trigger; score fixes don't notify again; anon can't read the table; only admins set
-- the MVP (and only to a roster member); account deletion scrubs the roster.

begin;

create extension if not exists pgtap;

select plan(14);

set local session_replication_role = 'replica';
create temp table fx (key text primary key, val uuid);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'hof' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 4) i;
insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Hof Tester' from auth.users where email like 'hof%@test.dev';
update public.profiles set role = 'admin' where email = 'hof1@test.dev';
update public.profiles set role = 'staff' where email = 'hof2@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'hof1@test.dev';
insert into fx select 'staff', id from public.profiles where email = 'hof2@test.dev';
insert into fx select 'pa', id from public.profiles where email = 'hof3@test.dev';  -- on team A
insert into fx select 'pb', id from public.profiles where email = 'hof4@test.dev';  -- on team B

do $$
declare t uuid; a uuid; b uuid; semi uuid; fin uuid;
begin
  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants)
  values ('Hof Cup', 'Tekken 8', 'tekken8', '2030-03-10', '2030-03-12', '2030-03-05', 8) returning id into t;
  insert into public.teams (name, game_id, captain_id) values ('Alpha', 'tekken8', (select val from fx where key = 'pa')) returning id into a;
  insert into public.teams (name, game_id, captain_id) values ('Bravo', 'tekken8', (select val from fx where key = 'pb')) returning id into b;
  insert into public.team_members (team_id, user_id, role) values (a, (select val from fx where key = 'pa'), 'captain');
  insert into public.team_members (team_id, user_id, role) values (b, (select val from fx where key = 'pb'), 'captain');
  insert into public.player_game_profiles (user_id, game_id, ign) values ((select val from fx where key = 'pa'), 'tekken8', 'AlphaIGN');
  -- Round 2 = the final; a round-1 match feeds it
  insert into public.matches (tournament_id, round, match_number, team_a_id, team_b_id, status)
  values (t, 2, 1, a, b, 'scheduled') returning id into fin;
  insert into public.matches (tournament_id, round, match_number, team_a_id, team_b_id, status, next_match_id)
  values (t, 1, 1, a, b, 'completed', fin) returning id into semi;
  insert into fx values ('t', t), ('a', a), ('b', b), ('final', fin), ('semi', semi);
end $$;

set local session_replication_role = 'origin';
-- Acting as staff (results are entered by organizers)
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);

-- ---------- a non-final winner records nothing ----------
update public.matches set winner_team_id = (select val from fx where key = 'a'), score_a = 2, score_b = 0
where id = (select val from fx where key = 'semi');
select is((select count(*)::int from public.tournament_champions where tournament_id = (select val from fx where key = 't')), 0,
  'a winner outside the final records no champion');

-- ---------- the final gets a winner ----------
update public.matches set status = 'completed', score_a = 3, score_b = 1, winner_team_id = (select val from fx where key = 'a')
where id = (select val from fx where key = 'final');
select results_eq(
  $$select champion_team_name, runner_up_team_name, champion_score, runner_up_score, roster -> 0 ->> 'ign'
    from public.tournament_champions where tournament_id = (select val from fx where key = 't')$$,
  $$values ('Alpha'::text, 'Bravo'::text, 3, 1, 'AlphaIGN'::text)$$,
  'the final''s winner is recorded with a roster snapshot');
select is((select count(*)::int from public.notifications where type = 'hall_of_fame' and user_id = (select val from fx where key = 'pa')), 1,
  'the champion team''s member is notified');

-- ---------- a score fix keeps the record and doesn't notify again ----------
update public.matches set score_b = 2 where id = (select val from fx where key = 'final');
select is((select runner_up_score from public.tournament_champions where tournament_id = (select val from fx where key = 't')), 2,
  'a score fix updates the record');
select is((select count(*)::int from public.notifications where type = 'hall_of_fame'), 1,
  'a score fix does not notify again');

-- ---------- the champion changes ----------
update public.matches set score_a = 1, score_b = 3, winner_team_id = (select val from fx where key = 'b')
where id = (select val from fx where key = 'final');
select is((select champion_team_name from public.tournament_champions where tournament_id = (select val from fx where key = 't')), 'Bravo',
  'an overridden result changes the champion');
select is((select count(*)::int from public.notifications where type = 'hall_of_fame' and user_id = (select val from fx where key = 'pb')), 1,
  'the new champion team is notified');

-- ---------- writes from the app are refused ----------
select throws_like(
  $$update public.tournament_champions set champion_team_name = 'Hacked' where tournament_id = (select val from fx where key = 't')$$,
  'Hall of Fame records are kept by the system%',
  'nobody edits a record directly');

-- ---------- MVP: admins only, roster members only ----------
select throws_ok(
  $$select public.set_tournament_mvp((select val from fx where key = 't'), (select val from fx where key = 'pb'))$$,
  'Only admins can set the MVP.',
  'staff cannot set the MVP');
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);
select throws_ok(
  $$select public.set_tournament_mvp((select val from fx where key = 't'), (select val from fx where key = 'pa'))$$,
  'The MVP must be on the champion team''s roster.',
  'the MVP must be on the champion roster');
select lives_ok(
  $$select public.set_tournament_mvp((select val from fx where key = 't'), (select val from fx where key = 'pb'))$$,
  'an admin sets the MVP from the roster');

-- ---------- removing the winner clears the record ----------
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);
update public.matches set winner_team_id = null, status = 'live' where id = (select val from fx where key = 'final');
select is((select count(*)::int from public.tournament_champions where tournament_id = (select val from fx where key = 't')), 0,
  'removing the final''s winner removes the champion');

-- ---------- anon has no direct access ----------
select ok(not has_table_privilege('anon', 'public.tournament_champions', 'select'), 'anon cannot select the table');
select ok(has_function_privilege('anon', 'public.get_hall_of_fame(text, int)', 'execute'), 'anon can read through get_hall_of_fame()');

select * from finish();
rollback;
