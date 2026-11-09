-- Phase 14: announcements as a public esports news feed
-- Run AFTER 202611091900_phase12_security_engagement (it redefines functions from that file).
--
-- 1. New announcement fields: category, cover image (site-images bucket, folder announcements/),
--    related game, a linked tournament / match / stream / event (shown as a mini card), urgent
--    and draft flags. "pinned" stays the pin flag; at most 3 announcements can be pinned.
-- 2. Published announcements are public (also logged out). Drafts and scheduled posts stay
--    visible to admin/staff only. A draft never sends a notification; publishing it does.
-- 3. announcement_reactions (hype / gg / heart): logged-in users add and remove their own;
--    everyone sees only the totals through get_announcement_reactions().
-- 4. announcement_reads: which announcements a logged-in user has opened (own rows only), for
--    the NEW badge.
-- 5. get_announcement_links(): the public details of the linked tournament / match / stream /
--    event (names, times, scores, status; never stream URLs or team rosters).
-- 6. announcements in the supabase_realtime publication ("1 new post" pill).
-- Notification links now open the announcement itself (/announcements/<id>).

begin;

-- ---------------------------------------------------------------------------
-- 1. New fields
-- ---------------------------------------------------------------------------
alter table public.announcements
  add column if not exists category text not null default 'general',
  add column if not exists cover_path text,
  add column if not exists game_id text references public.games (id) on delete set null,
  add column if not exists linked_type text,
  add column if not exists linked_id uuid,
  add column if not exists is_urgent boolean not null default false,
  add column if not exists is_draft boolean not null default false;

alter table public.announcements drop constraint if exists announcements_category_check;
alter table public.announcements add constraint announcements_category_check
  check (category in ('tournament', 'match_update', 'results', 'event', 'registration', 'stream', 'general', 'urgent'));

-- Only files uploaded by the editor: "announcements/<random>.<ext>" in the site-images bucket
alter table public.announcements drop constraint if exists announcements_cover_path_check;
alter table public.announcements add constraint announcements_cover_path_check
  check (cover_path is null or cover_path ~ '^announcements/[A-Za-z0-9-]+\.(png|jpg|webp|gif)$');

alter table public.announcements drop constraint if exists announcements_linked_check;
alter table public.announcements add constraint announcements_linked_check
  check (
    (linked_type is null and linked_id is null)
    or (linked_type in ('tournament', 'match', 'stream', 'event') and linked_id is not null)
  );

-- New posts only (old rows may be longer): the editor has the same limits
alter table public.announcements drop constraint if exists announcements_title_length;
alter table public.announcements add constraint announcements_title_length
  check (length(trim(title)) between 1 and 150) not valid;
alter table public.announcements drop constraint if exists announcements_body_length;
alter table public.announcements add constraint announcements_body_length
  check (length(body) <= 20000) not valid;

create index if not exists announcements_feed_idx on public.announcements (is_draft, publish_at desc);
create index if not exists announcements_game_idx on public.announcements (game_id);

-- The linked row must exist (no foreign key is possible for "one of four tables"). If it is
-- deleted later, the mini card simply disappears (get_announcement_links finds nothing).
-- Max 3 pinned announcements.
create or replace function public.check_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_it boolean;
begin
  if new.linked_type is not null
     and (tg_op = 'INSERT' or new.linked_type is distinct from old.linked_type or new.linked_id is distinct from old.linked_id) then
    found_it := case new.linked_type
      when 'tournament' then exists (select 1 from public.tournaments where id = new.linked_id)
      when 'match'      then exists (select 1 from public.matches where id = new.linked_id)
      when 'stream'     then exists (select 1 from public.streams where id = new.linked_id)
      when 'event'      then exists (select 1 from public.events where id = new.linked_id)
      else false end;
    if not found_it then
      raise exception 'The linked % no longer exists. Pick another one.', replace(new.linked_type, '_', ' ');
    end if;
  end if;

  if new.pinned and (tg_op = 'INSERT' or not old.pinned)
     and (select count(*) from public.announcements where pinned and id <> new.id) >= 3 then
    raise exception 'At most 3 announcements can be pinned. Unpin one first.';
  end if;
  return new;
end $$;

drop trigger if exists announcements_check on public.announcements;
create trigger announcements_check
  before insert or update on public.announcements
  for each row execute function public.check_announcement();

-- ---------------------------------------------------------------------------
-- 2. Drafts, publishing and notifications
-- ---------------------------------------------------------------------------

-- Latest version (202611091900) + link to the announcement itself + "Urgent:" title
create or replace function public.send_announcement_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements;
  recipients uuid[];
  tour_name text;
