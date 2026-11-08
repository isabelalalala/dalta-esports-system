-- Phase 2.4.6: League of Legends ban/pick summary per match.
--
-- match_drafts: one row per match and game of the series (game_number 1..7, e.g. three rows for a
-- best-of-3), with each team's bans and picks as champion names. Entered by tournament staff on
-- the match page; shown to everyone on the match pages (live through Realtime).
--
-- Rules (trigger check_match_draft, readable messages):
--   - only for matches of a League of Legends tournament (games.id = 'lol')
--   - at most 5 bans and 5 picks per team; names are trimmed, 1-30 characters, empty ones dropped
--   - a champion can appear only once in a game (not banned twice, not banned and picked)
-- RLS: anyone reads (matches are public too); admin/staff insert, update, delete.
--
-- Run in the Supabase SQL Editor after 202611081200_realtime_teams.sql.

begin;

create table if not exists public.match_drafts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  game_number int not null default 1 check (game_number between 1 and 7),
  team_a_bans text[] not null default '{}',
  team_a_picks text[] not null default '{}',
  team_b_bans text[] not null default '{}',
  team_b_picks text[] not null default '{}',
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, game_number)
);

alter table public.match_drafts enable row level security;

drop policy if exists "Anyone can view match drafts" on public.match_drafts;
create policy "Anyone can view match drafts"
  on public.match_drafts for select
  to anon, authenticated
  using (true);

drop policy if exists "Organizers add match drafts" on public.match_drafts;
create policy "Organizers add match drafts"
  on public.match_drafts for insert
  to authenticated
  with check (public.get_my_role() in ('admin', 'staff'));

drop policy if exists "Organizers edit match drafts" on public.match_drafts;
create policy "Organizers edit match drafts"
  on public.match_drafts for update
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'))
  with check (public.get_my_role() in ('admin', 'staff'));

drop policy if exists "Organizers delete match drafts" on public.match_drafts;
create policy "Organizers delete match drafts"
  on public.match_drafts for delete
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'));

-- Trims names and drops empty ones: {' Ahri ', ''} -> {'Ahri'}
create or replace function public.clean_champion_list(p_names text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(trim(n) order by ord), '{}')
  from unnest(coalesce(p_names, '{}')) with ordinality as u(n, ord)
  where trim(coalesce(n, '')) <> ''
$$;

create or replace function public.check_match_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  game text;
  all_names text[];
begin
  select t.game_id into game
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = new.match_id;

  if game is distinct from 'lol' then
    raise exception 'Ban/pick summaries are only for League of Legends matches.';
  end if;

  new.team_a_bans := public.clean_champion_list(new.team_a_bans);
  new.team_a_picks := public.clean_champion_list(new.team_a_picks);
  new.team_b_bans := public.clean_champion_list(new.team_b_bans);
  new.team_b_picks := public.clean_champion_list(new.team_b_picks);

  if cardinality(new.team_a_bans) > 5 or cardinality(new.team_b_bans) > 5 then
    raise exception 'Each team has at most 5 bans.';
  end if;
  if cardinality(new.team_a_picks) > 5 or cardinality(new.team_b_picks) > 5 then
    raise exception 'Each team has at most 5 picks.';
  end if;

  all_names := new.team_a_bans || new.team_a_picks || new.team_b_bans || new.team_b_picks;
  if exists (select 1 from unnest(all_names) n where char_length(n) > 30) then
    raise exception 'Champion names can be at most 30 characters.';
  end if;
  if (select count(distinct lower(n)) from unnest(all_names) n) <> cardinality(all_names) then
    raise exception 'A champion can only be banned or picked once per game.';
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

drop trigger if exists match_drafts_check on public.match_drafts;
create trigger match_drafts_check
  before insert or update on public.match_drafts
  for each row execute function public.check_match_draft();

-- Live updates on the match pages while staff enter the draft
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_drafts'
  ) then
    alter publication supabase_realtime add table public.match_drafts;
  end if;
end $$;

commit;
