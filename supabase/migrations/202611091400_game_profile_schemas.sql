-- Phase 8: game-specific fields on game profiles
--
-- 1. games.profile_schema (jsonb): each game's form, edited by admins on /admin/games through
--    update_game_profile_schema(). Shape (checked by that function):
--      { "fields": [ { "key", "label", "type": text|number|select|multiselect, "required"?,
--                      "options"?: [ { "id", "label", "sub"? } ], "max"?, "min"?, "max_length"?,
--                      "pattern"?, "pattern_hint"?, "help"?, "maps_to"?: ign|rank|role } ] }
--    Option ids never change (saved profiles store ids), labels can be renamed. A select option
--    may carry a "sub" field (Tier 1-3, Division IV-I, Stars...), stored as "<key>_sub"; options
--    without one (Radiant, Master+) have no sub value. Rank lists are ordered lowest -> highest.
-- 2. player_game_profiles.details (jsonb): the player's values for that game's fields.
--    ign / rank / in_game_role stay as normal columns (filled in by the trigger from details), so
--    rosters, exports and search keep working.
-- 3. check_game_profile() trigger: the server-side validation. Same rules as utils/game-profiles.ts.
--    Profiles saved before this migration (details = {}) keep their free-text rank and role until
--    the player saves them again with the new form.
-- 4. search_players() gains role and rank-range filters; get_team_roster() and
--    get_team_join_requests() return the rank's position in its list (for the colored badge).
--
-- No new table, so no new RLS policies: games stays readable by anyone and writable only through
-- update_game_profile_schema() (admin); player_game_profiles keeps its policies (own rows).
-- Run in the Supabase SQL Editor.

begin;

alter table public.games
  add column if not exists profile_schema jsonb not null default '{"fields": []}'::jsonb;

alter table public.player_game_profiles
  add column if not exists details jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Helpers (read the schema; used by the trigger, the search and the roster functions)
-- ---------------------------------------------------------------------------

