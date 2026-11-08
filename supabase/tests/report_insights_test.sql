-- pgTAP: Phase 5 report functions and the saved-report activity log (202611081700_report_insights).
-- Runs as the database owner (RLS isn't applied); the functions' own role checks are what's tested.

begin;

create extension if not exists pgtap;

select plan(11);

set local session_replication_role = 'replica';
create temp table fx (key text primary key, val uuid);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'rep' || i || '@test.dev', '', now(), '{}', '{}', now(), now()
from generate_series(1, 3) i;
insert into public.profiles (id, email, role, full_name)
select id, email, 'player', 'Report Tester' from auth.users where email like 'rep%@test.dev';
update public.profiles set role = 'admin' where email = 'rep1@test.dev';
update public.profiles set role = 'staff' where email = 'rep2@test.dev';
insert into fx select 'admin', id from public.profiles where email = 'rep1@test.dev';
insert into fx select 'staff', id from public.profiles where email = 'rep2@test.dev';
insert into fx select 'player', id from public.profiles where email = 'rep3@test.dev';

do $$
declare t uuid; s uuid; team uuid;
begin
  insert into public.tournaments (name, game, game_id, start_date, end_date, registration_deadline, max_participants)
  values ('Report Cup', 'Valorant', 'valorant', '2030-03-10', '2030-03-12', '2030-03-05', 8) returning id into t;
  insert into fx values ('tournament', t);
  insert into public.teams (name, game_id, captain_id)
  values ('Report Team', 'valorant', (select val from fx where key = 'player')) returning id into team;
  insert into public.tournament_registrations (tournament_id, user_id, team_id, status, registered_at)
  values (t, (select val from fx where key = 'player'), team, 'approved', '2030-03-01 10:00+08');
  insert into public.streams (tournament_id, title, facebook_url, status)
  values (t, 'Report Finals', 'https://www.facebook.com/dalta/videos/123456789/', 'ended') returning id into s;
  -- Two analysed comments (one hidden as offensive) and one waiting
  insert into public.stream_comments (stream_id, user_id, content, sentiment_label, topics, is_offensive, offense_type, moderation_status)
  values (s, (select val from fx where key = 'player'), 'Solid casting', 'positive', '{casting}', false, 'none', 'approved'),
         (s, (select val from fx where key = 'player'), 'mean words', 'negative', '{player conduct}', true, 'bullying', 'hidden'),
         (s, (select val from fx where key = 'player'), 'waiting', null, '{}', false, 'none', 'pending');
  insert into public.user_warnings (user_id, source, source_id, type, reason)
  select (select val from fx where key = 'player'), 'comment', id, 'offensive', 'Insults'
  from public.stream_comments where content = 'mean words';
end $$;

set local session_replication_role = 'origin';

-- ---------- role checks ----------
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'staff') || '"}', true);
select throws_ok($$select public.report_comments()$$, 'Only admins can view the comment report.', 'staff cannot read the comment report');
select throws_ok($$select public.report_moderation()$$, 'Only admins can view the moderation report.', 'staff cannot read the moderation report');

-- ---------- admin results ----------
select set_config('request.jwt.claims', '{"sub":"' || (select val from fx where key = 'admin') || '"}', true);

select is(
  public.report_activity((select val from fx where key = 'tournament')) -> 'registrations_by_day' -> 0 ->> 'day',
  '2030-03-01', 'registrations over time are grouped by Manila day');

select is(
  (public.report_comments((select val from fx where key = 'tournament')) -> 'totals' ->> 'total')::int,
  3, 'the comment report counts every comment of the tournament');

select is(
  (public.report_comments((select val from fx where key = 'tournament')) -> 'totals' ->> 'pending')::int,
  1, 'comments without sentiment count as pending');

select is(
  jsonb_array_length(public.report_comments((select val from fx where key = 'tournament')) -> 'negative_examples'),
  0, 'hidden comments never appear as negative examples');

select is(
  (public.report_comments((select val from fx where key = 'tournament')) -> 'by_stream' -> 0 ->> 'total')::int,
  3, 'comments per stream');

select is(
  (public.report_moderation((select val from fx where key = 'tournament')) -> 'totals' ->> 'comments_hidden')::int,
  1, 'hidden comments are counted');

select is(
  (public.report_moderation((select val from fx where key = 'tournament')) -> 'totals' ->> 'offensive_warnings')::int,
  1, 'warnings are linked to the tournament through their comment');

-- ---------- saved reports are logged ----------
insert into public.analytics_reports (filters, data, generated_by)
values ('{"tournament": "Report Cup"}', '{}', (select val from fx where key = 'admin'));
select is(
  (select count(*)::int from public.activity_logs where action = 'report.generated'
     and details -> 'filters' ->> 'tournament' = 'Report Cup'),
  1, 'generating a report is logged');

delete from public.analytics_reports where filters ->> 'tournament' = 'Report Cup';
select is(
  (select count(*)::int from public.activity_logs where action = 'report.deleted'),
  1, 'deleting a saved report is logged');

select * from finish();
rollback;
