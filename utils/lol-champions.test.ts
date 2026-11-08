import { describe, expect, it } from 'vitest';
import { DRAFT_SLOTS, LOL_CHAMPIONS, toSlots, validateDraft } from '@/utils/lol-champions';

describe('toSlots', () => {
  it('pads to the slot count and cuts extras', () => {
    expect(toSlots(['Ahri'])).toEqual(['Ahri', '', '', '', '']);
    expect(toSlots(undefined)).toHaveLength(DRAFT_SLOTS);
    expect(toSlots(['a', 'b', 'c', 'd', 'e', 'f'])).toHaveLength(DRAFT_SLOTS);
  });
});

describe('validateDraft', () => {
  it('accepts a normal draft and ignores empty slots', () => {
    expect(validateDraft([['Ahri', ''], ['Lee Sin'], ['Jinx'], ['Thresh', '']])).toBe('');
  });
  it('refuses the same champion twice in a game, ignoring case and spaces', () => {
    expect(validateDraft([['Ahri'], [' ahri ']])).toContain('twice');
  });
  it('refuses very long names', () => {
    expect(validateDraft([['x'.repeat(31)]])).toContain('30');
  });
});

describe('LOL_CHAMPIONS', () => {
  it('has no duplicates', () => {
    expect(new Set(LOL_CHAMPIONS).size).toBe(LOL_CHAMPIONS.length);
  });
});
