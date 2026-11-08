-- pgTAP: match_drafts rules (202611081300_match_drafts).

begin;

create extension if not exists pgtap;

select plan(7);

set local session_replication_role = 'replica';

create temp table fx (key text primary key, val uuid);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'draft-staff@test.dev', '', now(), '{}', '{}', now(), now());
insert into public.profiles (id, email, role, full_name)
select id, email, 'staff', 'Draft Staff' from auth.users where email = 'draft-staff@test.dev';
insert into fx select 'staff', id from public.profiles where email = 'draft-staff@test.dev';

do $$
declare t uuid;
begin
  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants)
  values ('LoL Draft Cup', 'League of Legends', 'lol', '2030-02-10', '2030-02-12', '2030-02-05', 8)
  returning id into t;
  insert into public.matches (tournament_id, round, match_number) values (t, 1, 1)
  returning id into t;
  insert into fx values ('lol_match', t);

  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants)
  values ('Valo Cup', 'Valorant', 'valorant', '2030-02-10', '2030-02-12', '2030-02-05', 8)
  returning id into t;
  insert into public.matches (tournament_id, round, match_number) values (t, 1, 1)
  returning id into t;
  insert into fx values ('valo_match', t);
end $$;

set local session_replication_role = 'origin';
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);

select lives_ok(
  $$insert into public.match_drafts (match_id, game_number, team_a_bans, team_a_picks, team_b_bans, team_b_picks)
    values ((select val from fx where key = 'lol_match'), 1, '{" Ahri ", ""}', '{"Lee Sin"}', '{"Jinx"}', '{"Thresh"}')$$,
  'staff can save a LoL draft');

select is(
  (select team_a_bans from public.match_drafts where match_id = (select val from fx where key = 'lol_match')),
  array['Ahri'], 'names are trimmed and empty slots dropped');

select is(
  (select updated_by from public.match_drafts where match_id = (select val from fx where key = 'lol_match')),
  (select val from fx where key = 'staff'), 'updated_by is the saver');

select throws_ok(
  $$insert into public.match_drafts (match_id, team_a_bans) values ((select val from fx where key = 'valo_match'), '{"Jett"}')$$,
  'Ban/pick summaries are only for League of Legends matches.',
  'non-LoL matches are refused');

select throws_ok(
  $$insert into public.match_drafts (match_id, game_number, team_a_bans) values
    ((select val from fx where key = 'lol_match'), 2, '{"A","B","C","D","E","F"}')$$,
  'Each team has at most 5 bans.',
  'at most 5 bans');

select throws_ok(
  $$insert into public.match_drafts (match_id, game_number, team_a_bans, team_b_picks) values
    ((select val from fx where key = 'lol_match'), 3, '{"Ahri"}', '{"ahri"}')$$,
  'A champion can only be banned or picked once per game.',
  'no champion twice in a game (case-insensitive)');

select throws_ok(
  $$insert into public.match_drafts (match_id, game_number) values ((select val from fx where key = 'lol_match'), 1)$$,
  '23505', null,
  'one row per match and game');

select * from finish();
rollback;
