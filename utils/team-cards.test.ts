import { describe, expect, it } from 'vitest';
import { joinAction, lookingForText, parseLookingFor, teamBadges, teamSlots } from '@/utils/team-cards';
import type { GameProfileSchema } from '@/utils/game-profiles';

const schema: GameProfileSchema = {
  fields: [
    { key: 'role', label: 'Role', type: 'select', maps_to: 'role', options: [{ id: 'ctrl', label: 'Controller' }, { id: 'duel', label: 'Duelist' }] },
    { key: 'rank', label: 'Rank', type: 'select', maps_to: 'rank', options: [{ id: 'gold', label: 'Gold' }, { id: 'dia', label: 'Diamond' }] },
  ],
};

const team = { recruiting: true, member_count: 3, max_players: 6, is_member: false, my_request: null, game_id: 'valorant' };
const player = { isPlayer: true, profileGameIds: ['valorant'], myGameIds: [] as string[] };

describe('parseLookingFor', () => {
  it('reads valid data and ignores junk', () => {
    expect(parseLookingFor({ roles: ['a', 1, 'b'], rank_min: 'gold' })).toEqual({ roles: ['a', 'b'], rank_min: 'gold' });
    expect(parseLookingFor(null)).toEqual({ roles: [], rank_min: null });
    expect(parseLookingFor([])).toEqual({ roles: [], rank_min: null });
  });
});

describe('lookingForText', () => {
  it('joins role labels and the minimum rank', () => {
    expect(lookingForText(schema, { roles: ['ctrl'], rank_min: 'dia' })).toBe('Controller · Diamond+');
    expect(lookingForText(schema, { roles: ['gone'] })).toBe('');
    expect(lookingForText(schema, {})).toBe('');
  });
});

describe('teamSlots', () => {
  it('shows filled slots or Solo player', () => {
    expect(teamSlots(5, 6)).toMatchObject({ label: '5/6', full: false, solo: false });
    expect(teamSlots(6, 6).full).toBe(true);
    expect(teamSlots(1, 1)).toMatchObject({ label: 'Solo player', solo: true });
  });
});

describe('teamBadges', () => {
  it('recruiting, full, yours', () => {
    expect(teamBadges(team)).toEqual(['recruiting']);
    expect(teamBadges({ ...team, member_count: 6 })).toEqual(['full']);
    expect(teamBadges({ ...team, is_member: true, recruiting: false })).toEqual(['yours']);
    // Solo teams are never "Full" or recruiting
    expect(teamBadges({ ...team, member_count: 1, max_players: 1 })).toEqual([]);
  });
});

describe('joinAction', () => {
  it('only offers Request to Join when every rule passes', () => {
    expect(joinAction(team, player)).toBe('request');
    expect(joinAction({ ...team, is_member: true }, player)).toBe('member');
    expect(joinAction({ ...team, my_request: 'pending' }, player)).toBe('requested');
    expect(joinAction({ ...team, member_count: 6 }, player)).toBe('full');
    expect(joinAction(team, { ...player, profileGameIds: [] })).toBe('no-profile');
    expect(joinAction(team, { ...player, myGameIds: ['valorant'] })).toBeNull();
    expect(joinAction({ ...team, recruiting: false }, player)).toBeNull();
    // Spectators and organizers: View Team only
    expect(joinAction(team, { ...player, isPlayer: false })).toBeNull();
  });
});
