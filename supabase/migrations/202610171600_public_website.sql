-- Public website content (editable by admins on /admin/website, no code needed)
-- - site_content: key/value text (hero, About Us, Our Story, Mission, Vision, footer, social links)
-- - hero_images (carousel), campaigns, events, game_divisions, officers,
--   official_teams + official_team_players (the org's showcase teams; not the players' app teams)
-- - Storage bucket "site-images" (public): admins upload; anyone can view.
-- - RLS: everyone (also logged out) reads published content; only admins write.
-- - Seed: the core officers and the 5 divisions from the wireframes, plus DRAFT texts
--   for Our Story / Mission / Vision that an admin should replace.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- Game names are public (the website lists the divisions to logged-out visitors)
drop policy if exists "Anyone can view games" on public.games;
create policy "Anyone can view games"
  on public.games for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- 1. site_content: one row per text on the site. The keys and their labels are
--    listed in utils/site.ts; the admin page only edits those keys.
-- ---------------------------------------------------------------------------
create table public.site_content (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value text not null default '' check (length(value) <= 10000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

create policy "Anyone can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

create policy "Admins add site content"
  on public.site_content for insert
  to authenticated
  with check (public.get_my_role() = 'admin');

create policy "Admins edit site content"
  on public.site_content for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 2. Lists. All have display_order (smaller = first) and most have is_published.
-- ---------------------------------------------------------------------------
create table public.hero_images (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,          -- in the site-images bucket
  caption text not null default '' check (length(caption) <= 200),
  link text check (link is null or link like '/%' or link like 'https://%'),
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 150),
  description text not null default '' check (length(description) <= 5000),
  image_path text,
  event_date date,
  link text check (link is null or link like '/%' or link like 'https://%'),
  display_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 150),
  description text not null default '' check (length(description) <= 5000),
  image_path text,
  event_date date,
  link text check (link is null or link like '/%' or link like 'https://%'),
  -- Optional: the tournament this event is about
  tournament_id uuid references public.tournaments (id) on delete set null,
  display_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- One page per game on /divisions
create table public.game_divisions (
  game_id text primary key references public.games (id) on delete cascade,
  tagline text not null default '' check (length(tagline) <= 200),
  description text not null default '' check (length(description) <= 5000),
  image_path text,
  display_order int not null default 0,
  is_published boolean not null default true
);

create table public.officers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  position text not null default '' check (length(position) <= 120),
  category text not null check (category in ('core_officer', 'division_head', 'coach', 'committee')),
  -- For division heads and coaches
  game_id text references public.games (id) on delete set null,
  photo_path text,
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.official_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  subname text not null default '' check (length(subname) <= 120),
  game_id text not null references public.games (id),
  description text not null default '' check (length(description) <= 5000),
  photo_path text,
  display_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.official_team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.official_teams (id) on delete cascade,
  name text not null default '' check (length(name) <= 120),
  ign text not null check (length(trim(ign)) between 1 and 60),
  role text not null default '' check (length(role) <= 60),   -- in-game role, e.g. "Jungler"
  is_captain boolean not null default false,
  photo_path text,
  display_order int not null default 0
);

-- One captain per official team
create unique index official_team_players_one_captain
  on public.official_team_players (team_id) where is_captain;
create index official_team_players_team_idx on public.official_team_players (team_id);

-- ---------------------------------------------------------------------------
-- 3. RLS: published rows for everyone; everything for admins; only admins write.
--    Logged-out visitors (anon) get a separate policy so get_my_role() isn't needed for them.
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['hero_images', 'campaigns', 'events', 'game_divisions', 'officers', 'official_teams']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format($p$create policy "Anyone can view published items" on public.%I
                     for select to anon using (is_published)$p$, tbl);
    execute format($p$create policy "Users view published items, admins view all" on public.%I
                     for select to authenticated using (is_published or public.get_my_role() = 'admin')$p$, tbl);
    execute format($p$create policy "Admins add items" on public.%I
                     for insert to authenticated with check (public.get_my_role() = 'admin')$p$, tbl);
    execute format($p$create policy "Admins edit items" on public.%I
                     for update to authenticated using (public.get_my_role() = 'admin')
                     with check (public.get_my_role() = 'admin')$p$, tbl);
    execute format($p$create policy "Admins delete items" on public.%I
                     for delete to authenticated using (public.get_my_role() = 'admin')$p$, tbl);
  end loop;
end $$;

-- Players are visible when their team is published
alter table public.official_team_players enable row level security;

