-- Hall of Fame: every tournament's champion, kept over time (public page /hall-of-fame)
--
-- 1. tournament_champions: one row per tournament whose final has a winner. A snapshot at the moment
--    of winning (team name, logo, runner-up, final score, roster), because teams get renamed or
--    removed and rosters change later (team_removals, captaincy transfers).
--    Scores are stored from the champion's side: champion_score / runner_up_score.
-- 2. Written only by the database:
--    - record_champion(): AFTER trigger on matches. When the FINAL (last round, no next match) gets
--      or changes a winner (approve, override, forfeit, walkover, direct edit) the row is upserted;
--      when the winner is removed or the final is deleted (bracket regenerated) the row is deleted.
--      It fires only on changes of winner/scores/status (and insert/delete), NOT on next_match_id:
--      deleting a bracket sets next_match_id null on the other matches, which must not crown a
--      semifinal winner. It runs whatever caused it (unlike the activity log), because winners are
--      set inside other functions (review_match_result, declare_forfeit, walkovers).
--    - protect_champion(): BEFORE trigger, refuses any write without the flag app.recording_champion
--      (the SQL Editor, auth.uid() null, is always allowed). There are no insert/update/delete policies.
-- 3. Admins only, through functions (logged): set_tournament_mvp() (must be on the champion roster,
--    or null to clear) and set_champion_published().
-- 4. Notification `hall_of_fame` to the champion team's members when a team newly becomes champion
--    (not when only the score is edited). Mutable in notification settings.
-- 5. Reading: get_hall_of_fame(game, year) for anyone (published rows; admins also unpublished).
--    Privacy choice (b): team names, logos, scores and tournament for everyone; the roster (IGN +
--    in-team role, never user ids) and the MVP only for logged-in users. The table itself is closed
--    to anon. get_team_titles(team_ids) for team cards/pages, get_my_titles() for your own chips.
-- 6. Account deletion removes the person from every roster snapshot and clears them as MVP
--    (the Privacy Notice promises a deleted account's IGN doesn't outlive it).
-- 7. Backfill: rows for tournaments whose final already has a winner (no notifications).
--
-- Run in the Supabase SQL Editor after 202611101000_live_sentiment.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_champions (
  tournament_id uuid primary key references public.tournaments (id) on delete cascade,
  final_match_id uuid not null,
  game_id text references public.games (id) on delete set null,
  champion_team_id uuid references public.teams (id) on delete set null,
  champion_team_name text not null,
  champion_logo_url text,
  runner_up_team_id uuid references public.teams (id) on delete set null,
  runner_up_team_name text,
  champion_score int,
  runner_up_score int,
  -- [{user_id, ign, role}] at the moment of winning; user_id is never returned to the public
  roster jsonb not null default '[]'::jsonb check (jsonb_typeof(roster) = 'array'),
  mvp_user_id uuid references public.profiles (id) on delete set null,
  mvp_name text,
  decided_at timestamptz not null default now(),
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists tournament_champions_team_idx on public.tournament_champions (champion_team_id);
create index if not exists tournament_champions_game_idx on public.tournament_champions (game_id, decided_at desc);

alter table public.tournament_champions enable row level security;

-- Admins read everything (the Admin Panel); everyone else reads through get_hall_of_fame()
drop policy if exists "Admins read champions" on public.tournament_champions;
create policy "Admins read champions" on public.tournament_champions
  for select to authenticated
  using (public.get_my_role() = 'admin');

revoke all on public.tournament_champions from anon;
revoke insert, update, delete on public.tournament_champions from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Only the database writes it
-- ---------------------------------------------------------------------------
create or replace function public.protect_champion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- pg_trigger_depth() > 1: a foreign key cascade (a team or account deleted sets champion_team_id /
  -- mvp_user_id to null) or our own triggers; the app itself can never write at that depth
  if auth.uid() is not null
     and pg_trigger_depth() <= 1
     and coalesce(current_setting('app.recording_champion', true), '') <> 'on' then
    raise exception 'Hall of Fame records are kept by the system. Admins can only set the MVP and publish or hide a record.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tournament_champions_protect on public.tournament_champions;
create trigger tournament_champions_protect
  before insert or update or delete on public.tournament_champions
  for each row execute function public.protect_champion();

-- Upsert the champion of one final (shared by the trigger and the backfill). p_notify: tell the
-- team's members when the champion is new or a different team.
create or replace function public.upsert_champion(p_match_id uuid, p_notify boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matches%rowtype;
  t public.tournaments%rowtype;
  champ public.teams%rowtype;
  runner public.teams%rowtype;
  previous uuid;
  members jsonb;
begin
  select * into m from public.matches where id = p_match_id;
  if not found or m.winner_team_id is null then return; end if;
  select * into t from public.tournaments where id = m.tournament_id;
  select * into champ from public.teams where id = m.winner_team_id;
  select * into runner from public.teams
  where id = case when m.winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;

  -- Roster snapshot: members with their IGN for this game (in-team role captain/player)
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', tm.user_id,
           'ign', coalesce(nullif(gp.ign, ''), 'Player'),
           'role', tm.role
         ) order by (tm.role = 'captain') desc, gp.ign), '[]'::jsonb)
  into members
  from public.team_members tm
  left join public.player_game_profiles gp on gp.user_id = tm.user_id and gp.game_id = t.game_id
  where tm.team_id = m.winner_team_id;

  select champion_team_id into previous from public.tournament_champions where tournament_id = t.id;

  perform set_config('app.recording_champion', 'on', true);
  insert into public.tournament_champions as tc (
    tournament_id, final_match_id, game_id, champion_team_id, champion_team_name, champion_logo_url,
    runner_up_team_id, runner_up_team_name, champion_score, runner_up_score, roster, decided_at
  ) values (
    t.id, m.id, t.game_id, champ.id, coalesce(champ.name, 'Champion'), champ.logo_url,
    runner.id, runner.name,
    case when m.winner_team_id = m.team_a_id then m.score_a else m.score_b end,
    case when m.winner_team_id = m.team_a_id then m.score_b else m.score_a end,
    members, coalesce(m.updated_at, now())
  )
  on conflict (tournament_id) do update set
    final_match_id = excluded.final_match_id,
    game_id = excluded.game_id,
    champion_team_id = excluded.champion_team_id,
    champion_team_name = excluded.champion_team_name,
    champion_logo_url = excluded.champion_logo_url,
    runner_up_team_id = excluded.runner_up_team_id,
    runner_up_team_name = excluded.runner_up_team_name,
    champion_score = excluded.champion_score,
    runner_up_score = excluded.runner_up_score,
    -- A different champion: new roster and the old MVP no longer applies; a score fix keeps both
    roster = case when tc.champion_team_id is distinct from excluded.champion_team_id then excluded.roster else tc.roster end,
    mvp_user_id = case when tc.champion_team_id is distinct from excluded.champion_team_id then null else tc.mvp_user_id end,
    mvp_name = case when tc.champion_team_id is distinct from excluded.champion_team_id then null else tc.mvp_name end,
    decided_at = case when tc.champion_team_id is distinct from excluded.champion_team_id then excluded.decided_at else tc.decided_at end;
  perform set_config('app.recording_champion', 'off', true);

  if p_notify and previous is distinct from champ.id then
    perform public.notify_users(
      array(select (r ->> 'user_id')::uuid from jsonb_array_elements(members) r),
      'hall_of_fame',
      'Your team is in the Hall of Fame',
      champ.name || ' won ' || t.name || '. Your title is now in the DALTA Esports Hall of Fame.',
      '/hall-of-fame'
    );
  end if;
