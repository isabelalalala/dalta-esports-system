-- pgTAP: game-specific profile fields (202611091400_game_profile_schemas).

begin;

create extension if not exists pgtap;

select plan(11);

set local session_replication_role = 'replica';
create temp table fx (key text primary key, val uuid);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'gp' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 2) i;
insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Game Profile ' || email from auth.users where email like 'gp%@test.dev';
update public.profiles set role = 'admin' where email = 'gp1@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'gp1@test.dev';
insert into fx select 'player', id from public.profiles where email = 'gp2@test.dev';

set local session_replication_role = 'origin';
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'player') || '"}', true);

-- 1. A valid Valorant profile fills in ign / rank / role from details
select lives_ok(
  $$insert into public.player_game_profiles (user_id, game_id, ign, details)
    values ((select val from fx where key = 'player'), 'valorant', 'x',
            '{"riot_id": " Jett#PH1 ", "rank": "gold", "rank_sub": "2", "main_role": "duelist", "agents": ["jett"]}')$$,
  'a valid Valorant profile is saved');
select results_eq(
  $$select ign, rank, in_game_role from public.player_game_profiles
    where game_id = 'valorant' and user_id = (select val from fx where key = 'player')$$,
  $$values ('Jett#PH1'::text, 'Gold 2'::text, 'Duelist'::text)$$,
  'ign, rank and role come from the details');

-- 2. Wrong values are refused with readable messages
select throws_like(
  $$insert into public.player_game_profiles (user_id, game_id, ign, details)
    values ((select val from fx where key = 'player'), 'mlbb', 'x',
            '{"ign": "a", "user_id": "12345", "zone_id": "123", "rank": "radiant"}')$$,
  '%not a Rank option%', 'a Valorant rank on an MLBB profile is refused');
select throws_like(
  $$insert into public.player_game_profiles (user_id, game_id, ign, details)
    values ((select val from fx where key = 'player'), 'mlbb', 'x',
            '{"ign": "a", "user_id": "12345", "zone_id": "123", "agents": ["jett"]}')$$,
  '%not a MLBB profile field%', 'a field from another game is refused');
select throws_like(
  $$insert into public.player_game_profiles (user_id, game_id, ign, details)
    values ((select val from fx where key = 'player'), 'lol', 'x', '{"riot_id": "NoTag"}')$$,
  '%Name#TAG%', 'a Riot ID without #TAG is refused');
select throws_like(
  $$insert into public.player_game_profiles (user_id, game_id, ign, details)
    values ((select val from fx where key = 'player'), 'lol', 'x', '{"riot_id": "Abc#123", "rank": "gold"}')$$,
  '%choose a division%', 'a rank with divisions needs one');
select throws_like(
  $$insert into public.player_game_profiles (user_id, game_id, ign, details)
    values ((select val from fx where key = 'player'), 'codm', 'x', '{"ign": "a", "uid": "12ab"}')$$,
  '%Numbers only%', 'a CODM UID with letters is refused');

-- 3. Master and above have no division: a leftover one is dropped
select lives_ok(
  $$insert into public.player_game_profiles (user_id, game_id, ign, details)
    values ((select val from fx where key = 'player'), 'lol', 'x', '{"riot_id": "Abc#123", "rank": "master", "rank_sub": "i"}')$$,
  'Master is saved without a division');

-- 4. The display columns can't be typed in directly
update public.player_game_profiles set rank = 'Radiant', details = details || '{"agents": ["jett", "sage"]}'
where game_id = 'valorant' and user_id = (select val from fx where key = 'player');
select is(
  (select rank from public.player_game_profiles where game_id = 'valorant' and user_id = (select val from fx where key = 'player')),
  'Gold 2', 'a typed-in rank is replaced by the one from details');

-- 5. Only admins edit the options; renaming relabels saved profiles
select throws_like(
  $$select public.update_game_profile_schema('valorant', (select profile_schema from public.games where id = 'valorant'))$$,
  '%Only admins%', 'players cannot edit game options');
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);
select public.update_game_profile_schema('valorant',
  jsonb_set((select profile_schema from public.games where id = 'valorant'), '{fields,1,options,3,label}', '"Gold Renamed"'));
select is(
  (select rank from public.player_game_profiles where game_id = 'valorant' and user_id = (select val from fx where key = 'player')),
  'Gold Renamed 2', 'renaming an option updates the saved rank text');

select * from finish();
rollback;