-- The field that fills a column ('ign', 'rank' or 'role'), or null
create or replace function public.game_profile_field(p_schema jsonb, p_maps_to text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select f from jsonb_array_elements(coalesce(p_schema -> 'fields', '[]'::jsonb)) f
  where f ->> 'maps_to' = p_maps_to
  limit 1
$$;

-- An option of a select field by id, or null
create or replace function public.game_profile_option(p_field jsonb, p_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select o from jsonb_array_elements(coalesce(p_field -> 'options', '[]'::jsonb)) o
  where o ->> 'id' = p_id
  limit 1
$$;

-- Position (1 = lowest) of the profile's rank in its game's rank list, or null when unranked
create or replace function public.game_profile_rank_position(p_game_id text, p_details jsonb)
returns int
language sql
stable
set search_path = ''
as $$
  select o.pos::int
  from public.games g
  cross join lateral (select public.game_profile_field(g.profile_schema, 'rank') as f) rf
  cross join lateral jsonb_array_elements(coalesce(rf.f -> 'options', '[]'::jsonb)) with ordinality as o(opt, pos)
  where g.id = p_game_id and o.opt ->> 'id' = p_details ->> (rf.f ->> 'key')
$$;

-- How many ranks the game's list has (for the badge color)
create or replace function public.game_profile_rank_count(p_game_id text)
returns int
language sql
stable
set search_path = ''
as $$
  select jsonb_array_length(coalesce(public.game_profile_field(g.profile_schema, 'rank') -> 'options', '[]'::jsonb))
  from public.games g where g.id = p_game_id
$$;

-- Position of a rank id in a game's list (for the rank-range filter)
create or replace function public.game_rank_id_position(p_game_id text, p_rank_id text)
returns int
language sql
stable
set search_path = ''
as $$
  select o.pos::int
  from public.games g
  cross join lateral jsonb_array_elements(
    coalesce(public.game_profile_field(g.profile_schema, 'rank') -> 'options', '[]'::jsonb)
  ) with ordinality as o(opt, pos)
  where g.id = p_game_id and o.opt ->> 'id' = p_rank_id
$$;

-- Display text of a select value incl. its sub value: "Gold 2", "Mythic 25★", "Radiant".
-- Unknown ids (an option an admin removed) give null.
create or replace function public.game_profile_select_label(p_field jsonb, p_details jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  opt jsonb;
  sub jsonb;
  sub_value jsonb;
  sub_opt jsonb;
begin
  if p_field is null then return null; end if;
  opt := public.game_profile_option(p_field, p_details ->> (p_field ->> 'key'));
  if opt is null then return null; end if;
  sub := opt -> 'sub';
  sub_value := p_details -> ((p_field ->> 'key') || '_sub');
  if sub is null or sub_value is null then return opt ->> 'label'; end if;
  if sub ->> 'type' = 'number' then
    return (opt ->> 'label') || ' ' || (sub_value #>> '{}') || coalesce(sub ->> 'suffix', '');
  end if;
  sub_opt := public.game_profile_option(sub, sub_value #>> '{}');
  return (opt ->> 'label') || coalesce(' ' || (sub_opt ->> 'label'), '');
end $$;


-- ---------------------------------------------------------------------------
-- check_game_profile(): validates details against the game's schema and fills in
-- ign / rank / in_game_role. Error messages are shown in the form as they are.
-- ---------------------------------------------------------------------------
create or replace function public.check_game_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  game_schema jsonb;
  game_name text;
  f jsonb;
  k text;
  label text;
  v jsonb;
  s text;
  n numeric;
  opt jsonb;
  sub jsonb;
  sv jsonb;
  clean jsonb := '{}'::jsonb;
  item jsonb;
  ids text[];
begin
  select g.profile_schema, g.name into game_schema, game_name from public.games g where g.id = new.game_id;

  -- An admin changed the lists (update_game_profile_schema): only refresh the labels, keep the
  -- old text when an option was removed
  if tg_op = 'UPDATE' and current_setting('app.relabeling_game_profiles', true) = 'on' then
    new.rank := coalesce(public.game_profile_select_label(public.game_profile_field(game_schema, 'rank'), new.details), new.rank);
    new.in_game_role := coalesce(public.game_profile_select_label(public.game_profile_field(game_schema, 'role'), new.details), new.in_game_role);
    return new;
  end if;

  -- Nothing about the game-specific values changed (e.g. a profile saved before this migration)
  if tg_op = 'UPDATE' and new.details is not distinct from old.details and new.game_id = old.game_id then
    -- ign / rank / role come from details: they can't be typed in directly
    if (new.ign, new.rank, new.in_game_role) is distinct from (old.ign, old.rank, old.in_game_role) then
      raise exception 'Please save your % profile with the profile form.', game_name;
    end if;
    return new;
  end if;

  if jsonb_array_length(coalesce(game_schema -> 'fields', '[]'::jsonb)) = 0 then
    raise exception '% has no profile form yet. Please try again later.', game_name;
  end if;
  if jsonb_typeof(new.details) <> 'object' then
    raise exception 'The % profile details are not valid.', game_name;
  end if;

  -- No fields from another game (or made-up ones)
  for k in select jsonb_object_keys(new.details) loop
    if not exists (
      select 1 from jsonb_array_elements(game_schema -> 'fields') x
      where x ->> 'key' = k or (x ->> 'type' = 'select' and (x ->> 'key') || '_sub' = k)
    ) then
      raise exception '"%" is not a % profile field.', k, game_name;
    end if;
  end loop;

  for f in select x from jsonb_array_elements(game_schema -> 'fields') x loop
    k := f ->> 'key';
    label := f ->> 'label';
    v := new.details -> k;

    -- Empty: null, blank text or an empty list
    if v is null or jsonb_typeof(v) = 'null'
       or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '')
       or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0) then
      if coalesce((f ->> 'required')::boolean, false) then
        raise exception '%: % is required.', game_name, label;
      end if;
      continue;
    end if;

    case f ->> 'type'
    when 'text' then
      if jsonb_typeof(v) <> 'string' then raise exception '%: % must be text.', game_name, label; end if;
      s := trim(v #>> '{}');
      if length(s) > coalesce((f ->> 'max_length')::int, 60) then
        raise exception '%: % is too long (at most % characters).', game_name, label, coalesce((f ->> 'max_length')::int, 60);
      end if;
      if f ? 'pattern' and s !~ (f ->> 'pattern') then
        raise exception '%: %. %', game_name, label, coalesce(f ->> 'pattern_hint', 'The format is not valid.');
      end if;
      clean := clean || jsonb_build_object(k, s);

    when 'number' then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
        raise exception '%: % must be a whole number.', game_name, label;
      end if;
      n := (v #>> '{}')::numeric;
      if (f ? 'min' and n < (f ->> 'min')::numeric) or (f ? 'max' and n > (f ->> 'max')::numeric) then
        raise exception '%: % must be between % and %.', game_name, label, coalesce(f ->> 'min', '0'), coalesce(f ->> 'max', 'any');
      end if;
      clean := clean || jsonb_build_object(k, n);

    when 'select' then
      if jsonb_typeof(v) <> 'string' then raise exception '%: choose a % from the list.', game_name, label; end if;
      opt := public.game_profile_option(f, v #>> '{}');
      if opt is null then
        raise exception '%: "%" is not a % option. Choose one from the list.', game_name, v #>> '{}', label;
      end if;
      clean := clean || jsonb_build_object(k, v #>> '{}');
      sub := opt -> 'sub';
      if sub is not null then
        sv := new.details -> (k || '_sub');
        if sv is null or jsonb_typeof(sv) = 'null' or (jsonb_typeof(sv) = 'string' and trim(sv #>> '{}') = '') then
          raise exception '%: choose a % for %.', game_name, lower(sub ->> 'label'), opt ->> 'label';
        end if;
        if sub ->> 'type' = 'number' then
          if jsonb_typeof(sv) <> 'number' or (sv #>> '{}')::numeric <> trunc((sv #>> '{}')::numeric)
             or (sub ? 'min' and (sv #>> '{}')::numeric < (sub ->> 'min')::numeric)
             or (sub ? 'max' and (sv #>> '{}')::numeric > (sub ->> 'max')::numeric) then
            raise exception '%: % must be a whole number between % and %.', game_name, sub ->> 'label',
              coalesce(sub ->> 'min', '0'), coalesce(sub ->> 'max', 'any');
          end if;
          clean := clean || jsonb_build_object(k || '_sub', (sv #>> '{}')::numeric);
        else
          if jsonb_typeof(sv) <> 'string' or public.game_profile_option(sub, sv #>> '{}') is null then
            raise exception '%: "%" is not a valid % for %.', game_name, sv #>> '{}', lower(sub ->> 'label'), opt ->> 'label';
          end if;
          clean := clean || jsonb_build_object(k || '_sub', sv #>> '{}');
        end if;
      end if;
      -- An option without a sub field (e.g. Radiant) drops any leftover sub value

    when 'multiselect' then
      if jsonb_typeof(v) <> 'array' then raise exception '%: % must be a list.', game_name, label; end if;
      ids := '{}';
      for item in select e from jsonb_array_elements(v) e loop
        if jsonb_typeof(item) <> 'string' or public.game_profile_option(f, item #>> '{}') is null then
          raise exception '%: "%" is not a % option.', game_name, item #>> '{}', label;
        end if;
        if (item #>> '{}') = any(ids) then
          raise exception '%: % lists "%" twice.', game_name, label, item #>> '{}';
        end if;
        ids := ids || (item #>> '{}');
      end loop;
      if cardinality(ids) > coalesce((f ->> 'max')::int, 99) then
        raise exception '%: choose at most % for %.', game_name, coalesce((f ->> 'max')::int, 99), label;
      end if;
      clean := clean || jsonb_build_object(k, to_jsonb(ids));

    else
      raise exception '%: the field % has an unknown type.', game_name, label;
    end case;
  end loop;

  -- Save the cleaned values (trimmed, sub values only where they belong) and fill in the columns
  new.details := clean;
  new.ign := clean ->> (public.game_profile_field(game_schema, 'ign') ->> 'key');
  new.rank := public.game_profile_select_label(public.game_profile_field(game_schema, 'rank'), clean);
  new.in_game_role := public.game_profile_select_label(public.game_profile_field(game_schema, 'role'), clean);
  if new.ign is null or trim(new.ign) = '' then
    raise exception '%: the in-game name is required.', game_name;
  end if;
  return new;
end $$;

drop trigger if exists check_game_profile on public.player_game_profiles;
create trigger check_game_profile
  before insert or update on public.player_game_profiles
  for each row execute function public.check_game_profile();

-- ---------------------------------------------------------------------------
-- update_game_profile_schema(game, schema): admins edit a game's fields and options
-- (/admin/games). Checks the shape, saves, refreshes the saved rank/role labels, logs it.
-- ---------------------------------------------------------------------------
create or replace function public.update_game_profile_schema(p_game_id text, p_schema jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f jsonb;
  o jsonb;
  sub jsonb;
  keys text[] := '{}';
  maps text[] := '{}';
  opt_ids text[];
  sub_ids text[];
  so jsonb;
  game_name text;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Only admins can edit game profile options.';
  end if;
  select name into game_name from public.games where id = p_game_id;
  if game_name is null then raise exception 'Unknown game.'; end if;

  if jsonb_typeof(p_schema -> 'fields') <> 'array'
     or jsonb_array_length(p_schema -> 'fields') not between 1 and 30 then
    raise exception 'A game needs 1 to 30 fields.';
  end if;

  for f in select x from jsonb_array_elements(p_schema -> 'fields') x loop
    if coalesce(f ->> 'key', '') !~ '^[a-z][a-z0-9_]{0,39}$' or (f ->> 'key') like '%\_sub' then
      raise exception 'Field key "%" is not valid (lowercase letters, numbers and _).', f ->> 'key';
    end if;
    if (f ->> 'key') = any(keys) then raise exception 'Two fields use the key "%".', f ->> 'key'; end if;
    keys := keys || (f ->> 'key');
    if length(trim(coalesce(f ->> 'label', ''))) not between 1 and 60 then
      raise exception 'Every field needs a label (at most 60 characters).';
    end if;
    if coalesce(f ->> 'type', '') not in ('text', 'number', 'select', 'multiselect') then
      raise exception 'Field "%" has an unknown type.', f ->> 'label';
    end if;
    if f ? 'pattern' then
      begin
        perform '' ~ (f ->> 'pattern');
      exception when others then
        raise exception 'The format check of "%" is not a valid pattern.', f ->> 'label';
      end;
    end if;
    if f ? 'maps_to' then
      if (f ->> 'maps_to') not in ('ign', 'rank', 'role') or (f ->> 'maps_to') = any(maps) then
        raise exception 'Field "%": each of in-game name, rank and role can be used by one field only.', f ->> 'label';
      end if;
      maps := maps || (f ->> 'maps_to');
      if (f ->> 'maps_to') = 'ign' and (f ->> 'type' <> 'text' or not coalesce((f ->> 'required')::boolean, false)) then
        raise exception 'The in-game name field must be a required text field.';
      end if;
      if (f ->> 'maps_to') in ('rank', 'role') and f ->> 'type' <> 'select' then
        raise exception 'The rank and role fields must be single-choice lists.';
      end if;
    end if;

    if f ->> 'type' in ('select', 'multiselect') then
      if jsonb_typeof(f -> 'options') <> 'array' or jsonb_array_length(f -> 'options') not between 1 and 400 then
        raise exception 'List "%" needs 1 to 400 options.', f ->> 'label';
      end if;
      opt_ids := '{}';
      for o in select y from jsonb_array_elements(f -> 'options') y loop
        if coalesce(o ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{0,59}$' or (o ->> 'id') = any(opt_ids) then
          raise exception 'List "%": option id "%" is missing, not valid or used twice.', f ->> 'label', o ->> 'id';
        end if;
        opt_ids := opt_ids || (o ->> 'id');
        if length(trim(coalesce(o ->> 'label', ''))) not between 1 and 60 then
          raise exception 'List "%": every option needs a name (at most 60 characters).', f ->> 'label';
        end if;
        sub := o -> 'sub';
        if sub is not null then
          if f ->> 'type' <> 'select' then raise exception 'Only single-choice lists can have tiers.'; end if;
          if length(trim(coalesce(sub ->> 'label', ''))) not between 1 and 30
             or coalesce(sub ->> 'type', '') not in ('select', 'number') then
            raise exception 'The tiers of "%" need a name and a type (list or number).', o ->> 'label';
          end if;
          if sub ->> 'type' = 'select' then
            if jsonb_typeof(sub -> 'options') <> 'array' or jsonb_array_length(sub -> 'options') not between 1 and 20 then
              raise exception 'The tiers of "%" need 1 to 20 options.', o ->> 'label';
            end if;
            sub_ids := '{}';
            for so in select z from jsonb_array_elements(sub -> 'options') z loop
              if coalesce(so ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{0,59}$' or (so ->> 'id') = any(sub_ids)
                 or length(trim(coalesce(so ->> 'label', ''))) not between 1 and 30 then
                raise exception 'A tier option is missing, not valid or used twice.';
              end if;
              sub_ids := sub_ids || (so ->> 'id');
            end loop;
          end if;
        end if;
      end loop;
    end if;
  end loop;

  if not ('ign' = any(maps)) then
    raise exception 'One field must be the in-game name.';
  end if;

  update public.games set profile_schema = p_schema where id = p_game_id;

  -- Renamed options: refresh the rank/role text saved on the profiles (removed options keep their text)
  perform set_config('app.relabeling_game_profiles', 'on', true);
  update public.player_game_profiles set details = details where game_id = p_game_id and details <> '{}'::jsonb;
  perform set_config('app.relabeling_game_profiles', 'off', true);

  perform public.log_activity('game.profile_schema_updated', 'game', null,
    jsonb_build_object('game_name', game_name, 'field_count', jsonb_array_length(p_schema -> 'fields')));
end $$;

revoke execute on function public.update_game_profile_schema(text, jsonb) from public, anon;
grant execute on function public.update_game_profile_schema(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Search, roster and join requests with rank positions (latest versions: 202611081400)
-- ---------------------------------------------------------------------------
drop function if exists public.search_players(text, text);
create function public.search_players(
  p_game_id text,
  p_search text,
  p_role text default null,      -- role option id (the game's "role" field)
  p_rank_min text default null,  -- rank option ids; the range includes both ends
  p_rank_max text default null
)
returns table (
  user_id uuid, full_name text, ign text, in_game_role text, rank text, is_verified boolean, invited boolean,
  avatar_url text, rank_position int, rank_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, gp.ign, gp.in_game_role, gp.rank, p.is_verified,
         exists (
           select 1 from public.team_invites i
           join public.teams t on t.id = i.team_id
           where i.invited_user_id = p.id and i.status = 'pending'
             and t.captain_id = auth.uid() and t.game_id = p_game_id
         ),
         p.avatar_url,
         public.game_profile_rank_position(gp.game_id, gp.details),
         public.game_profile_rank_count(gp.game_id)
  from public.player_game_profiles gp
  join public.profiles p on p.id = gp.user_id
  join public.games g on g.id = gp.game_id
  where gp.game_id = p_game_id
    and p.role = 'player'
    -- caller must captain a team in this game
    and exists (
      select 1 from public.teams t
      where t.captain_id = auth.uid() and t.game_id = p_game_id
    )
    -- skip players already on a team for this game
    and not exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = p.id and t.game_id = p_game_id
    )
    -- match IGN or name (strpos avoids treating % and _ as wildcards)
    and (
      strpos(lower(gp.ign), lower(trim(p_search))) > 0
      or strpos(lower(coalesce(p.full_name, '')), lower(trim(p_search))) > 0
    )
    and (p_role is null or gp.details ->> (public.game_profile_field(g.profile_schema, 'role') ->> 'key') = p_role)
    and (p_rank_min is null or public.game_profile_rank_position(gp.game_id, gp.details)
                                >= public.game_rank_id_position(p_game_id, p_rank_min))
    and (p_rank_max is null or public.game_profile_rank_position(gp.game_id, gp.details)
                                <= public.game_rank_id_position(p_game_id, p_rank_max))
  order by public.game_profile_rank_position(gp.game_id, gp.details) desc nulls last, gp.ign
  limit 20
$$;
revoke execute on function public.search_players(text, text, text, text, text) from public, anon;
grant execute on function public.search_players(text, text, text, text, text) to authenticated;

drop function if exists public.get_team_roster(uuid);
create function public.get_team_roster(p_team_id uuid)
returns table (
  user_id uuid,
  full_name text,
  ign text,
  in_game_role text,
  role text,
  joined_at timestamptz,
  is_verified boolean,
  avatar_url text,
  rank text,
  rank_position int,
  rank_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select tm.user_id, p.full_name, gp.ign, gp.in_game_role, tm.role, tm.joined_at, p.is_verified, p.avatar_url,
         gp.rank, public.game_profile_rank_position(t.game_id, gp.details), public.game_profile_rank_count(t.game_id)
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.profiles p on p.id = tm.user_id
  left join public.player_game_profiles gp
    on gp.user_id = tm.user_id and gp.game_id = t.game_id
  where tm.team_id = p_team_id
  order by tm.role = 'captain' desc, tm.joined_at
$$;
revoke execute on function public.get_team_roster(uuid) from public, anon;
grant execute on function public.get_team_roster(uuid) to authenticated;

drop function if exists public.get_team_join_requests(uuid);
create function public.get_team_join_requests(p_team_id uuid)
returns table (
  request_id uuid, user_id uuid, full_name text, ign text, in_game_role text, rank text,
  is_verified boolean, message text, created_at timestamptz, avatar_url text, rank_position int, rank_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.user_id, p.full_name, gp.ign, gp.in_game_role, gp.rank, p.is_verified,
         r.message, r.created_at, p.avatar_url,
         public.game_profile_rank_position(t.game_id, gp.details), public.game_profile_rank_count(t.game_id)
  from public.team_join_requests r
  join public.teams t on t.id = r.team_id
  join public.profiles p on p.id = r.user_id
  left join public.player_game_profiles gp on gp.user_id = r.user_id and gp.game_id = t.game_id
  where r.team_id = p_team_id and r.status = 'pending'
    and (t.captain_id = auth.uid() or public.get_my_role() in ('admin', 'staff'))
  order by r.created_at
$$;
revoke execute on function public.get_team_join_requests(uuid) from public, anon;
grant execute on function public.get_team_join_requests(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Starting fields and options (admins edit them on /admin/games)
-- ---------------------------------------------------------------------------
update public.games set profile_schema = $schema${
 "fields": [
  {
   "key": "riot_id",
   "label": "Riot ID",
   "type": "text",
   "required": true,
   "maps_to": "ign",
   "max_length": 22,
   "pattern": "^[^#]{3,16}#[A-Za-z0-9]{3,5}$",
   "pattern_hint": "Use the format Name#TAG, e.g. DALTAJett#PH1",
   "help": "Your Riot ID exactly as shown in the Riot Client (Name#TAG)."
  },
  {
   "key": "rank",
   "label": "Rank",
   "type": "select",
   "maps_to": "rank",
   "options": [
    {
     "id": "iron",
     "label": "Iron",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "bronze",
     "label": "Bronze",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "silver",
     "label": "Silver",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "gold",
     "label": "Gold",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "platinum",
     "label": "Platinum",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "diamond",
     "label": "Diamond",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "ascendant",
     "label": "Ascendant",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "immortal",
     "label": "Immortal",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "1",
        "label": "1"
       },
       {
        "id": "2",
        "label": "2"
       },
       {
        "id": "3",
        "label": "3"
       }
      ]
     }
    },
    {
     "id": "radiant",
     "label": "Radiant"
    }
   ]
  },
  {
   "key": "main_role",
   "label": "Main role",
   "type": "select",
   "maps_to": "role",
   "options": [
    {
     "id": "duelist",
     "label": "Duelist"
    },
    {
     "id": "initiator",
     "label": "Initiator"
    },
    {
     "id": "controller",
     "label": "Controller"
    },
    {
     "id": "sentinel",
     "label": "Sentinel"
    }
   ]
  },
  {
   "key": "agents",
   "label": "Main agents",
   "type": "multiselect",
   "max": 3,
   "options": [
    {
     "id": "astra",
     "label": "Astra"
    },
    {
     "id": "breach",
     "label": "Breach"
    },
    {
     "id": "brimstone",
     "label": "Brimstone"
    },
    {
     "id": "chamber",
     "label": "Chamber"
    },
    {
     "id": "clove",
     "label": "Clove"
    },
    {
     "id": "cypher",
     "label": "Cypher"
    },
    {
     "id": "deadlock",
     "label": "Deadlock"
    },
    {
     "id": "fade",
     "label": "Fade"
    },
    {
     "id": "gekko",
     "label": "Gekko"
    },
    {
     "id": "harbor",
     "label": "Harbor"
    },
    {
     "id": "iso",
     "label": "Iso"
    },
    {
     "id": "jett",
     "label": "Jett"
    },
    {
     "id": "kay-o",
     "label": "KAY/O"
    },
    {
     "id": "killjoy",
     "label": "Killjoy"
    },
    {
     "id": "neon",
     "label": "Neon"
    },
    {
     "id": "omen",
     "label": "Omen"
    },
    {
     "id": "phoenix",
     "label": "Phoenix"
    },
    {
     "id": "raze",
     "label": "Raze"
    },
    {
     "id": "reyna",
     "label": "Reyna"
    },
    {
     "id": "sage",
     "label": "Sage"
    },
    {
     "id": "skye",
     "label": "Skye"
    },
    {
     "id": "sova",
     "label": "Sova"
    },
    {
     "id": "tejo",
     "label": "Tejo"
    },
    {
     "id": "viper",
     "label": "Viper"
    },
    {
     "id": "vyse",
     "label": "Vyse"
    },
    {
     "id": "waylay",
     "label": "Waylay"
    },
    {
     "id": "yoru",
     "label": "Yoru"
    }
   ],
   "help": "Up to 3."
  }
 ]
}$schema$::jsonb where id = 'valorant';

update public.games set profile_schema = $schema${
 "fields": [
  {
   "key": "riot_id",
   "label": "Riot ID",
   "type": "text",
   "required": true,
   "maps_to": "ign",
   "max_length": 22,
   "pattern": "^[^#]{3,16}#[A-Za-z0-9]{3,5}$",
   "pattern_hint": "Use the format Name#TAG, e.g. DALTAJett#PH1",
   "help": "Your Riot ID exactly as shown in the Riot Client (Name#TAG)."
  },
  {
   "key": "server",
   "label": "Server",
   "type": "select",
   "options": [
    {
     "id": "sea-southeast-asia",
     "label": "SEA (Southeast Asia)"
    },
    {
     "id": "jp",
     "label": "JP"
    },
    {
     "id": "kr",
     "label": "KR"
    },
    {
     "id": "na",
     "label": "NA"
    },
    {
     "id": "euw",
     "label": "EUW"
    },
    {
     "id": "eune",
     "label": "EUNE"
    },
    {
     "id": "oce",
     "label": "OCE"
    },
    {
     "id": "tw",
     "label": "TW"
    },
    {
     "id": "vn",
     "label": "VN"
    },
    {
     "id": "br",
     "label": "BR"
    },
    {
     "id": "lan",
     "label": "LAN"
    },
    {
     "id": "las",
     "label": "LAS"
    },
    {
     "id": "tr",
     "label": "TR"
    },
    {
     "id": "ru",
     "label": "RU"
    },
    {
     "id": "me",
     "label": "ME"
    }
   ]
  },
  {
   "key": "rank",
   "label": "Rank",
   "type": "select",
   "maps_to": "rank",
   "options": [
    {
     "id": "iron",
     "label": "Iron",
     "sub": {
      "label": "Division",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "bronze",
     "label": "Bronze",
     "sub": {
      "label": "Division",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "silver",
     "label": "Silver",
     "sub": {
      "label": "Division",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "gold",
     "label": "Gold",
     "sub": {
      "label": "Division",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "platinum",
     "label": "Platinum",
     "sub": {
      "label": "Division",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "emerald",
     "label": "Emerald",
     "sub": {
      "label": "Division",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "diamond",
     "label": "Diamond",
     "sub": {
      "label": "Division",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "master",
     "label": "Master"
    },
    {
     "id": "grandmaster",
     "label": "Grandmaster"
    },
    {
     "id": "challenger",
     "label": "Challenger"
    }
   ]
  },
  {
   "key": "primary_role",
   "label": "Primary role",
   "type": "select",
   "maps_to": "role",
   "options": [
    {
     "id": "top",
     "label": "Top"
    },
    {
     "id": "jungle",
     "label": "Jungle"
    },
    {
     "id": "mid",
     "label": "Mid"
    },
    {
     "id": "bot-adc",
     "label": "Bot (ADC)"
    },
    {
     "id": "support",
     "label": "Support"
    }
   ]
  },
  {
   "key": "secondary_role",
   "label": "Secondary role",
   "type": "select",
   "options": [
    {
     "id": "top",
     "label": "Top"
    },
    {
     "id": "jungle",
     "label": "Jungle"
    },
    {
     "id": "mid",
     "label": "Mid"
    },
    {
     "id": "bot-adc",
     "label": "Bot (ADC)"
    },
    {
     "id": "support",
     "label": "Support"
    }
   ]
  },
  {
   "key": "champions",
   "label": "Champion pool",
   "type": "multiselect",
   "max": 5,
   "options": [
    {
     "id": "aatrox",
     "label": "Aatrox"
    },
    {
     "id": "ahri",
     "label": "Ahri"
    },
    {
     "id": "akali",
     "label": "Akali"
    },
    {
     "id": "akshan",
     "label": "Akshan"
    },
    {
     "id": "alistar",
     "label": "Alistar"
    },
    {
     "id": "ambessa",
     "label": "Ambessa"
    },
    {
     "id": "amumu",
     "label": "Amumu"
    },
    {
     "id": "anivia",
     "label": "Anivia"
    },
    {
     "id": "annie",
     "label": "Annie"
    },
    {
     "id": "aphelios",
     "label": "Aphelios"
    },
    {
     "id": "ashe",
     "label": "Ashe"
    },
    {
     "id": "aurelion-sol",
     "label": "Aurelion Sol"
    },
    {
     "id": "aurora",
     "label": "Aurora"
    },
    {
     "id": "azir",
     "label": "Azir"
    },
    {
     "id": "bard",
     "label": "Bard"
    },
    {
     "id": "belveth",
     "label": "Bel'Veth"
    },
    {
     "id": "blitzcrank",
     "label": "Blitzcrank"
    },
    {
     "id": "brand",
     "label": "Brand"
    },
    {
     "id": "braum",
     "label": "Braum"
    },
    {
     "id": "briar",
     "label": "Briar"
    },
    {
     "id": "caitlyn",
     "label": "Caitlyn"
    },
    {
     "id": "camille",
     "label": "Camille"
    },
    {
     "id": "cassiopeia",
     "label": "Cassiopeia"
    },
    {
     "id": "chogath",
     "label": "Cho'Gath"
    },
    {
     "id": "corki",
     "label": "Corki"
    },
    {
     "id": "darius",
     "label": "Darius"
    },
    {
     "id": "diana",
     "label": "Diana"
    },
    {
     "id": "dr-mundo",
     "label": "Dr. Mundo"
    },
    {
     "id": "draven",
     "label": "Draven"
    },
    {
     "id": "ekko",
     "label": "Ekko"
    },
    {
     "id": "elise",
     "label": "Elise"
    },
    {
     "id": "evelynn",
     "label": "Evelynn"
    },
    {
     "id": "ezreal",
     "label": "Ezreal"
    },
    {
     "id": "fiddlesticks",
     "label": "Fiddlesticks"
    },
    {
     "id": "fiora",
     "label": "Fiora"
    },
    {
     "id": "fizz",
     "label": "Fizz"
    },
    {
     "id": "galio",
     "label": "Galio"
    },
    {
     "id": "gangplank",
     "label": "Gangplank"
    },
    {
     "id": "garen",
     "label": "Garen"
    },
    {
     "id": "gnar",
     "label": "Gnar"
    },
    {
     "id": "gragas",
     "label": "Gragas"
    },
    {
     "id": "graves",
     "label": "Graves"
    },
    {
     "id": "gwen",
     "label": "Gwen"
    },
    {
     "id": "hecarim",
     "label": "Hecarim"
    },
    {
     "id": "heimerdinger",
     "label": "Heimerdinger"
    },
    {
     "id": "hwei",
     "label": "Hwei"
    },
    {
     "id": "illaoi",
     "label": "Illaoi"
    },
    {
     "id": "irelia",
     "label": "Irelia"
    },
    {
     "id": "ivern",
     "label": "Ivern"
    },
    {
     "id": "janna",
     "label": "Janna"
    },
    {
     "id": "jarvan-iv",
     "label": "Jarvan IV"
    },
    {
     "id": "jax",
     "label": "Jax"
    },
    {
     "id": "jayce",
     "label": "Jayce"
    },
    {
     "id": "jhin",
     "label": "Jhin"
    },
    {
     "id": "jinx",
     "label": "Jinx"
    },
    {
     "id": "ksante",
     "label": "K'Sante"
    },
    {
     "id": "kaisa",
     "label": "Kai'Sa"
    },
    {
     "id": "kalista",
     "label": "Kalista"
    },
    {
     "id": "karma",
     "label": "Karma"
    },
    {
     "id": "karthus",
     "label": "Karthus"
    },
    {
     "id": "kassadin",
     "label": "Kassadin"
    },
    {
     "id": "katarina",
     "label": "Katarina"
    },
    {
     "id": "kayle",
     "label": "Kayle"
    },
    {
     "id": "kayn",
     "label": "Kayn"
    },
    {
     "id": "kennen",
     "label": "Kennen"
    },
    {
     "id": "khazix",
     "label": "Kha'Zix"
    },
    {
     "id": "kindred",
     "label": "Kindred"
    },
    {
     "id": "kled",
     "label": "Kled"
    },
    {
     "id": "kogmaw",
     "label": "Kog'Maw"
    },
    {
     "id": "leblanc",
     "label": "LeBlanc"
    },
    {
     "id": "lee-sin",
     "label": "Lee Sin"
    },
    {
     "id": "leona",
     "label": "Leona"
    },
    {
     "id": "lillia",
     "label": "Lillia"
    },
    {
     "id": "lissandra",
     "label": "Lissandra"
    },
    {
     "id": "lucian",
     "label": "Lucian"
    },
    {
     "id": "lulu",
     "label": "Lulu"
    },
    {
     "id": "lux",
     "label": "Lux"
    },
    {
     "id": "malphite",
     "label": "Malphite"
    },
    {
     "id": "malzahar",
     "label": "Malzahar"
    },
    {
     "id": "maokai",
     "label": "Maokai"
    },
    {
     "id": "master-yi",
     "label": "Master Yi"
    },
    {
     "id": "mel",
     "label": "Mel"
    },
    {
     "id": "milio",
     "label": "Milio"
    },
    {
     "id": "miss-fortune",
     "label": "Miss Fortune"
    },
    {
     "id": "mordekaiser",
     "label": "Mordekaiser"
    },
    {
     "id": "morgana",
     "label": "Morgana"
    },
    {
     "id": "naafiri",
     "label": "Naafiri"
    },
    {
     "id": "nami",
     "label": "Nami"
    },
    {
     "id": "nasus",
     "label": "Nasus"
    },
    {
     "id": "nautilus",
     "label": "Nautilus"
    },
    {
     "id": "neeko",
     "label": "Neeko"
    },
    {
     "id": "nidalee",
     "label": "Nidalee"
    },
    {
     "id": "nilah",
     "label": "Nilah"
    },
    {
     "id": "nocturne",
     "label": "Nocturne"
    },
    {
     "id": "nunu-and-willump",
     "label": "Nunu & Willump"
    },
    {
     "id": "olaf",
     "label": "Olaf"
    },
    {
     "id": "orianna",
     "label": "Orianna"
    },
    {
     "id": "ornn",
     "label": "Ornn"
    },
    {
     "id": "pantheon",
     "label": "Pantheon"
    },
    {
     "id": "poppy",
     "label": "Poppy"
    },
    {
     "id": "pyke",
     "label": "Pyke"
    },
    {
     "id": "qiyana",
     "label": "Qiyana"
    },
    {
     "id": "quinn",
     "label": "Quinn"
    },
    {
     "id": "rakan",
     "label": "Rakan"
    },
    {
     "id": "rammus",
     "label": "Rammus"
    },
    {
     "id": "reksai",
     "label": "Rek'Sai"
    },
    {
     "id": "rell",
     "label": "Rell"
    },
    {
     "id": "renata-glasc",
     "label": "Renata Glasc"
    },
    {
     "id": "renekton",
     "label": "Renekton"
    },
    {
     "id": "rengar",
     "label": "Rengar"
    },
    {
     "id": "riven",
     "label": "Riven"
    },
    {
     "id": "rumble",
     "label": "Rumble"
    },
    {
     "id": "ryze",
     "label": "Ryze"
    },
    {
     "id": "samira",
     "label": "Samira"
    },
    {
     "id": "sejuani",
     "label": "Sejuani"
    },
    {
     "id": "senna",
     "label": "Senna"
    },
    {
     "id": "seraphine",
     "label": "Seraphine"
    },
    {
     "id": "sett",
     "label": "Sett"
    },
    {
     "id": "shaco",
     "label": "Shaco"
    },
    {
     "id": "shen",
     "label": "Shen"
    },
    {
     "id": "shyvana",
     "label": "Shyvana"
    },
    {
     "id": "singed",
     "label": "Singed"
    },
    {
     "id": "sion",
     "label": "Sion"
    },
    {
     "id": "sivir",
     "label": "Sivir"
    },
    {
     "id": "skarner",
     "label": "Skarner"
    },
    {
     "id": "smolder",
     "label": "Smolder"
    },
    {
     "id": "sona",
     "label": "Sona"
    },
    {
     "id": "soraka",
     "label": "Soraka"
    },
    {
     "id": "swain",
     "label": "Swain"
    },
    {
     "id": "sylas",
     "label": "Sylas"
    },
    {
     "id": "syndra",
     "label": "Syndra"
    },
    {
     "id": "tahm-kench",
     "label": "Tahm Kench"
    },
    {
     "id": "taliyah",
     "label": "Taliyah"
    },
    {
     "id": "talon",
     "label": "Talon"
    },
    {
     "id": "taric",
     "label": "Taric"
    },
    {
     "id": "teemo",
     "label": "Teemo"
    },
    {
     "id": "thresh",
     "label": "Thresh"
    },
    {
     "id": "tristana",
     "label": "Tristana"
    },
    {
     "id": "trundle",
     "label": "Trundle"
    },
    {
     "id": "tryndamere",
     "label": "Tryndamere"
    },
    {
     "id": "twisted-fate",
     "label": "Twisted Fate"
    },
    {
     "id": "twitch",
     "label": "Twitch"
    },
    {
     "id": "udyr",
     "label": "Udyr"
    },
    {
     "id": "urgot",
     "label": "Urgot"
    },
    {
     "id": "varus",
     "label": "Varus"
    },
    {
     "id": "vayne",
     "label": "Vayne"
    },
    {
     "id": "veigar",
     "label": "Veigar"
    },
    {
     "id": "velkoz",
     "label": "Vel'Koz"
    },
    {
     "id": "vex",
     "label": "Vex"
    },
    {
     "id": "vi",
     "label": "Vi"
    },
    {
     "id": "viego",
     "label": "Viego"
    },
    {
     "id": "viktor",
     "label": "Viktor"
    },
    {
     "id": "vladimir",
     "label": "Vladimir"
    },
    {
     "id": "volibear",
     "label": "Volibear"
    },
    {
     "id": "warwick",
     "label": "Warwick"
    },
    {
     "id": "wukong",
     "label": "Wukong"
    },
    {
     "id": "xayah",
     "label": "Xayah"
    },
    {
     "id": "xerath",
     "label": "Xerath"
    },
    {
     "id": "xin-zhao",
     "label": "Xin Zhao"
    },
    {
     "id": "yasuo",
     "label": "Yasuo"
    },
    {
     "id": "yone",
     "label": "Yone"
    },
    {
     "id": "yorick",
     "label": "Yorick"
    },
    {
     "id": "yuumi",
     "label": "Yuumi"
    },
    {
     "id": "zac",
     "label": "Zac"
    },
    {
     "id": "zed",
     "label": "Zed"
    },
    {
     "id": "zeri",
     "label": "Zeri"
    },
    {
     "id": "ziggs",
     "label": "Ziggs"
    },
    {
     "id": "zilean",
     "label": "Zilean"
    },
    {
     "id": "zoe",
     "label": "Zoe"
    },
    {
     "id": "zyra",
     "label": "Zyra"
    }
   ],
   "help": "Up to 5."
  }
 ]
}$schema$::jsonb where id = 'lol';

update public.games set profile_schema = $schema${
 "fields": [
  {
   "key": "ign",
   "label": "IGN",
   "type": "text",
   "required": true,
   "maps_to": "ign",
   "max_length": 30,
   "help": "Your in-game name."
  },
  {
   "key": "user_id",
   "label": "User ID",
   "type": "text",
   "required": true,
   "max_length": 12,
   "pattern": "^[0-9]{5,12}$",
   "pattern_hint": "Numbers only (5 to 12 digits).",
   "help": "Profile → the number under your name."
  },
  {
   "key": "zone_id",
   "label": "Server / Zone ID",
   "type": "text",
   "required": true,
   "max_length": 6,
   "pattern": "^[0-9]{3,6}$",
   "pattern_hint": "Numbers only (3 to 6 digits).",
   "help": "The number in brackets after your User ID."
  },
  {
   "key": "rank",
   "label": "Rank",
   "type": "select",
   "maps_to": "rank",
   "options": [
    {
     "id": "warrior",
     "label": "Warrior",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "elite",
     "label": "Elite",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "master",
     "label": "Master",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "grandmaster",
     "label": "Grandmaster",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "v",
        "label": "V"
       },
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "epic",
     "label": "Epic",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "v",
        "label": "V"
       },
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "legend",
     "label": "Legend",
     "sub": {
      "label": "Tier",
      "type": "select",
      "options": [
       {
        "id": "v",
        "label": "V"
       },
       {
        "id": "iv",
        "label": "IV"
       },
       {
        "id": "iii",
        "label": "III"
       },
       {
        "id": "ii",
        "label": "II"
       },
       {
        "id": "i",
        "label": "I"
       }
      ]
     }
    },
    {
     "id": "mythic",
     "label": "Mythic",
     "sub": {
      "label": "Stars",
      "type": "number",
      "min": 0,
      "max": 9999,
      "suffix": "★"
     }
    },
    {
     "id": "mythical-honor",
     "label": "Mythical Honor",
     "sub": {
      "label": "Stars",
      "type": "number",
      "min": 0,
      "max": 9999,
      "suffix": "★"
     }
    },
    {
     "id": "mythical-glory",
     "label": "Mythical Glory",
     "sub": {
      "label": "Stars",
      "type": "number",
      "min": 0,
      "max": 9999,
      "suffix": "★"
     }
    },
    {
     "id": "mythical-immortal",
     "label": "Mythical Immortal",
     "sub": {
      "label": "Stars",
      "type": "number",
      "min": 0,
      "max": 9999,
      "suffix": "★"
     }
    }
   ]
  },
  {
   "key": "main_role",
   "label": "Main role / lane",
   "type": "select",
   "maps_to": "role",
   "options": [
    {
     "id": "exp-lane",
     "label": "EXP Lane"
    },
    {
     "id": "jungle",
     "label": "Jungle"
    },
    {
     "id": "mid-lane",
     "label": "Mid Lane"
    },
    {
     "id": "gold-lane",
     "label": "Gold Lane"
    },
    {
     "id": "roam",
     "label": "Roam"
    }
   ]
  },
  {
   "key": "heroes",
   "label": "Main heroes",
   "type": "multiselect",
   "max": 3,
   "options": [
    {
     "id": "aamon",
     "label": "Aamon"
    },
    {
     "id": "akai",
     "label": "Akai"
    },
    {
     "id": "aldous",
     "label": "Aldous"
    },
    {
     "id": "alice",
     "label": "Alice"
    },
    {
     "id": "alpha",
     "label": "Alpha"
    },
    {
     "id": "alucard",
     "label": "Alucard"
    },
    {
     "id": "angela",
     "label": "Angela"
    },
    {
     "id": "argus",
     "label": "Argus"
    },
    {
     "id": "arlott",
     "label": "Arlott"
    },
    {
     "id": "atlas",
     "label": "Atlas"
    },
    {
     "id": "aulus",
     "label": "Aulus"
    },
    {
     "id": "aurora",
     "label": "Aurora"
    },
    {
     "id": "badang",
     "label": "Badang"
    },
    {
     "id": "balmond",
     "label": "Balmond"
    },
    {
     "id": "bane",
     "label": "Bane"
    },
    {
     "id": "barats",
     "label": "Barats"
    },
    {
     "id": "baxia",
     "label": "Baxia"
    },
    {
     "id": "beatrix",
     "label": "Beatrix"
    },
    {
     "id": "belerick",
     "label": "Belerick"
    },
    {
     "id": "benedetta",
     "label": "Benedetta"
    },
    {
     "id": "brody",
     "label": "Brody"
    },
    {
     "id": "bruno",
     "label": "Bruno"
    },
    {
     "id": "carmilla",
     "label": "Carmilla"
    },
    {
     "id": "cecilion",
     "label": "Cecilion"
    },
    {
     "id": "change",
     "label": "Chang'e"
    },
    {
     "id": "chip",
     "label": "Chip"
    },
    {
     "id": "chou",
     "label": "Chou"
    },
    {
     "id": "cici",
     "label": "Cici"
    },
    {
     "id": "claude",
     "label": "Claude"
    },
    {
     "id": "clint",
     "label": "Clint"
    },
    {
     "id": "cyclops",
     "label": "Cyclops"
    },
    {
     "id": "diggie",
     "label": "Diggie"
    },
    {
     "id": "dyrroth",
     "label": "Dyrroth"
    },
    {
     "id": "edith",
     "label": "Edith"
    },
    {
     "id": "esmeralda",
     "label": "Esmeralda"
    },
    {
     "id": "estes",
     "label": "Estes"
    },
    {
     "id": "eudora",
     "label": "Eudora"
    },
    {
     "id": "fanny",
     "label": "Fanny"
    },
    {
     "id": "faramis",
     "label": "Faramis"
    },
    {
     "id": "floryn",
     "label": "Floryn"
    },
    {
     "id": "franco",
     "label": "Franco"
    },
    {
     "id": "fredrinn",
     "label": "Fredrinn"
    },
    {
     "id": "freya",
     "label": "Freya"
    },
    {
     "id": "gatotkaca",
     "label": "Gatotkaca"
    },
    {
     "id": "gloo",
     "label": "Gloo"
    },
    {
     "id": "gord",
     "label": "Gord"
    },
    {
     "id": "granger",
     "label": "Granger"
    },
    {
     "id": "grock",
     "label": "Grock"
    },
    {
     "id": "guinevere",
     "label": "Guinevere"
    },
    {
     "id": "gusion",
     "label": "Gusion"
    },
    {
     "id": "hanabi",
     "label": "Hanabi"
    },
    {
     "id": "hanzo",
     "label": "Hanzo"
    },
    {
     "id": "harith",
     "label": "Harith"
    },
    {
     "id": "harley",
     "label": "Harley"
    },
    {
     "id": "hayabusa",
     "label": "Hayabusa"
    },
    {
     "id": "helcurt",
     "label": "Helcurt"
    },
    {
     "id": "hilda",
     "label": "Hilda"
    },
    {
     "id": "hylos",
     "label": "Hylos"
    },
    {
     "id": "irithel",
     "label": "Irithel"
    },
    {
     "id": "ixia",
     "label": "Ixia"
    },
    {
     "id": "jawhead",
     "label": "Jawhead"
    },
    {
     "id": "johnson",
     "label": "Johnson"
    },
    {
     "id": "joy",
     "label": "Joy"
    },
    {
     "id": "julian",
     "label": "Julian"
    },
    {
     "id": "kadita",
     "label": "Kadita"
    },
    {
     "id": "kagura",
     "label": "Kagura"
    },
    {
     "id": "kaja",
     "label": "Kaja"
    },
    {
     "id": "kalea",
     "label": "Kalea"
    },
    {
     "id": "karina",
     "label": "Karina"
    },
    {
     "id": "karrie",
     "label": "Karrie"
    },
    {
     "id": "khaleed",
     "label": "Khaleed"
    },
    {
     "id": "khufra",
     "label": "Khufra"
    },
    {
     "id": "kimmy",
     "label": "Kimmy"
    },
    {
     "id": "lancelot",
     "label": "Lancelot"
    },
    {
     "id": "lapu-lapu",
     "label": "Lapu-Lapu"
    },
    {
     "id": "layla",
     "label": "Layla"
    },
    {
     "id": "leomord",
     "label": "Leomord"
    },
    {
     "id": "lesley",
     "label": "Lesley"
    },
    {
     "id": "ling",
     "label": "Ling"
    },
    {
     "id": "lolita",
     "label": "Lolita"
    },
    {
     "id": "lukas",
     "label": "Lukas"
    },
    {
     "id": "lunox",
     "label": "Lunox"
    },
    {
     "id": "luo-yi",
     "label": "Luo Yi"
    },
    {
     "id": "lylia",
     "label": "Lylia"
    },
    {
     "id": "martis",
     "label": "Martis"
    },
    {
     "id": "masha",
     "label": "Masha"
    },
    {
     "id": "mathilda",
     "label": "Mathilda"
    },
    {
     "id": "melissa",
     "label": "Melissa"
    },
    {
     "id": "minotaur",
     "label": "Minotaur"
    },
    {
     "id": "minsitthar",
     "label": "Minsitthar"
    },
    {
     "id": "miya",
     "label": "Miya"
    },
    {
     "id": "moskov",
     "label": "Moskov"
    },
    {
     "id": "nana",
     "label": "Nana"
    },
    {
     "id": "natalia",
     "label": "Natalia"
    },
    {
     "id": "natan",
     "label": "Natan"
    },
    {
     "id": "novaria",
     "label": "Novaria"
    },
    {
     "id": "obsidia",
     "label": "Obsidia"
    },
    {
     "id": "odette",
     "label": "Odette"
    },
    {
     "id": "paquito",
     "label": "Paquito"
    },
    {
     "id": "pharsa",
     "label": "Pharsa"
    },
    {
     "id": "phoveus",
     "label": "Phoveus"
    },
    {
     "id": "popol-and-kupa",
     "label": "Popol and Kupa"
    },
    {
     "id": "rafaela",
     "label": "Rafaela"
    },
    {
     "id": "roger",
     "label": "Roger"
    },
    {
     "id": "ruby",
     "label": "Ruby"
    },
    {
     "id": "saber",
     "label": "Saber"
    },
    {
     "id": "selena",
     "label": "Selena"
    },
    {
     "id": "silvanna",
     "label": "Silvanna"
    },
    {
     "id": "sun",
     "label": "Sun"
    },
    {
     "id": "suyou",
     "label": "Suyou"
    },
    {
     "id": "terizla",
     "label": "Terizla"
    },
    {
     "id": "thamuz",
     "label": "Thamuz"
    },
    {
     "id": "tigreal",
     "label": "Tigreal"
    },
    {
     "id": "uranus",
     "label": "Uranus"
    },
    {
     "id": "vale",
     "label": "Vale"
    },
    {
     "id": "valentina",
     "label": "Valentina"
    },
    {
     "id": "valir",
     "label": "Valir"
    },
    {
     "id": "vexana",
     "label": "Vexana"
    },
    {
     "id": "wanwan",
     "label": "Wanwan"
    },
    {
     "id": "x-borg",
     "label": "X.Borg"
    },
    {
     "id": "xavier",
     "label": "Xavier"
    },
    {
     "id": "yi-sun-shin",
     "label": "Yi Sun-shin"
    },
    {
     "id": "yin",
     "label": "Yin"
    },
    {
     "id": "yu-zhong",
     "label": "Yu Zhong"
    },
    {
     "id": "yve",
     "label": "Yve"
    },
    {
     "id": "zetian",
     "label": "Zetian"
    },
    {
     "id": "zhask",
     "label": "Zhask"
    },
    {
     "id": "zhuxin",
     "label": "Zhuxin"
    },
    {
     "id": "zilong",
     "label": "Zilong"
    }
   ],
   "help": "Up to 3."
  }
 ]
}$schema$::jsonb where id = 'mlbb';

update public.games set profile_schema = $schema${
 "fields": [
  {
   "key": "ign",
   "label": "IGN",
   "type": "text",
   "required": true,
   "maps_to": "ign",
   "max_length": 30
  },
  {
   "key": "uid",
   "label": "UID",
   "type": "text",
   "required": true,
   "max_length": 20,
   "pattern": "^[0-9]{6,20}$",
   "pattern_hint": "Numbers only (6 to 20 digits).",
   "help": "Profile → UID."
  },
  {
   "key": "mp_rank",
   "label": "Multiplayer rank",
   "type": "select",
   "maps_to": "rank",
   "options": [
    {
     "id": "rookie",
     "label": "Rookie"
    },
    {
     "id": "veteran",
     "label": "Veteran"
    },
    {
     "id": "elite",
     "label": "Elite"
    },
    {
     "id": "pro",
     "label": "Pro"
    },
    {
     "id": "master",
     "label": "Master"
    },
    {
     "id": "grandmaster",
     "label": "Grandmaster"
    },
    {
     "id": "legendary",
     "label": "Legendary"
    }
   ]
  },
  {
   "key": "br_rank",
   "label": "Battle Royale rank",
   "type": "select",
   "options": [
    {
     "id": "rookie",
     "label": "Rookie"
    },
    {
     "id": "veteran",
     "label": "Veteran"
    },
    {
     "id": "elite",
     "label": "Elite"
    },
    {
     "id": "pro",
     "label": "Pro"
    },
    {
     "id": "master",
     "label": "Master"
    },
    {
     "id": "grandmaster",
     "label": "Grandmaster"
    },
    {
     "id": "legendary",
     "label": "Legendary"
    }
   ]
  },
  {
   "key": "mode",
   "label": "Preferred mode",
   "type": "select",
   "options": [
    {
     "id": "multiplayer",
     "label": "Multiplayer"
    },
    {
     "id": "battle-royale",
     "label": "Battle Royale"
    },
    {
     "id": "both",
     "label": "Both"
    }
   ]
  },
  {
   "key": "weapon_class",
   "label": "Main weapon class",
   "type": "select",
   "maps_to": "role",
   "options": [
    {
     "id": "ar",
     "label": "AR"
    },
    {
     "id": "smg",
     "label": "SMG"
    },
    {
     "id": "sniper",
     "label": "Sniper"
    },
    {
     "id": "lmg",
     "label": "LMG"
    },
    {
     "id": "shotgun",
     "label": "Shotgun"
    },
    {
     "id": "marksman",
     "label": "Marksman"
    }
   ]
  }
 ]
}$schema$::jsonb where id = 'codm';

update public.games set profile_schema = $schema${
 "fields": [
  {
   "key": "player_name",
   "label": "Player name",
   "type": "text",
   "required": true,
   "maps_to": "ign",
   "max_length": 30
  },
  {
   "key": "tekken_id",
   "label": "Tekken ID",
   "type": "text",
   "required": true,
   "max_length": 30,
   "help": "As shown on your Tekken 8 player card."
  },
  {
   "key": "platform",
   "label": "Platform",
   "type": "select",
   "required": true,
   "options": [
    {
     "id": "pc-steam",
     "label": "PC (Steam)"
    },
    {
     "id": "ps5",
     "label": "PS5"
    },
    {
     "id": "xbox-series-x-s",
     "label": "Xbox Series X|S"
    }
   ]
  },
  {
   "key": "rank",
   "label": "Rank",
   "type": "select",
   "maps_to": "rank",
   "options": [
    {
     "id": "beginner",
     "label": "Beginner"
    },
    {
     "id": "1st-dan",
     "label": "1st Dan"
    },
    {
     "id": "2nd-dan",
     "label": "2nd Dan"
    },
    {
     "id": "fighter",
     "label": "Fighter"
    },
    {
     "id": "strategist",
     "label": "Strategist"
    },
    {
     "id": "combatant",
     "label": "Combatant"
    },
    {
     "id": "brawler",
     "label": "Brawler"
    },
    {
     "id": "ranger",
     "label": "Ranger"
    },
    {
     "id": "cavalry",
     "label": "Cavalry"
    },
    {
     "id": "warrior",
     "label": "Warrior"
    },
    {
     "id": "assailant",
     "label": "Assailant"
    },
    {
     "id": "dominator",
     "label": "Dominator"
    },
    {
     "id": "vanquisher",
     "label": "Vanquisher"
    },
    {
     "id": "destroyer",
     "label": "Destroyer"
    },
    {
     "id": "eliminator",
     "label": "Eliminator"
    },
    {
     "id": "garyu",
     "label": "Garyu"
    },
    {
     "id": "shinryu",
     "label": "Shinryu"
    },
    {
     "id": "tenryu",
     "label": "Tenryu"
    },
    {
     "id": "mighty-ruler",
     "label": "Mighty Ruler"
    },
    {
     "id": "flame-ruler",
     "label": "Flame Ruler"
    },
    {
     "id": "battle-ruler",
     "label": "Battle Ruler"
    },
    {
     "id": "fujin",
     "label": "Fujin"
    },
    {
     "id": "raijin",
     "label": "Raijin"
    },
    {
     "id": "kishin",
     "label": "Kishin"
    },
    {
     "id": "bushin",
     "label": "Bushin"
    },
    {
     "id": "tekken-king",
     "label": "Tekken King"
    },
    {
     "id": "tekken-emperor",
     "label": "Tekken Emperor"
    },
    {
     "id": "tekken-god",
     "label": "Tekken God"
    },
    {
     "id": "tekken-god-supreme",
     "label": "Tekken God Supreme"
    },
    {
     "id": "god-of-destruction",
     "label": "God of Destruction"
    },
    {
     "id": "god-of-destruction-i",
     "label": "God of Destruction I"
    },
    {
     "id": "god-of-destruction-ii",
     "label": "God of Destruction II"
    },
    {
     "id": "god-of-destruction-iii",
     "label": "God of Destruction III"
    },
    {
     "id": "god-of-destruction-infinity",
     "label": "God of Destruction ∞"
    }
   ]
  },
  {
   "key": "characters",
   "label": "Main characters",
   "type": "multiselect",
   "max": 3,
   "options": [
    {
     "id": "alisa",
     "label": "Alisa"
    },
    {
     "id": "anna",
     "label": "Anna"
    },
    {
     "id": "armor-king",
     "label": "Armor King"
    },
    {
     "id": "asuka",
     "label": "Asuka"
    },
    {
     "id": "azucena",
     "label": "Azucena"
    },
    {
     "id": "bryan",
     "label": "Bryan"
    },
    {
     "id": "claudio",
     "label": "Claudio"
    },
    {
     "id": "clive",
     "label": "Clive"
    },
    {
     "id": "devil-jin",
     "label": "Devil Jin"
    },
    {
     "id": "dragunov",
     "label": "Dragunov"
    },
    {
     "id": "eddy",
     "label": "Eddy"
    },
    {
     "id": "fahkumram",
     "label": "Fahkumram"
    },
    {
     "id": "feng",
     "label": "Feng"
    },
    {
     "id": "heihachi",
     "label": "Heihachi"
    },
    {
     "id": "hwoarang",
     "label": "Hwoarang"
    },
    {
     "id": "jack-8",
     "label": "Jack-8"
    },
    {
     "id": "jin",
     "label": "Jin"
    },
    {
     "id": "jun",
     "label": "Jun"
    },
    {
     "id": "kazuya",
     "label": "Kazuya"
    },
    {
     "id": "king",
     "label": "King"
    },
    {
     "id": "kuma",
     "label": "Kuma"
    },
    {
     "id": "lars",
     "label": "Lars"
    },
    {
     "id": "law",
     "label": "Law"
    },
    {
     "id": "lee",
     "label": "Lee"
    },
    {
     "id": "leo",
     "label": "Leo"
    },
    {
     "id": "leroy",
     "label": "Leroy"
    },
    {
     "id": "lidia",
     "label": "Lidia"
    },
    {
     "id": "lili",
     "label": "Lili"
    },
    {
     "id": "nina",
     "label": "Nina"
    },
    {
     "id": "panda",
     "label": "Panda"
    },
    {
     "id": "paul",
     "label": "Paul"
    },
    {
     "id": "raven",
     "label": "Raven"
    },
    {
     "id": "reina",
     "label": "Reina"
    },
    {
     "id": "shaheen",
     "label": "Shaheen"
    },
    {
     "id": "steve",
     "label": "Steve"
    },
    {
     "id": "victor",
     "label": "Victor"
    },
    {
     "id": "xiaoyu",
     "label": "Xiaoyu"
    },
    {
     "id": "yoshimitsu",
     "label": "Yoshimitsu"
    },
    {
     "id": "zafina",
     "label": "Zafina"
    }
   ],
   "help": "Up to 3."
  }
 ]
}$schema$::jsonb where id = 'tekken8';

commit;
