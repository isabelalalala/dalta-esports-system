import { afterEach, describe, expect, it, vi } from 'vitest';
import { commentsPerMinute, hypeLevel, hypeScore, positiveShare, throttleTrailing } from '@/utils/live-sentiment';

const recent = (total: number, positive: number, neutral: number, negative: number, minutes = 5) =>
  ({ total, positive, neutral, negative, minutes });

describe('hypeScore', () => {
  it('is 0 for a silent chat', () => {
    expect(hypeScore(recent(0, 0, 0, 0))).toBe(0);
  });

  it('is 100 for a full, all-positive chat', () => {
    // 100 comments in 5 minutes = 20 per minute = full intensity
    expect(hypeScore(recent(100, 100, 0, 0))).toBe(100);
    // busier than full still caps at 100
    expect(hypeScore(recent(300, 300, 0, 0))).toBe(100);
  });

  it('is 0 for a full chat that is all negative', () => {
    expect(hypeScore(recent(100, 0, 0, 100))).toBe(0);
  });

  it('scales with how busy the chat is', () => {
    // 10 per minute (half intensity), all positive
    expect(hypeScore(recent(50, 50, 0, 0))).toBe(50);
    // half intensity, balanced mood (net 0 -> mood 0.5)
    expect(hypeScore(recent(50, 20, 10, 20))).toBe(25);
  });

  it('treats a busy chat with nothing analysed yet as neutral mood', () => {
    expect(hypeScore(recent(100, 0, 0, 0))).toBe(50);
  });

  it('does not divide by zero for a zero-minute window', () => {
    expect(hypeScore(recent(10, 10, 0, 0, 0))).toBe(50);
  });
});

describe('hypeLevel', () => {
  it('maps the score to the four labels', () => {
    expect(hypeLevel(0)).toBe('cold');
    expect(hypeLevel(24)).toBe('cold');
    expect(hypeLevel(25)).toBe('warming');
    expect(hypeLevel(50)).toBe('hyped');
    expect(hypeLevel(74)).toBe('hyped');
    expect(hypeLevel(75)).toBe('fire');
    expect(hypeLevel(100)).toBe('fire');
  });
});

describe('small stats', () => {
  it('computes comments per minute and the positive share', () => {
    expect(commentsPerMinute({ total: 21, minutes: 5 })).toBe(4.2);
    expect(commentsPerMinute({ total: 3, minutes: 0 })).toBe(0);
    expect(positiveShare({ total: 10, positive: 3, neutral: 1, negative: 0 })).toBe(75);
    expect(positiveShare({ total: 4, positive: 0, neutral: 0, negative: 0 })).toBeNull();
  });
});

describe('throttleTrailing', () => {
  afterEach(() => vi.useRealTimers());

  it('runs once per window, and always within the window of the first call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttleTrailing(fn, 5000);
    // A steady stream of calls every second for 12 seconds
    for (let i = 0; i < 12; i++) {
      t.call();
      vi.advanceTimersByTime(1000);
    }
    // A debounce would still be at 0 calls; the throttle ran right away and then every 5 s
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
    t.cancel();
  });
});
