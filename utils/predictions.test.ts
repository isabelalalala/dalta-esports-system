import { describe, expect, it } from 'vitest';
import { canBePicked, picksOpen, splitPercents, type PickMatch } from '@/utils/predictions';

const future = '2999-10-20T15:00:00Z';
const past = '2020-10-20T15:00:00Z';
const NOW = Date.parse('2026-10-20T00:00:00Z');

function match(overrides: Partial<PickMatch> = {}): PickMatch {
  return {
    id: 'm1',
    round: 2,
    status: 'scheduled',
    scheduled_at: future,
    team_a_id: 'a',
    team_b_id: 'b',
    winner_team_id: null,
    ...overrides,
  };
}

describe('picksOpen', () => {
  it('is closed for anything but scheduled matches', () => {
    expect(picksOpen(match({ status: 'completed' }), NOW)).toBe(false);
    expect(picksOpen(match({ status: 'live' }), NOW)).toBe(false);
  });
  it('needs both teams', () => {
    expect(picksOpen(match({ team_b_id: null }), NOW)).toBe(false);
  });
  it('is open with no scheduled time, closes once the time passes', () => {
    expect(picksOpen(match({ scheduled_at: null }), NOW)).toBe(true);
    expect(picksOpen(match({ scheduled_at: future }), NOW)).toBe(true);
    expect(picksOpen(match({ scheduled_at: past }), NOW)).toBe(false);
  });
});

describe('canBePicked', () => {
  it('allows a normal match', () => {
    expect(canBePicked(match())).toBe(true);
  });
  it('rejects byes and matches without both teams', () => {
    expect(canBePicked(match({ round: 1, team_b_id: null }))).toBe(false);
    expect(canBePicked(match({ team_a_id: null }))).toBe(false);
  });
});

describe('splitPercents', () => {
  it('returns zeros with no picks', () => {
    expect(splitPercents(undefined, 'a', 'b')).toEqual({ total: 0, a: 0, b: 0 });
  });
  it('splits evenly and unevenly, always summing to 100', () => {
    expect(splitPercents({ a: 1, b: 1 }, 'a', 'b')).toEqual({ total: 2, a: 50, b: 50 });
    expect(splitPercents({ a: 3, b: 1 }, 'a', 'b')).toEqual({ total: 4, a: 75, b: 25 });
    const s = splitPercents({ a: 1, b: 2 }, 'a', 'b');
    expect(s.a + s.b).toBe(100);
  });
});
