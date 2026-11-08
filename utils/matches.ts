import type { createClient } from '@/utils/supabase/client';
import type { Match } from '@/utils/types';

type SupabaseClient = ReturnType<typeof createClient>;

// Team id -> team name for every team that appears in the given matches (one query)
export async function fetchTeamNames(supabase: SupabaseClient, matches: Match[]) {
  const ids = new Set<string>();
  for (const m of matches) {
    if (m.team_a_id) ids.add(m.team_a_id);
    if (m.team_b_id) ids.add(m.team_b_id);
  }
  if (ids.size === 0) return {};

  const { data, error } = await supabase.from('teams').select('id, name, is_removed').in('id', [...ids]);
  if (error) throw error;
  return Object.fromEntries((data || []).map((t) => [t.id, teamLabel(t)])) as Record<string, string>;
}

// A team's name as shown in brackets and match lists: removed teams (202611081000) keep their
// place in past matches, marked so nobody thinks they are still playing.
export function teamLabel(team: { name: string; is_removed?: boolean | null }) {
  return team.is_removed ? `${team.name} (removed)` : team.name;
}

// Tournament id -> number of rounds (the highest round is the final), for roundLabel()
export async function fetchRoundCounts(supabase: SupabaseClient, tournamentIds: string[]) {
  if (tournamentIds.length === 0) return {};

  // One head-row query per tournament instead of pulling every match row
  const counts: Record<string, number> = {};
  await Promise.all(tournamentIds.map(async (tournamentId) => {
    const { data, error } = await supabase
      .from('matches')
      .select('round')
      .eq('tournament_id', tournamentId)
      .order('round', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    counts[tournamentId] = data?.round ?? 0;
  }));
  return counts;
}