begin
  select * into a from public.announcements where id = p_id;
  if not found or a.is_draft then return; end if;

  if a.tournament_id is null then
    select array_agg(id) into recipients from public.profiles;
  else
    select name into tour_name from public.tournaments where id = a.tournament_id;
    select public.team_member_ids(coalesce(array_agg(r.team_id), '{}')) into recipients
    from public.tournament_registrations r
    where r.tournament_id = a.tournament_id
      and r.status in ('pending', 'approved')
      and r.team_id is not null;
  end if;

  perform public.notify_users(coalesce(recipients, '{}'), 'announcement',
    case when a.is_urgent then 'Urgent' else 'New announcement' end
      || case when tour_name is null then '' else ': ' || tour_name end,
    a.title, '/announcements/' || a.id);
end $$;

revoke execute on function public.send_announcement_notification(uuid) from public, anon, authenticated;

-- Latest version (202611091900) + a draft is never marked as sent
create or replace function public.prepare_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.publish_at is null then new.publish_at := now(); end if;
  if not new.is_draft and new.publish_at <= now() then
    new.notified_at := now();
  else
    new.notified_at := null;
  end if;
  return new;
end $$;

-- Latest version (202611091900) + drafts: publishing a draft (or clearing a past schedule)
-- marks it sent here, and the AFTER UPDATE trigger below sends the notification. A draft
-- published after its saved time gets "now" as its date, so it appears at the top of the feed.
create or replace function public.touch_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.publishing_announcement', true), '') = 'on' then
    new.updated_at := old.updated_at;
    return new;
  end if;

  new.updated_at := now();
  -- The author and post date stay as they were
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if old.is_draft and not new.is_draft and new.publish_at < now() then
    new.publish_at := now();
  end if;

  if new.is_draft then
    -- Not sent yet: stays unsent while it is a draft
    if old.notified_at is null then new.notified_at := null; end if;
  elsif new.publish_at > now() then
    -- Moving the publish time into the future (re)schedules the notification
    if new.publish_at is distinct from old.publish_at or old.is_draft then
      new.notified_at := null;
    end if;
  elsif new.notified_at is null then
    new.notified_at := now();
  end if;
  return new;
end $$;

-- Sends the notification when an update marked the announcement as sent (draft published).
-- The pg_cron job sends its own (flag), so it isn't sent twice.
create or replace function public.notify_announcement_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.publishing_announcement', true), '') = 'on' then return null; end if;
  if old.notified_at is null and new.notified_at is not null and not new.is_draft then
    perform public.send_announcement_notification(new.id);
  end if;
  return null;
end $$;

drop trigger if exists announcements_notify_published on public.announcements;
create trigger announcements_notify_published
  after update on public.announcements
  for each row execute function public.notify_announcement_published();

-- Latest version (202611091900) + drafts are skipped
create or replace function public.publish_scheduled_announcements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  due uuid;
begin
  perform set_config('app.publishing_announcement', 'on', true);
  for due in
    select id from public.announcements
    where notified_at is null and not is_draft and publish_at <= now()
    order by publish_at
    for update skip locked
  loop
    update public.announcements set notified_at = now() where id = due;
    perform public.send_announcement_notification(due);
  end loop;
  perform set_config('app.publishing_announcement', 'off', true);
end $$;

revoke execute on function public.publish_scheduled_announcements() from public, anon, authenticated;

-- Published = not a draft and its time has come. Everyone (also logged out) reads those;
-- admin/staff also see drafts and scheduled posts.
drop policy if exists "Logged-in users can read announcements" on public.announcements;
drop policy if exists "Logged-in users read published announcements" on public.announcements;
drop policy if exists "Anyone reads published announcements" on public.announcements;
create policy "Anyone reads published announcements"
  on public.announcements for select to anon, authenticated
  using ((not is_draft and publish_at <= now()) or public.get_my_role() in ('admin', 'staff'));

-- ---------------------------------------------------------------------------
-- 3. Reactions
-- ---------------------------------------------------------------------------
create table if not exists public.announcement_reactions (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('hype', 'gg', 'heart')),
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id, reaction)
);

create index if not exists announcement_reactions_user_idx on public.announcement_reactions (user_id);

alter table public.announcement_reactions enable row level security;

-- Who reacted stays private: users only see their own rows (totals come from the function)
drop policy if exists "Users read own reactions" on public.announcement_reactions;
create policy "Users read own reactions"
  on public.announcement_reactions for select to authenticated
  using (user_id = auth.uid());

-- Only on published announcements (the subquery runs with the user's RLS, which hides drafts)
drop policy if exists "Users add own reactions" on public.announcement_reactions;
create policy "Users add own reactions"
  on public.announcement_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.announcements a
      where a.id = announcement_id and not a.is_draft and a.publish_at <= now()
    )
  );

