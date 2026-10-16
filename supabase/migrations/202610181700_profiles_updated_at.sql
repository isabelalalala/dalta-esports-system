-- profiles.updated_at existed in the types, docs and admin UI (the row key that
-- resets the edit form after a save) but was created by no migration and bumped
-- by no trigger. Adds the column (backfilled from created_at) and the same
-- touch_updated_at() trigger tournaments got in 202610181200.

begin;

alter table public.profiles add column if not exists updated_at timestamptz;
update public.profiles set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.profiles alter column updated_at set not null;
alter table public.profiles alter column updated_at set default now();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

commit;
