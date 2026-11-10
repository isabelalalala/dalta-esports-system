-- pgTAP: live sentiment timeline (202611101000_live_sentiment).
-- Runs as the database owner; the role check inside the function is what's tested (the caller is
-- set with request.jwt.claims, like the other tests), plus the execute grants.

begin;

create extension if not exists pgtap;

select plan(10);

set local session_replication_role = 'replica';
create temp table fx (key text primary key, val uuid);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'hype' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 4) i;
insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Hype Tester' from auth.users where email like 'hype%@test.dev';
update public.profiles set role = 'admin' where email = 'hype1@test.dev';
update public.profiles set role = 'staff' where email = 'hype2@test.dev';
update public.profiles set role = 'spectator' where email = 'hype4@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'hype1@test.dev';
insert into fx select 'staff', id from public.profiles where email = 'hype2@test.dev';
insert into fx select 'player', id from public.profiles where email = 'hype3@test.dev';
insert into fx select 'spectator', id from public.profiles where email = 'hype4@test.dev';

do $$
declare t uuid; s uuid;
begin
  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants)
  values ('Hype Cup', 'MLBB', 'mlbb', '2030-03-10', '2030-03-12', '2030-03-05', 8) returning id into t;
  insert into public.streams (tournament_id, title, facebook_url, status)
  values (t, 'Hype Cup Finals', 'https://www.facebook.com/dalta/videos/123456789/', 'live') returning id into s;
  insert into fx values ('stream', s);
  -- Analysed, visible comments (two positive, one negative and flagged), one waiting for analysis,
  -- and one hidden (never counted). Triggers are off here, so the moderation fields can be set.
  insert into public.stream_comments (stream_id, user_id, content, sentiment_label, sentiment_score, topics,
                                      is_profane, is_offensive, moderation_status, created_at)
  values
    (s, (select val from fx where key = 'player'), 'secret text one', 'positive', 0.8, '{clutch play}', false, false, 'approved', now() - interval '2 minutes'),
    (s, (select val from fx where key = 'player'), 'secret text two', 'positive', 0.6, '{clutch play}', false, false, 'approved', now() - interval '1 minute'),
    (s, (select val from fx where key = 'spectator'), 'secret text three', 'negative', -0.7, '{lag}', true, false, 'approved', now() - interval '1 minute'),
    (s, (select val from fx where key = 'spectator'), 'secret text four', null, null, '{}', false, false, 'pending', now()),
    (s, (select val from fx where key = 'spectator'), 'secret hidden text', 'negative', -0.9, '{}', false, true, 'hidden', now());
end $$;

set local session_replication_role = 'origin';

-- ---------- who may call it ----------
select ok(not has_function_privilege('anon', 'public.get_stream_sentiment_timeline(uuid, int, timestamptz)', 'execute'),
  'anon cannot execute the function');

select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'player') || '"}', true);
select throws_ok(
  $$select public.get_stream_sentiment_timeline((select val from fx where key = 'stream'))$$,
  'Only organizers can view live sentiment.',
  'players are refused');

select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'spectator') || '"}', true);
select throws_ok(
  $$select public.get_stream_sentiment_timeline((select val from fx where key = 'stream'))$$,
  'Only organizers can view live sentiment.',
  'spectators are refused');

select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.get_stream_sentiment_timeline((select val from fx where key = 'stream'))$$,
  'Only organizers can view live sentiment.',
  'a request without a user is refused');

-- ---------- what it returns ----------
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);
create temp table res as
  select public.get_stream_sentiment_timeline((select val from fx where key = 'stream')) as r;

select is((select (r -> 'totals' ->> 'total')::int from res), 4,
  'staff get the totals of visible comments only (the hidden one is left out)');
select is((select (r -> 'totals' ->> 'positive')::int from res), 2, 'two positive comments');
select is((select (r -> 'totals' ->> 'flagged')::int from res), 1, 'one flagged comment');
select is((select (r ->> 'analyzing')::int from res), 1, 'one comment is still being analysed');

select ok(
  (select r::text not like '%secret%' from res),
  'no comment text in the result');
select ok(
  (select r::text not like '%' || (select val from fx where key = 'player')::text || '%'
      and r::text not like '%' || (select val from fx where key = 'spectator')::text || '%' from res),
  'no user ids in the result');

select * from finish();
rollback;
