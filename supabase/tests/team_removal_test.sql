-- pgTAP: remove_team() / restore_team() (202611081000_team_removal).
-- 4 Tekken 8 teams (solo: the captain is the whole roster) in a 4-team bracket.
-- Fixtures are inserted with triggers off, like bracket_test.sql.

begin;

create extension if not exists pgtap;

select plan(20);

-- ---------- fixtures ----------

set local session_replication_role = 'replica';

create temp table fx (key text primary key, val uuid);

-- 6 users: admin, staff, 4 captains
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
       'authenticated', 'rm' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 6) i;

insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Removal ' || email from auth.users where email like 'rm%@test.dev';
update public.profiles set role = 'admin' where email = 'rm1@test.dev';
update public.profiles set role = 'staff' where email = 'rm2@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'rm1@test.dev';
insert into fx select 'staff', id from public.profiles where email = 'rm2@test.dev';

do $$
declare
  t_id uuid;
  team_id uuid;
  cap uuid;
begin
  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants, created_by)
  values ('Removal Cup', 'Tekken 8', 'tekken8', '2030-01-10', '2030-01-12', '2030-01-05', 16, (select val from fx where key = 'admin'))
  returning id into t_id;
  insert into fx values ('tournament', t_id);

  for i in 1..4 loop
    select id into cap from auth.users where email = 'rm' || (i + 2) || '@test.dev';
    insert into public.teams (name, game_id, captain_id)
    values ('Removal Team ' || i, 'tekken8', cap)
    returning id into team_id;
    -- setup_new_team() doesn't run with triggers off: add the captain row by hand
    insert into public.team_members (team_id, user_id, role) values (team_id, cap, 'captain');
    insert into public.tournament_registrations (tournament_id, user_id, team_id, status)
    values (t_id, cap, team_id, 'approved');
  end loop;
end $$;

set local session_replication_role = 'origin';

-- Act as the admin (get_my_role() reads auth.uid() from the JWT claims)
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);
select public.generate_bracket((select val from fx where key = 'tournament'));

-- Name the slots: semifinal 1 = A vs B, semifinal 2 = C vs D, final = F
insert into fx
select 'A', team_a_id from public.matches where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 1;
insert into fx
select 'B', team_b_id from public.matches where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 1;
insert into fx
select 'C', team_a_id from public.matches where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 2;
insert into fx
select 'D', team_b_id from public.matches where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 2;
insert into fx
select 'semi1', id from public.matches where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 1;
insert into fx
select 'semi2', id from public.matches where tournament_id = (select val from fx where key = 'tournament') and round = 1 and match_number = 2;
insert into fx
select 'final', id from public.matches where tournament_id = (select val from fx where key = 'tournament') and round = 2;

-- ---------- permissions ----------

-- Act as B's captain
select set_config('request.jwt.claims',
  '{"sub":"' || (select captain_id from public.teams where id = (select val from fx where key = 'B')) || '"}', true);

select throws_ok(
  $$select public.remove_team((select val from fx where key = 'A'), 'Cheating in round 1')$$,
  'Only admins and tournament staff can remove a team.',
  'a player cannot remove a team');

select throws_ok(
  $$update public.teams set is_removed = true where id = (select val from fx where key = 'B')$$,
  'Use "Remove team" on the team page to remove or restore a team.',
  'a captain cannot mark their own team removed by hand');

-- ---------- remove A (opponent known: immediate walkover) ----------

select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);

select throws_ok(
  $$select public.remove_team((select val from fx where key = 'A'), 'no')$$,
  'Please give a reason for removing the team (at least 5 characters).',
  'a reason is required');

select is(
  (public.remove_team((select val from fx where key = 'A'), 'Code of Conduct violation') ->> 'walkovers')::int,
  1, 'staff remove A: one walkover');

select ok((select is_removed from public.teams where id = (select val from fx where key = 'A')), 'A is marked removed');

select results_eq(
  $$select status, winner_team_id, is_forfeit from public.matches where id = (select val from fx where key = 'semi1')$$,
  $$select 'completed'::text, (select val from fx where key = 'B'), true$$,
  'semifinal 1 goes to B by walkover');

select is(
  (select team_a_id from public.matches where id = (select val from fx where key = 'final')),
  (select val from fx where key = 'B'), 'B advanced into the final');

select is(
  (select count(*)::int from public.team_members where team_id = (select val from fx where key = 'A')),
  0, 'A''s members were freed');

select is(
  (select status from public.tournament_registrations where team_id = (select val from fx where key = 'A')),
  'cancelled', 'A''s registration was withdrawn');

select is(
  (select reason from public.team_removals where team_id = (select val from fx where key = 'A')),
  'Code of Conduct violation', 'the reason is kept in team_removals');

select is(
  (select count(*)::int from public.activity_logs where action = 'team.removed' and entity_id = (select val from fx where key = 'A')),
  1, 'the removal is in the activity log');

select is(
  (select count(*)::int from public.notifications n
     join public.teams t on t.captain_id = n.user_id
    where t.id = (select val from fx where key = 'A') and n.type = 'team_removed'),
  1, 'A''s captain was notified');

select is(
  (select count(*)::int from public.list_teams(null, 'tekken8') where id = (select val from fx where key = 'A')),
  0, 'list_teams leaves A out');

select throws_ok(
  $$insert into public.tournament_registrations (tournament_id, user_id, team_id, status)
    values ((select val from fx where key = 'tournament'), auth.uid(), (select val from fx where key = 'A'), 'pending')$$,
  'This team was removed by the organizers.',
  'a removed team cannot register again');

-- ---------- remove B (opponent in the final not known yet: walkover later) ----------

select is(
  (public.remove_team((select val from fx where key = 'B'), 'Left the organization') ->> 'walkovers')::int,
  0, 'removing B decides nothing yet (final opponent unknown)');

-- Semifinal 2 is played: C wins. C moves into the final and meets removed B.
update public.matches
set status = 'completed', score_a = 2, score_b = 0, winner_team_id = (select val from fx where key = 'C')
where id = (select val from fx where key = 'semi2');

select results_eq(
  $$select status, winner_team_id, is_forfeit from public.matches where id = (select val from fx where key = 'final')$$,
  $$select 'completed'::text, (select val from fx where key = 'C'), true$$,
  'the final goes to C by walkover as soon as C arrives');

-- ---------- restore A ----------

select throws_ok(
  $$select public.restore_team((select val from fx where key = 'A'))$$,
  'Only admins can restore a removed team.',
  'staff cannot restore');

select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);

select is(
  (public.restore_team((select val from fx where key = 'A')) ->> 'members')::int,
  1, 'admin restores A with its captain');

select ok(not (select is_removed from public.teams where id = (select val from fx where key = 'A')), 'A is active again');

select is(
  (select status from public.matches where id = (select val from fx where key = 'semi1')) || '/' ||
  (select status from public.tournament_registrations where team_id = (select val from fx where key = 'A')),
  'completed/cancelled', 'restore does not undo the walkover or the withdrawal');

select * from finish();
rollback;
