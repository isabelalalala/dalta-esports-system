import { describe, expect, it } from 'vitest';
import { countdownParts } from './countdown';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('countdownParts', () => {
  it('shows days and hours when a day or more is left', () => {
    expect(countdownParts(3 * DAY + 4 * HOUR + 10 * MIN)).toEqual([
      { value: 3, label: 'days' }, { value: 4, label: 'hrs' },
    ]);
    expect(countdownParts(DAY + HOUR)).toEqual([{ value: 1, label: 'day' }, { value: 1, label: 'hr' }]);
  });
  it('shows hours and minutes on the last day', () => {
    expect(countdownParts(5 * HOUR + 12 * MIN)).toEqual([{ value: 5, label: 'hrs' }, { value: 12, label: 'min' }]);
  });
  it('rounds the last minute up, never showing 0', () => {
    expect(countdownParts(20_000)).toEqual([{ value: 1, label: 'min' }]);
    expect(countdownParts(8 * MIN)).toEqual([{ value: 8, label: 'min' }]);
  });
});
