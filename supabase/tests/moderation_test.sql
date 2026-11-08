-- pgTAP: comments, AI moderation results, warnings and bans (202611081500_comments_moderation).
-- Runs as the database owner (RLS isn't applied); triggers and functions are what's tested.

begin;

create extension if not exists pgtap;

select plan(20);

-- The server key the pipeline functions check (rolled back with the test)
select vault.create_secret('test-server-key-0123456789abcdef', 'feedback_server_key');

set local session_replication_role = 'replica';
create temp table fx (key text primary key, val uuid);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'mod' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 4) i;
insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Mod Tester' from auth.users where email like 'mod%@test.dev';
update public.profiles set role = 'admin' where email = 'mod1@test.dev';
update public.profiles set role = 'staff' where email = 'mod2@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'mod1@test.dev';
insert into fx select 'staff', id from public.profiles where email = 'mod2@test.dev';
insert into fx select 'p1', id from public.profiles where email = 'mod3@test.dev';
insert into fx select 'p2', id from public.profiles where email = 'mod4@test.dev';

do $$
declare t uuid; s uuid;
begin
  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants)
  values ('Mod Cup', 'Valorant', 'valorant', '2030-03-10', '2030-03-12', '2030-03-05', 8) returning id into t;
  insert into public.streams (tournament_id, title, facebook_url, status)
  values (t, 'Mod Cup Finals', 'https://www.facebook.com/dalta/videos/123456789/', 'live') returning id into s;
  insert into fx values ('stream', s);
  -- Four earlier pending comments by p1 (triggers off: the 3-second rule needs a moving clock)
  insert into fx select 'c' || i, gen_random_uuid() from generate_series(1, 4) i;
  insert into public.stream_comments (id, stream_id, user_id, content)
  select (select val from fx where key = 'c' || i), s, (select val from fx where key = 'p1'), 'old comment ' || i
  from generate_series(1, 4) i;
end $$;

set local session_replication_role = 'origin';

-- ---------- posting ----------
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'p2') || '"}', true);

select lives_ok(
  $$insert into public.stream_comments (stream_id, user_id, content, moderation_status, is_profane)
    values ((select val from fx where key = 'stream'), (select val from fx where key = 'p2'), '  GG ez  ', 'approved', true)$$,
  'a user can post a comment');

select results_eq(
  $$select content, moderation_status, is_profane from public.stream_comments
    where user_id = (select val from fx where key = 'p2')$$,
  $$values ('GG ez'::text, 'pending'::text, false)$$,
  'the comment is trimmed and users cannot set moderation fields');

select throws_ok(
  $$insert into public.stream_comments (stream_id, user_id, content)
    values ((select val from fx where key = 'stream'), (select val from fx where key = 'p2'), 'again')$$,
  'Slow down: you can comment once every 3 seconds.',
  'one comment per 3 seconds');

select throws_ok(
  $$insert into public.stream_comments (stream_id, user_id, content)
    values ((select val from fx where key = 'stream'), (select val from fx where key = 'admin'), repeat('x', 301))$$,
  'Comments can be at most 300 characters.',
  '300 characters at most');

select throws_ok(
  $$update public.stream_comments set content = 'edited' where user_id = (select val from fx where key = 'p2')$$,
  'Comments can''t be edited.',
  'users cannot edit comments');

-- ---------- analysis results ----------
select is(
  public.save_moderation_result('test-server-key-0123456789abcdef', 'comment', (select val from fx where key = 'c1'),
    'negative', -0.9, array['player conduct'], false, true, 'bullying', 'Insults about appearance.'),
  true, 'an offensive result is saved');

select results_eq(
  $$select moderation_status, offense_type, is_offensive from public.stream_comments where id = (select val from fx where key = 'c1')$$,
  $$values ('hidden'::text, 'bullying'::text, true)$$,
  'offensive comments are hidden');

select is(
  public.save_moderation_result('test-server-key-0123456789abcdef', 'comment', (select val from fx where key = 'c1'),
    'negative', -0.9, '{}', false, true, 'bullying', 'again'),
  false, 'a second result for the same comment is ignored');

select is(
  (select count(*)::int from public.user_warnings where user_id = (select val from fx where key = 'p1')),
  1, 'exactly one warning for it (no double warning)');

select throws_ok(
  $$select public.save_moderation_result('wrong-key-wrong-key-wrong', 'comment', (select val from fx where key = 'c2'),
    'neutral', 0, '{}', false, false, 'none', '')$$,
  'The feedback server key is missing or wrong.',
  'the pipeline needs the server key');

select is(
  public.save_moderation_result('test-server-key-0123456789abcdef', 'comment', (select val from fx where key = 'c2'),
    'negative', -0.4, '{}', true, false, 'none', 'Swearing about the lag.'),
  true, 'a profanity-only result is saved');

select results_eq(
  $$select moderation_status, is_profane from public.stream_comments where id = (select val from fx where key = 'c2')$$,
  $$values ('approved'::text, true)$$,
  'profanity stays visible, flagged');

-- ---------- what viewers get ----------
select is(
  (select count(*)::int from public.get_stream_comments((select val from fx where key = 'stream'))
   where id = (select val from fx where key = 'c1')),
  0, 'other viewers do not get the hidden comment');

select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'p1') || '"}', true);
select is(
  (select moderation_status from public.get_stream_comments((select val from fx where key = 'stream'))
   where id = (select val from fx where key = 'c1')),
  'hidden', 'the author still sees their hidden comment, marked');

select is(
  (select author_name from public.get_stream_comments((select val from fx where key = 'stream')) limit 1),
  'Mod T.', 'authors are shown as first name + initial');

-- ---------- 5 warnings -> flagged ----------
select public.save_moderation_result('test-server-key-0123456789abcdef', 'comment', (select val from fx where key = 'c' || i),
  'negative', -0.5, '{}', true, false, 'none', 'Profanity.')
from generate_series(3, 4) i;
-- 4 warnings so far; a 5th from a moderator removing a visible comment
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);
select public.moderate_comment((select val from fx where key = 'c2'), 'remove', 'Repeated swearing', true);

select is(
  (select ban_status from public.profiles where id = (select val from fx where key = 'p1')),
  'pending', '5 active warnings flag the account');

select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'p1') || '"}', true);
select is(public.can_post(), false, 'a flagged account cannot post');

-- ---------- restore removes the AI warning ----------
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);
select public.moderate_comment((select val from fx where key = 'c1'), 'restore', 'Not bullying, a joke between friends');
select is(
  (select count(*)::int from public.user_warnings
   where source_id = (select val from fx where key = 'c1') and removed_at is not null),
  1, 'restoring a hidden comment removes its warning');

-- ---------- bans ----------
select throws_ok(
  $$select public.ban_user((select val from fx where key = 'p1'), 'Toxic chat')$$,
  'Only admins can ban accounts.',
  'staff cannot ban');

select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);
select public.ban_user((select val from fx where key = 'p1'), 'Toxic chat');
select ok(
  public.custom_access_token_hook(jsonb_build_object('user_id', (select val from fx where key = 'p1'), 'claims', '{}'::jsonb)) ? 'error',
  'the login hook refuses a banned account');

select * from finish();
rollback;
