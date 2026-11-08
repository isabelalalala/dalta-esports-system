-- Phase 7: featured event on the homepage + event venue
--
-- events.is_featured: an admin can pin ONE event to the homepage's featured card. Without a pin
--   the homepage features the next published event by date (decided in the app, utils/site.ts
--   pickFeaturedEvent()). Featuring an event un-features the previous one (trigger below), so the
--   admin never gets a "duplicate" error.
-- events.venue: optional place shown on the event cards ("School Covered Court").
--
-- RLS is unchanged: anyone reads published events, admins read and write all
-- (202610171600_public_website). Run in the Supabase SQL Editor.

alter table public.events
  add column if not exists is_featured boolean not null default false,
  add column if not exists venue text check (venue is null or length(trim(venue)) <= 150);

-- At most one featured event (safety net behind the trigger)
create unique index if not exists events_one_featured on public.events ((true)) where is_featured;

-- Featuring an event clears the flag on every other event first
create or replace function public.events_single_featured()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_featured and (tg_op = 'INSERT' or not old.is_featured) then
    update public.events set is_featured = false where is_featured and id <> new.id;
  end if;
  return new;
end $$;

drop trigger if exists events_single_featured on public.events;
create trigger events_single_featured
  before insert or update of is_featured on public.events
  for each row execute function public.events_single_featured();