end $$;

revoke execute on function public.upsert_champion(uuid, boolean) from public, anon, authenticated;

create or replace function public.record_champion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_final boolean;
begin
  if tg_op = 'DELETE' then
    -- The final was deleted (bracket regenerated): its record goes too
    perform set_config('app.recording_champion', 'on', true);
    delete from public.tournament_champions where final_match_id = old.id;
    perform set_config('app.recording_champion', 'off', true);
    return old;
  end if;

  is_final := new.next_match_id is null
    and new.round = (select max(round) from public.matches where tournament_id = new.tournament_id);
  if not is_final then return new; end if;

  if new.winner_team_id is null then
    -- The winner was removed: no champion
    perform set_config('app.recording_champion', 'on', true);
    delete from public.tournament_champions where tournament_id = new.tournament_id;
    perform set_config('app.recording_champion', 'off', true);
  else
    perform public.upsert_champion(new.id, true);
  end if;
  return new;
end $$;

revoke execute on function public.record_champion() from public, anon, authenticated;

drop trigger if exists matches_record_champion on public.matches;
create trigger matches_record_champion
  after insert or update of winner_team_id, score_a, score_b, status or delete on public.matches
  for each row execute function public.record_champion();

-- ---------------------------------------------------------------------------
-- 3. Admin actions (logged)
-- ---------------------------------------------------------------------------
create or replace function public.set_tournament_mvp(p_tournament_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.tournament_champions%rowtype;
  mvp_ign text;
  tname text;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Only admins can set the MVP.';
  end if;
  select * into rec from public.tournament_champions where tournament_id = p_tournament_id;
  if not found then
    raise exception 'This tournament has no champion yet.';
  end if;
  if p_user_id is not null then
    select r ->> 'ign' into mvp_ign
    from jsonb_array_elements(rec.roster) r
    where (r ->> 'user_id')::uuid = p_user_id;
    if mvp_ign is null then
      raise exception 'The MVP must be on the champion team''s roster.';
    end if;
  end if;

  perform set_config('app.recording_champion', 'on', true);
  update public.tournament_champions
  set mvp_user_id = p_user_id, mvp_name = mvp_ign
  where tournament_id = p_tournament_id;
  perform set_config('app.recording_champion', 'off', true);

  select name into tname from public.tournaments where id = p_tournament_id;
  perform public.log_activity('champion.mvp_set', 'tournament', p_tournament_id,
    jsonb_build_object('tournament_name', tname, 'team_name', rec.champion_team_name, 'mvp_name', mvp_ign));
end $$;

revoke execute on function public.set_tournament_mvp(uuid, uuid) from public, anon;
grant execute on function public.set_tournament_mvp(uuid, uuid) to authenticated;

create or replace function public.set_champion_published(p_tournament_id uuid, p_published boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.tournament_champions%rowtype;
  tname text;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Only admins can publish or hide a Hall of Fame record.';
  end if;
  if p_published is null then
    raise exception 'Choose published or hidden.';
  end if;
  select * into rec from public.tournament_champions where tournament_id = p_tournament_id;
  if not found then
    raise exception 'This tournament has no champion yet.';
  end if;
  if rec.is_published = p_published then return; end if;

  perform set_config('app.recording_champion', 'on', true);
  update public.tournament_champions set is_published = p_published where tournament_id = p_tournament_id;
  perform set_config('app.recording_champion', 'off', true);

  select name into tname from public.tournaments where id = p_tournament_id;
  perform public.log_activity(
    case when p_published then 'champion.published' else 'champion.unpublished' end,
    'tournament', p_tournament_id,
    jsonb_build_object('tournament_name', tname, 'team_name', rec.champion_team_name));
end $$;

revoke execute on function public.set_champion_published(uuid, boolean) from public, anon;
grant execute on function public.set_champion_published(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reading
-- ---------------------------------------------------------------------------
-- Published champions (admins: all), newest first. p_year = the tournament's start-date year (season).
-- Logged out: no roster and no MVP (privacy choice b). Never user ids.
create or replace function public.get_hall_of_fame(p_game text default null, p_year int default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by decided_at desc), '[]'::jsonb)
  from (
    select tc.decided_at,
           jsonb_build_object(
             'tournament_id', tc.tournament_id,
             'tournament_name', t.name,
             'season', extract(year from t.start_date)::int,
             'game_id', tc.game_id,
             'game_name', g.name,
             'champion_team_id', tc.champion_team_id,
             'champion_team_name', tc.champion_team_name,
             'champion_logo_url', tc.champion_logo_url,
             'runner_up_team_name', tc.runner_up_team_name,
             'champion_score', tc.champion_score,
             'runner_up_score', tc.runner_up_score,
             'decided_at', tc.decided_at,
             'is_published', tc.is_published,
             'mvp_name', case when auth.uid() is not null then tc.mvp_name end,
             'roster', case when auth.uid() is not null then (
               select coalesce(jsonb_agg(jsonb_build_object('ign', r ->> 'ign', 'role', r ->> 'role')), '[]'::jsonb)
               from jsonb_array_elements(tc.roster) r
             ) end
           ) as row_data
    from public.tournament_champions tc
    join public.tournaments t on t.id = tc.tournament_id
    left join public.games g on g.id = tc.game_id
    where (tc.is_published or public.get_my_role() = 'admin')
      and t.status <> 'cancelled'
      and (p_game is null or tc.game_id = p_game)
      and (p_year is null or extract(year from t.start_date)::int = p_year)
  ) x;
$$;

revoke execute on function public.get_hall_of_fame(text, int) from public;
grant execute on function public.get_hall_of_fame(text, int) to anon, authenticated;

-- Title counts for team cards and team pages (published records only)
create or replace function public.get_team_titles(p_team_ids uuid[])
returns table (team_id uuid, titles int)
language sql
stable
security definer
set search_path = ''
as $$
  select tc.champion_team_id, count(*)::int
  from public.tournament_champions tc
  where tc.is_published and tc.champion_team_id = any (p_team_ids)
  group by tc.champion_team_id;
$$;

revoke execute on function public.get_team_titles(uuid[]) from public, anon;
grant execute on function public.get_team_titles(uuid[]) to authenticated;

-- Your own titles (you were on the champion roster), for the "Champion" chips on /profile
create or replace function public.get_my_titles()
returns table (tournament_id uuid, tournament_name text, game_id text, team_name text, decided_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select tc.tournament_id, t.name, tc.game_id, tc.champion_team_name, tc.decided_at
  from public.tournament_champions tc
  join public.tournaments t on t.id = tc.tournament_id
  where tc.is_published
    and auth.uid() is not null
    and exists (select 1 from jsonb_array_elements(tc.roster) r where (r ->> 'user_id')::uuid = auth.uid())
  order by tc.decided_at desc;
$$;

revoke execute on function public.get_my_titles() from public, anon;
grant execute on function public.get_my_titles() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Account deletion: remove the person from every roster snapshot
-- ---------------------------------------------------------------------------
create or replace function public.scrub_champion_rosters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.recording_champion', 'on', true);
  update public.tournament_champions
  set roster = (
        select coalesce(jsonb_agg(r), '[]'::jsonb)
        from jsonb_array_elements(roster) r
        where (r ->> 'user_id')::uuid <> old.id
      ),
      mvp_user_id = case when mvp_user_id = old.id then null else mvp_user_id end,
      mvp_name = case when mvp_user_id = old.id then null else mvp_name end
  where mvp_user_id = old.id
     or exists (select 1 from jsonb_array_elements(roster) r where (r ->> 'user_id')::uuid = old.id);
  perform set_config('app.recording_champion', 'off', true);
  return old;
end $$;

revoke execute on function public.scrub_champion_rosters() from public, anon, authenticated;

drop trigger if exists profiles_scrub_champion_rosters on public.profiles;
create trigger profiles_scrub_champion_rosters
  before delete on public.profiles
  for each row execute function public.scrub_champion_rosters();

-- ---------------------------------------------------------------------------
-- 6. Notification type hall_of_fame: full list from 202611091900_phase12_security_engagement + new.
--    It can be muted, so it joins the notification settings list too.
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved', 'registration_rejected', 'registration_removed',
  'registration_submitted', 'registration_withdrawn',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'checkin_open', 'match_forfeit',
  'result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected',
  'tournament_cancelled',
  'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'team_added',  -- no longer sent (players join by invite); kept for older rows
  'member_left', 'member_removed',
  'join_request', 'join_request_accepted', 'join_request_declined',
  'student_verified', 'student_rejected', 'student_revoked',
  'verification_submitted', 'role_changed',
  'prediction_result',
  'team_removed', 'team_restored',
  'avatar_removed',
  'warning_issued', 'warning_removed', 'content_restored',
  'account_flagged', 'ban_review', 'ban_dismissed', 'account_unbanned',
  'team_logo_removed',
  'comment_reported',
  'hall_of_fame'
));

alter table public.notification_preferences drop constraint if exists notification_preferences_muted_check;
alter table public.notification_preferences add constraint notification_preferences_muted_check check (muted_types <@ array[
  'registration_approved', 'registration_rejected', 'registration_removed',
  'registration_submitted', 'registration_withdrawn',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'checkin_open', 'match_forfeit',
  'result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected',
  'tournament_cancelled', 'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'member_left', 'member_removed',
  'join_request', 'join_request_accepted', 'join_request_declined',
  'student_verified', 'student_rejected', 'student_revoked', 'verification_submitted',
  'prediction_result', 'comment_reported',
  'hall_of_fame'
]::text[]);

-- ---------------------------------------------------------------------------
-- 7. Backfill: finals that already have a winner (no notifications)
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select m.id
    from public.matches m
    where m.winner_team_id is not null
      and m.next_match_id is null
      and m.round = (select max(round) from public.matches x where x.tournament_id = m.tournament_id)
  loop
    perform public.upsert_champion(f.id, false);
  end loop;
end $$;

commit;
