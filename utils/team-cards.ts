// Logic for the team cards (components/TeamCard.tsx): slots, badges, the join button and the
// "Looking for" line. Plain code (unit-tested in team-cards.test.ts); the database checks the same
// join rules again (team_join_requests trigger), this only decides what to show.
import { fieldFor, optionOf, type GameProfileSchema } from '@/utils/game-profiles';

// What a recruiting team needs (teams.looking_for, 202611091800): role option ids + a minimum rank id
export interface LookingFor {
  roles: string[];
  rank_min: string | null;
}

// Reads teams.looking_for safely (anything malformed = nothing)
export function parseLookingFor(value: unknown): LookingFor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { roles: [], rank_min: null };
  const v = value as { roles?: unknown; rank_min?: unknown };
  const roles = Array.isArray(v.roles) ? v.roles.filter((r): r is string => typeof r === 'string').slice(0, 3) : [];
  const rank = typeof v.rank_min === 'string' && v.rank_min !== '' ? v.rank_min : null;
  return { roles, rank_min: rank };
}

// "Controller · Duelist · Diamond+" from the game's profile form; '' when nothing is set (or the
// options were removed by an admin since)
export function lookingForText(schema: GameProfileSchema, value: unknown): string {
  const lf = parseLookingFor(value);
  const roleField = fieldFor(schema, 'role');
  const rankField = fieldFor(schema, 'rank');
  const parts = lf.roles.map((id) => optionOf(roleField, id)?.label).filter((l): l is string => Boolean(l));
  const rank = lf.rank_min ? optionOf(rankField, lf.rank_min)?.label : null;
  if (rank) parts.push(`${rank}+`);
  return parts.join(' · ');
}

// Roster slots: "5/6" and a fill fraction, or a solo game (one player per team, e.g. Tekken 8)
export function teamSlots(memberCount: number, maxPlayers: number) {
  const solo = maxPlayers <= 1;
  const max = Math.max(maxPlayers, 1);
  return {
    solo,
    full: memberCount >= max,
    label: solo ? 'Solo player' : `${memberCount}/${max}`,
    fraction: Math.min(memberCount / max, 1),
  };
}

export type TeamBadge = 'recruiting' | 'full' | 'yours';

// Status badges, in display order. A solo team is never shown as "Full" (it is always one player).
export function teamBadges(t: { recruiting: boolean; member_count: number; max_players: number; is_member: boolean }): TeamBadge[] {
  const slots = teamSlots(t.member_count, t.max_players);
  const badges: TeamBadge[] = [];
  if (t.is_member) badges.push('yours');
  if (!slots.solo && slots.full) badges.push('full');
  else if (t.recruiting && !slots.solo) badges.push('recruiting');
  return badges;
}

// The join button on a card:
// 'request'   = "Request to Join" (player, recruiting, not full, not a member, has a game profile,
//               not already on a team for that game)
// 'requested' = an open request (can be cancelled), 'member' = on this team, 'full' = roster full
// 'no-profile'= needs a game profile for that game first
// null        = nothing (spectators, organizers, not recruiting, already on another team for the game)
export type JoinAction = 'request' | 'requested' | 'member' | 'full' | 'no-profile' | null;

export function joinAction(
  t: { recruiting: boolean; member_count: number; max_players: number; is_member: boolean; my_request: string | null; game_id: string },
  viewer: { isPlayer: boolean; profileGameIds: string[]; myGameIds: string[] },
): JoinAction {
  if (t.is_member) return 'member';
  if (!viewer.isPlayer || !t.recruiting) return null;
  if (t.my_request) return 'requested';
  if (teamSlots(t.member_count, t.max_players).full) return 'full';
  if (viewer.myGameIds.includes(t.game_id)) return null;
  if (!viewer.profileGameIds.includes(t.game_id)) return 'no-profile';
  return 'request';
}

export type TeamSort = 'newest' | 'name' | 'members' | 'recruiting';
export const TEAM_SORTS: { value: TeamSort; label: string }[] = [
  { value: 'recruiting', label: 'Recruiting first' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'members', label: 'Most members' },
];
