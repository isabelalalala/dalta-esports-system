// Pick'em predictions: shared types and rules (the database enforces the same rules).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Match } from '@/utils/types';
import { isBye } from '@/utils/tournaments';

// The match fields the picker needs
export type PickMatch = Pick<Match, 'id' | 'round' | 'status' | 'scheduled_at' | 'team_a_id' | 'team_b_id' | 'winner_team_id'>;

// matchId -> teamId -> number of picks
export type Splits = Record<string, Record<string, number>>;

// A row of the user's own predictions
export interface MyPrediction {
  id: string;
  match_id: string;
  predicted_winner_team_id: string;
  is_correct: boolean | null;
}

export interface LeaderboardRow {
  rank: number;
  display_name: string;   // "first name + initial", e.g. "Juan C."
  correct: number;
  decided: number;        // picks whose match has a winner
  total: number;
  is_me: boolean;
}

// Picks lock when the match goes live or its scheduled time passes (same rule as check_prediction()).
// `now` is passed in (ms) so components can refresh it on a timer.
export function picksOpen(match: PickMatch, now: number) {
  if (match.status !== 'scheduled') return false;
  if (match.team_a_id === null || match.team_b_id === null) return false;
  return !match.scheduled_at || new Date(match.scheduled_at).getTime() > now;
}

// Byes and matches without both teams can't be picked at all
export function canBePicked(match: PickMatch) {
  return !isBye(match) && match.team_a_id !== null && match.team_b_id !== null;
}

// Totals only (anyone, also logged out, may call get_prediction_split)
export async function fetchSplits(supabase: SupabaseClient, matchIds: string[]): Promise<Splits> {
  if (matchIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_prediction_split', { p_match_ids: matchIds });
  if (error) throw error;
  const splits: Splits = {};
  for (const row of (data || []) as { match_id: string; team_id: string; picks: number }[]) {
    splits[row.match_id] = { ...splits[row.match_id], [row.team_id]: Number(row.picks) };
  }
  return splits;
}

// "62%" / "38%" for team A and B (rounded so they add up to 100)
export function splitPercents(split: Record<string, number> | undefined, teamA: string, teamB: string) {
  const a = split?.[teamA] ?? 0;
  const b = split?.[teamB] ?? 0;
  const total = a + b;
  if (total === 0) return { total: 0, a: 0, b: 0 };
  const pa = Math.round((a / total) * 100);
  return { total, a: pa, b: 100 - pa };
}