drop policy if exists "Users remove own reactions" on public.announcement_reactions;
create policy "Users remove own reactions"
  on public.announcement_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Totals per announcement (+ the caller's own reactions), for up to 100 visible announcements
create or replace function public.get_announcement_reactions(p_ids uuid[])
returns table (announcement_id uuid, hype integer, gg integer, heart integer, mine text[])
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
    count(*) filter (where r.reaction = 'hype')::integer,
    count(*) filter (where r.reaction = 'gg')::integer,
    count(*) filter (where r.reaction = 'heart')::integer,
    coalesce(array_agg(r.reaction order by r.reaction) filter (where r.user_id = auth.uid()), '{}')
  from public.announcements a
  left join public.announcement_reactions r on r.announcement_id = a.id
  where a.id = any (p_ids[1:100])
    and ((not a.is_draft and a.publish_at <= now()) or public.get_my_role() in ('admin', 'staff'))
  group by a.id
$$;

revoke execute on function public.get_announcement_reactions(uuid[]) from public;
grant execute on function public.get_announcement_reactions(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Read state (NEW badge for logged-in users)
-- ---------------------------------------------------------------------------
create table if not exists public.announcement_reads (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create index if not exists announcement_reads_announcement_idx on public.announcement_reads (announcement_id);

alter table public.announcement_reads enable row level security;

drop policy if exists "Users read own announcement reads" on public.announcement_reads;
create policy "Users read own announcement reads"
  on public.announcement_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users add own announcement reads" on public.announcement_reads;
create policy "Users add own announcement reads"
  on public.announcement_reads for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users remove own announcement reads" on public.announcement_reads;
create policy "Users remove own announcement reads"
  on public.announcement_reads for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Linked mini cards: only the public details. An announcement with a tournament but no
--    link shows that tournament. Teams appear by name (+ public logo address) only; streams
--    by title and status only (watching needs the tournament page or a login).
-- ---------------------------------------------------------------------------
create or replace function public.get_announcement_links(p_ids uuid[])
returns table (announcement_id uuid, link jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select a.id,
      coalesce(a.linked_type, case when a.tournament_id is not null then 'tournament' end) as kind,
      coalesce(a.linked_id, a.tournament_id) as target
    from public.announcements a
    where a.id = any (p_ids[1:100])
      and ((not a.is_draft and a.publish_at <= now()) or public.get_my_role() in ('admin', 'staff'))
      and (a.linked_type is not null or a.tournament_id is not null)
  )
  select v.id,
    case v.kind
      when 'tournament' then (
        select jsonb_build_object(
          'type', 'tournament', 'id', t.id, 'name', t.name, 'game', t.game, 'game_id', t.game_id,
          'start_date', t.start_date, 'end_date', t.end_date,
          'registration_deadline', t.registration_deadline, 'status', t.status,
          'max_participants', t.max_participants,
          'registered', (select count(*) from public.tournament_registrations r
                         where r.tournament_id = t.id and r.status in ('pending', 'approved')))
        from public.tournaments t where t.id = v.target)
      when 'match' then (
        select jsonb_build_object(
          'type', 'match', 'id', m.id, 'tournament_id', t.id, 'tournament_name', t.name,
          'game', t.game, 'game_id', t.game_id, 'round', m.round, 'match_number', m.match_number,
          'status', m.status, 'scheduled_at', m.scheduled_at, 'score_a', m.score_a, 'score_b', m.score_b,
          'is_forfeit', m.is_forfeit,
          'winner', case when m.winner_team_id is null then null
                         when m.winner_team_id = m.team_a_id then 'a' else 'b' end,
          'team_a', case when ta.id is null then null else jsonb_build_object('name', ta.name, 'logo_url', ta.logo_url) end,
          'team_b', case when tb.id is null then null else jsonb_build_object('name', tb.name, 'logo_url', tb.logo_url) end)
        from public.matches m
        join public.tournaments t on t.id = m.tournament_id
        left join public.teams ta on ta.id = m.team_a_id
        left join public.teams tb on tb.id = m.team_b_id
        where m.id = v.target)
      when 'stream' then (
        select jsonb_build_object(
          'type', 'stream', 'id', s.id, 'title', s.title, 'status', s.status,
          'tournament_id', t.id, 'tournament_name', t.name, 'game_id', t.game_id, 'match_id', s.match_id)
        from public.streams s
        join public.tournaments t on t.id = s.tournament_id
        where s.id = v.target)
      when 'event' then (
        select jsonb_build_object(
          'type', 'event', 'id', e.id, 'title', e.title, 'event_date', e.event_date, 'venue', e.venue,
          'image_path', e.image_path, 'tournament_id', e.tournament_id)
        from public.events e
        where e.id = v.target and e.is_published)
    end
  from visible v
$$;

revoke execute on function public.get_announcement_links(uuid[]) from public;
grant execute on function public.get_announcement_links(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Realtime (RLS applies: logged-out viewers only receive published rows)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

commit;
