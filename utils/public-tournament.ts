// Data for the public tournament pages (/t/[id]), server only. Comes from get_public_tournament(),
// which returns team NAMES only (see migration 202610171800_public_tournaments).
import { cache } from 'react';
import { createPublicClient } from '@/utils/supabase/public';
import type { Match, Tournament } from '@/utils/types';

export interface PublicTournament {
  tournament: Pick<
    Tournament,
    'id' | 'name' | 'description' | 'rules' | 'game' | 'game_id' | 'status' | 'start_date' | 'end_date'
    | 'registration_deadline' | 'max_participants' | 'requires_verification'
  >;
  teams: { id: string; name: string }[];
  approved_count: number;
  matches: Match[];
  live_streams: { id: string; title: string; facebook_url: string; match_id: string | null }[];
}

// cache(): generateMetadata, the page and the image ask for the same tournament in one request;
// this makes that a single database call. Not 'use cache': scores should be current.
export const getPublicTournament = cache(async (id: string): Promise<PublicTournament | null> => {
  // Not a uuid -> not found (instead of a database error)
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createPublicClient().rpc('get_public_tournament', { p_tournament_id: id });
  if (error || !data) return null;
  return data as PublicTournament;
});

// Team id -> name, for the bracket and schedule
export function teamNameMap(data: PublicTournament) {
  return Object.fromEntries(data.teams.map((t) => [t.id, t.name])) as Record<string, string>;
}
