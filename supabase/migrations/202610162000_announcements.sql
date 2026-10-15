-- Announcements (Module 3: Event Information and Announcements)
-- - General announcements, or announcements for one tournament.
-- - Logged-in users read them; only admins (Organizing Committee) post, edit and delete.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  -- Empty = general announcement. Deleting the tournament deletes its announcements.
  tournament_id uuid references public.tournaments (id) on delete cascade,
  -- Pinned announcements are shown first
  pinned boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Used by the tournament page to find its announcements
create index announcements_tournament_idx on public.announcements (tournament_id);

alter table public.announcements enable row level security;

create policy "Logged-in users can read announcements"
  on public.announcements for select
  to authenticated
  using (true);

create policy "Admins can post announcements"
  on public.announcements for insert
  to authenticated
  with check (public.get_my_role() = 'admin' and created_by = auth.uid());

create policy "Admins can edit announcements"
  on public.announcements for update
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "Admins can delete announcements"
  on public.announcements for delete
  to authenticated
  using (public.get_my_role() = 'admin');

-- Keep updated_at current, so the app can show "edited".
create or replace function public.touch_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- The author and post date stay as they were
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end $$;

create trigger announcements_touch
  before update on public.announcements
  for each row execute function public.touch_announcement();

commit;
