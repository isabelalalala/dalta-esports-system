import { describe, expect, it } from 'vitest';
import { buildCalendar, calendarFileName, type CalendarMatch } from '@/utils/ics';

function calendarMatch(overrides: Partial<CalendarMatch> = {}): CalendarMatch {
  return {
    match_id: 'm1',
    tournament_id: 't1',
    tournament_name: 'Smoke Test Cup',
    game: 'Mobile Legends',
    round: 1,
    round_count: 2,
    match_number: 1,
    team_a: 'Alpha',
    team_b: 'Beta',
    scheduled_at: '2026-10-17T07:30:00Z',
    status: 'scheduled',
    score_a: null,
    score_b: null,
    updated_at: '2026-10-16T00:00:00Z',
    calendar_name: 'DALTA Esports',
    ...overrides,
  };
}

describe('calendarFileName', () => {
  it('slugs the tournament name', () => {
    expect(calendarFileName('Mobile Legends: Bang Bang!')).toBe('mobile-legends-bang-bang.ics');
  });
  it('falls back when the name has no usable characters', () => {
    expect(calendarFileName('!!!')).toBe('dalta-esports.ics');
  });
});

describe('buildCalendar', () => {
  it('wraps events in a Manila-timezone VCALENDAR', () => {
    const ics = buildCalendar('Test Cal', [calendarMatch()]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('X-WR-CALNAME:Test Cal');
    expect(ics).toContain('X-WR-TIMEZONE:Asia/Manila');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('converts UTC match times to Manila local (UTC+8)', () => {
    const ics = buildCalendar('C', [calendarMatch()]);
    expect(ics).toContain('DTSTART;TZID=Asia/Manila:20261017T153000');
    // 1-hour matches
    expect(ics).toContain('DTEND;TZID=Asia/Manila:20261017T163000');
  });
  it('keeps a stable UID and a SEQUENCE from updated_at', () => {
    const ics = buildCalendar('C', [calendarMatch()]);
    expect(ics).toContain('UID:match-m1@dalta-esports');
    expect(ics).toMatch(/SEQUENCE:\d+/);
  });
  it('escapes commas, semicolons and backslashes in text fields', () => {
    const ics = buildCalendar('C', [calendarMatch({ tournament_name: 'Cup, 2026; Fall' })]);
    expect(ics).toContain('Cup\\, 2026\\; Fall');
  });
  it('includes the score for completed matches', () => {
    const ics = buildCalendar('C', [calendarMatch({ status: 'completed', score_a: 2, score_b: 1 })]);
    // Unfold continuation lines before checking the content
    expect(ics.replace(/\r\n /g, '')).toContain('Result: 2 - 1');
  });
  it('folds lines longer than 75 bytes', () => {
    const long = buildCalendar('C', [
      calendarMatch({ tournament_name: 'A'.repeat(100) }),
    ]);
    expect(long).toContain('\r\n ');
  });
  it('renders TBD teams', () => {
    const ics = buildCalendar('C', [calendarMatch({ team_a: null, team_b: null })]);
    expect(ics).toContain('TBD vs TBD');
  });
});
