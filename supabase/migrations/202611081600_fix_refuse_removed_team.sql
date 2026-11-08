-- Fix: refuse_removed_team() (202611081000_team_removal) broke every insert into team_members.
--
-- The old version tested `tg_table_name = 'tournament_registrations' and new.status not in (...)`
-- in one condition. PL/pgSQL doesn't skip the second half when the first is false: it resolves
-- new.status for every table, and team_members has no status column, so the trigger raised
-- `record "new" has no field "status"` on every new team member. That blocked creating a team
-- (the captain row), accepting an invite or a join request, and restoring a team.
--
-- The new version only reads new.status inside a branch that runs for tournament_registrations.
-- Same behaviour otherwise: inserts for a removed team are refused; cancelling a registration of
-- a removed team stays allowed.
--
-- Run in the Supabase SQL Editor after 202611081500_comments_moderation.sql.

begin;

create or replace function public.refuse_removed_team()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Registrations: only becoming pending/approved matters (cancelling must stay possible).
  -- Nested so new.status is only read on tournament_registrations, which has that column.
  if tg_table_name = 'tournament_registrations' then
    if new.status not in ('pending', 'approved') then
      return new;
    end if;
  end if;

  if exists (select 1 from public.teams where id = new.team_id and is_removed) then
    raise exception 'This team was removed by the organizers.';
  end if;
  return new;
end $$;

commit;
