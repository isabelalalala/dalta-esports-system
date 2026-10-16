-- Fix: generate_bracket seeded every real round-1 match with
-- team_ids[next_team] and team_ids[next_team + 1] but only advanced next_team
-- by 1 (regression introduced when the function was rewritten in
-- 202610181200). Every non-first real match re-used one team and dropped one
-- team entirely. Byes still consume one slot (next_team + 1); real matches
-- must consume two (next_team + 2), as the original 202610161800 version did.
--
-- Existing brackets were generated with wrong pairings; regenerate them while
-- no real match has started.

begin;

create or replace function public.generate_bracket(p_tournament_id uuid)
returns int  -- number of matches created
language plpgsql
-- Runs with the caller's permissions, so the matches RLS (admin/staff only) applies too.
set search_path = ''
as $$
declare
  team_ids uuid[];
  team_count int;
  bracket_size int := 1;   -- teams rounded up to a power of two
  round_count int := 0;
  first_round_matches int;
  odd_positions int;
  bye_count int;
  matches_in_round int;
  next_id uuid;
  is_bye boolean;
  next_team int := 1;      -- position in team_ids of the next team to place
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only admin and staff can generate brackets.';
  end if;

  -- Lock the tournament so two people can't generate at the same time.
  perform 1 from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'Tournament not found.';
  end if;

  -- Regenerating is only allowed until a real match starts. Byes don't count:
  -- they are "completed" from the start but have only one team.
  if exists (
    select 1 from public.matches
    where tournament_id = p_tournament_id
      and status in ('live', 'completed')
      and team_a_id is not null and team_b_id is not null
  ) then
    raise exception 'A match has already started or finished, so the bracket can''t be regenerated.';
  end if;

  -- Open result submissions would be deleted unreviewed with the old bracket.
  if exists (
    select 1 from public.match_result_submissions s
    join public.matches m on m.id = s.match_id
    where m.tournament_id = p_tournament_id
      and s.status in ('pending', 'confirmed', 'disputed')
  ) then
    raise exception 'Review or reject the open result submissions before regenerating.';
  end if;

  -- Approved teams in random order
  select array_agg(team_id order by random()) into team_ids
  from public.tournament_registrations
  where tournament_id = p_tournament_id
    and status = 'approved'
    and team_id is not null;

  team_count := coalesce(array_length(team_ids, 1), 0);
  if team_count < 2 then
    raise exception 'At least 2 approved teams are needed to generate a bracket (there are %).', team_count;
  end if;

  -- e.g. 6 teams -> bracket of 8 -> 3 rounds, 2 byes
  while bracket_size < team_count loop
    bracket_size := bracket_size * 2;
    round_count := round_count + 1;
  end loop;
  bye_count := bracket_size - team_count;
  first_round_matches := bracket_size / 2;
  odd_positions := (first_round_matches + 1) / 2;

  delete from public.matches where tournament_id = p_tournament_id;

  -- Build from the final backwards, so each match can point at its next match
  -- (match m of round r feeds match ceil(m/2) of round r+1).
  for r in reverse round_count..1 loop
    matches_in_round := bracket_size / (1 << r);

    for m in 1..matches_in_round loop
      if r = round_count then
        next_id := null;  -- the final
      else
        select id into next_id
        from public.matches
        where tournament_id = p_tournament_id and round = r + 1 and match_number = (m + 1) / 2;
      end if;

      if r > 1 then
        -- Later rounds start empty; winners fill them in as matches finish.
        insert into public.matches (tournament_id, round, match_number, next_match_id)
        values (p_tournament_id, r, m, next_id);
      else
        -- Round 1. Byes go on odd-numbered matches first (1, 3, 5, ...), then even ones,
        -- so a team with a bye usually meets the winner of a real match in round 2.
        if m % 2 = 1 then
          is_bye := (m + 1) / 2 <= bye_count;
        else
          is_bye := odd_positions + m / 2 <= bye_count;
        end if;

        if is_bye then
          -- One team, already completed with that team as the winner.
          -- The advance trigger moves it into round 2 straight away.
          insert into public.matches
            (tournament_id, round, match_number, next_match_id, team_a_id, status, winner_team_id)
          values
            (p_tournament_id, 1, m, next_id, team_ids[next_team], 'completed', team_ids[next_team]);
          next_team := next_team + 1;
        else
          insert into public.matches
            (tournament_id, round, match_number, next_match_id, team_a_id, team_b_id)
          values
            (p_tournament_id, 1, m, next_id, team_ids[next_team], team_ids[next_team + 1]);
          next_team := next_team + 2;
        end if;
      end if;
    end loop;
  end loop;

  return bracket_size - 1;
end $$;

commit;