create policy "Anyone can view players of published teams"
  on public.official_team_players for select
  to anon
  using (exists (select 1 from public.official_teams t where t.id = team_id and t.is_published));

create policy "Users view players of published teams, admins view all"
  on public.official_team_players for select
  to authenticated
  using (
    public.get_my_role() = 'admin'
    or exists (select 1 from public.official_teams t where t.id = team_id and t.is_published)
  );

create policy "Admins add players"
  on public.official_team_players for insert
  to authenticated
  with check (public.get_my_role() = 'admin');

create policy "Admins edit players"
  on public.official_team_players for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "Admins delete players"
  on public.official_team_players for delete
  to authenticated
  using (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 4. Storage: public bucket "site-images". Anyone can view the files by their public URL;
--    only admins upload, replace and delete. Images only, 5 MB.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins view site images" on storage.objects;
create policy "Admins view site images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'site-images' and public.get_my_role() = 'admin');

drop policy if exists "Admins upload site images" on storage.objects;
create policy "Admins upload site images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-images' and public.get_my_role() = 'admin');

drop policy if exists "Admins replace site images" on storage.objects;
create policy "Admins replace site images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-images' and public.get_my_role() = 'admin')
  with check (bucket_id = 'site-images' and public.get_my_role() = 'admin');

drop policy if exists "Admins delete site images" on storage.objects;
create policy "Admins delete site images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-images' and public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 5. Seed. Texts marked "(draft)" are placeholders for an admin to replace.
-- ---------------------------------------------------------------------------
insert into public.site_content (key, value) values
  ('hero_title', 'DALTA ESPORTS'),
  ('hero_tagline', 'The official esports organization of UPHSD – Molino Campus'),
  ('about_intro', 'DALTA Esports is the official esports organization of the University of Perpetual Help System DALTA – Molino Campus. We bring students together to compete, grow and represent our school in MLBB, Valorant, Tekken 8, League of Legends and CODM.'),
  ('founded', 'February 2025'),
  ('our_story', '(draft) DALTA Esports was founded in February 2025 by students who wanted a home for competitive gaming at UPHSD – Molino. What started as a small group of players has grown into an organization with official teams in five game divisions, competing in the AcadArena South Luzon Esports Conference.'),
  ('mission', '(draft) To give every student gamer at UPHSD – Molino a place to compete, learn and lead, and to run fair, well-organized tournaments for our community.'),
  ('vision', '(draft) To be a leading collegiate esports organization in South Luzon, known for skilled teams, good sportsmanship and responsible gaming.'),
  ('core_belief_title', 'Game With Purpose'),
  ('core_belief_text', '(draft) We play to win, but also to grow: as teammates, as students and as people.'),
  ('footer_tagline', 'Game With Purpose'),
  ('footer_copyright', '© 2026 DALTA Esports'),
  ('social_facebook', ''),
  ('social_instagram', ''),
  ('social_tiktok', ''),
  ('social_youtube', ''),
  ('contact_email', ''),
  ('logo_path', ''),          -- empty = the logo in public/daltaesportslogo.jpg
  ('about_image_path', '')
on conflict (key) do nothing;

insert into public.officers (name, position, category, display_order) values
  ('Izumi Yamamoto', 'Founder / President', 'core_officer', 1),
  ('Sean Jihan Tandoc', 'VP Internal', 'core_officer', 2),
  ('Alexander Jon Solis', 'VP External', 'core_officer', 3);

insert into public.game_divisions (game_id, tagline, description, display_order) values
  ('mlbb',     'Mobile Legends: Bang Bang', '(draft) Our MLBB division competes in 5v5 team tournaments.', 1),
  ('valorant', 'Tactical 5v5 shooter',      '(draft) Our Valorant division competes in 5v5 team tournaments.', 2),
  ('tekken8',  'One-on-one fighting',       '(draft) Our Tekken 8 division competes in solo tournaments.', 3),
  ('lol',      'League of Legends',         '(draft) Our League of Legends division competes in 5v5 team tournaments.', 4),
  ('codm',     'Call of Duty: Mobile',      '(draft) Our CODM division competes in 5v5 team tournaments.', 5)
on conflict (game_id) do nothing;

-- Samples to preview the layout. Unpublished: they don't show on the site until published.
insert into public.campaigns (title, description, display_order, is_published) values
  ('Sample campaign', '(draft) Replace or delete this campaign on /admin/website.', 1, false);
insert into public.events (title, description, display_order, is_published) values
  ('Sample event', '(draft) Replace or delete this event on /admin/website.', 1, false);

commit;
