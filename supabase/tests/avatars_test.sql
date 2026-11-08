-- pgTAP: profile picture rules (202611081400_avatars_and_tour).

begin;

create extension if not exists pgtap;

select plan(7);

set local session_replication_role = 'replica';
create temp table fx (key text primary key, val uuid);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'av' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 3) i;
insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Avatar ' || email from auth.users where email like 'av%@test.dev';
update public.profiles set role = 'admin' where email = 'av1@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'av1@test.dev';
insert into fx select 'p2', id from public.profiles where email = 'av2@test.dev';
insert into fx select 'p3', id from public.profiles where email = 'av3@test.dev';

set local session_replication_role = 'origin';
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'p2') || '"}', true);

select lives_ok(
  format($$update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/%s/a.webp' where id = %L$$,
         (select val from fx where key = 'p2'), (select val from fx where key = 'p2')),
  'a user can set a picture from their own folder');

select throws_ok(
  format($$update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/%s/a.webp' where id = %L$$,
         (select val from fx where key = 'p3'), (select val from fx where key = 'p2')),
  '23514', null,
  'a picture from someone else''s folder is refused (CHECK)');

select throws_ok(
  $$update public.profiles set avatar_url = 'https://evil.example.com/a.webp' where id = (select val from fx where key = 'p2')$$,
  '23514', null,
  'a picture from another site is refused');

-- The admin can't replace or clear it directly...
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);
select throws_ok(
  $$update public.profiles set avatar_url = null where id = (select val from fx where key = 'p2')$$,
  'Only the owner can change a profile picture. Admins can remove one with "Remove picture".',
  'an admin cannot change someone''s picture directly');

-- ...only remove it through admin_remove_avatar, with a reason
select throws_ok(
  $$select public.admin_remove_avatar((select val from fx where key = 'p2'), '')$$,
  'Please give a reason (the user will see it).',
  'removing needs a reason');

select lives_ok(
  $$select public.admin_remove_avatar((select val from fx where key = 'p2'), 'Inappropriate image')$$,
  'an admin removes a picture with a reason');

select results_eq(
  $$select (select avatar_url from public.profiles where id = (select val from fx where key = 'p2')) is null,
           (select count(*)::int from public.activity_logs where action = 'user.avatar_removed' and entity_id = (select val from fx where key = 'p2')),
           (select count(*)::int from public.notifications where type = 'avatar_removed' and user_id = (select val from fx where key = 'p2'))$$,
  $$values (true, 1, 1)$$,
  'the picture is cleared, logged and the user notified');

select * from finish();
rollback;
