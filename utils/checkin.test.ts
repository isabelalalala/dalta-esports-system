import { describe, expect, it } from 'vitest';
import { formatCountdown, getCheckinState, getCheckinWindow } from '@/utils/checkin';

const MATCH = '2026-10-20T15:00:00Z';
const T = Date.parse(MATCH);

describe('getCheckinWindow', () => {
  it('opens `minutes` before the match and closes at match time', () => {
    const w = getCheckinWindow(MATCH, 30)!;
    expect(w.opensAt).toBe(T - 30 * 60_000);
    expect(w.closesAt).toBe(T);
  });
  it('returns null without a time or without check-in', () => {
    expect(getCheckinWindow(null, 30)).toBeNull();
    expect(getCheckinWindow(MATCH, 0)).toBeNull();
  });
});

describe('getCheckinState', () => {
  it('is off when the tournament has no check-in', () => {
    expect(getCheckinState(MATCH, 0, T)).toBe('off');
    expect(getCheckinState(MATCH, -5, T)).toBe('off');
  });
  it('is no_time when the match is unscheduled', () => {
    expect(getCheckinState(null, 30, T)).toBe('no_time');
  });
  it('follows the window boundaries', () => {
    expect(getCheckinState(MATCH, 30, T - 31 * 60_000)).toBe('not_open');
    expect(getCheckinState(MATCH, 30, T - 30 * 60_000)).toBe('open');
    expect(getCheckinState(MATCH, 30, T - 1)).toBe('open');
    expect(getCheckinState(MATCH, 30, T)).toBe('closed');
    expect(getCheckinState(MATCH, 30, T + 60_000)).toBe('closed');
  });
});

describe('formatCountdown', () => {
  it('formats minutes, hours and days', () => {
    expect(formatCountdown(30 * 60_000)).toBe('in 30 min');
    expect(formatCountdown(90 * 60_000)).toBe('in 1 h 30 min');
    expect(formatCountdown(120 * 60_000)).toBe('in 2 h');
    expect(formatCountdown(3 * 24 * 60 * 60_000)).toBe('in 3 d');
  });
  it('floors at zero for past times', () => {
    expect(formatCountdown(-1)).toBe('in 0 min');
  });
});
