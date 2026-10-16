import { describe, expect, it } from 'vitest';
import { dateInManila, todayInManila } from './reports';

describe('dateInManila', () => {
  it('keeps the same date when the instant is already mid-day in Manila', () => {
    expect(dateInManila('2026-10-20T06:00:00Z')).toBe('2026-10-20');
  });

  it('rolls to the next day for instants that are still yesterday in UTC', () => {
    expect(dateInManila('2026-10-20T20:00:00Z')).toBe('2026-10-21');
  });

  it('does not roll back for early Manila morning that is the previous UTC day', () => {
    expect(dateInManila('2026-10-20T17:00:00Z')).toBe('2026-10-21');
  });
});

describe('todayInManila', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayInManila()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
