import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  defaultParticipants,
  getTournamentStatus,
  isBye,
  participantRangeLabel,
  roundLabel,
  toDateInput,
  validateParticipants,
  validateTournamentDates,
} from '@/utils/tournaments';

afterEach(() => {
  vi.useRealTimers();
});

// Tests freeze "today" at 2026-10-20 (local time).
function freezeToday() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20));
}

describe('toDateInput', () => {
  it('keeps the YYYY-MM-DD part of a full timestamp', () => {
    expect(toDateInput('2026-10-19T00:00:00+00:00')).toBe('2026-10-19');
  });
  it('returns empty for missing dates', () => {
    expect(toDateInput(null)).toBe('');
    expect(toDateInput(undefined)).toBe('');
  });
});

describe('validateTournamentDates', () => {
  it('rejects a registration deadline after the start date', () => {
    expect(validateTournamentDates('2026-10-20', '2026-10-25', '2026-10-21'))
      .toContain('deadline');
  });
  it('rejects an end date before the start date', () => {
    expect(validateTournamentDates('2026-10-20', '2026-10-19', '2026-10-18'))
      .toContain('end date');
  });
  it('accepts valid dates', () => {
    expect(validateTournamentDates('2026-10-20', '2026-10-25', '2026-10-19')).toBe('');
  });
});

describe('getTournamentStatus', () => {
  const base = {
    status: 'upcoming' as const,
    start_date: '2026-10-22',
    end_date: '2026-10-25',
    registration_deadline: '2026-10-21',
  };

  it('cancelled wins over every date', () => {
    freezeToday();
    expect(getTournamentStatus({ ...base, status: 'cancelled' })).toBe('cancelled');
  });
  it('is completed once the end date passes', () => {
    freezeToday();
    expect(getTournamentStatus({ ...base, start_date: '2026-10-15', end_date: '2026-10-19' }))
      .toBe('completed');
  });
  it('is upcoming while today is before the deadline and start', () => {
    freezeToday();
    expect(getTournamentStatus(base)).toBe('upcoming');
  });
  it('is registration_closed after the deadline but before the start', () => {
    freezeToday();
    expect(getTournamentStatus({ ...base, registration_deadline: '2026-10-19' }))
      .toBe('registration_closed');
  });
  it('falls back to the start date when there is no deadline', () => {
    freezeToday();
    expect(getTournamentStatus({ ...base, registration_deadline: '', start_date: '2026-10-26' }))
      .toBe('upcoming');
  });
  it('is ongoing once the start date passes but the end has not', () => {
    freezeToday();
    expect(getTournamentStatus({ ...base, start_date: '2026-10-19', registration_deadline: '2026-10-15' }))
      .toBe('ongoing');
  });
  it('treats the deadline day itself as still open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21)); // == deadline
    expect(getTournamentStatus(base)).toBe('upcoming');
  });
});

describe('roundLabel', () => {
  it('names the last three rounds', () => {
    expect(roundLabel(3, 3)).toBe('Final');
    expect(roundLabel(2, 3)).toBe('Semifinals');
    expect(roundLabel(1, 3)).toBe('Quarterfinals');
  });
  it('numbers earlier rounds', () => {
    expect(roundLabel(1, 5)).toBe('Round 1');
    expect(roundLabel(2, 5)).toBe('Round 2');
  });
});

describe('isBye', () => {
  it('is a round-1 match missing a team', () => {
    expect(isBye({ round: 1, team_a_id: 'a', team_b_id: null })).toBe(true);
    expect(isBye({ round: 1, team_a_id: null, team_b_id: 'b' })).toBe(true);
  });
  it('is not a bye with both teams or in later rounds', () => {
    expect(isBye({ round: 1, team_a_id: 'a', team_b_id: 'b' })).toBe(false);
    expect(isBye({ round: 2, team_a_id: 'a', team_b_id: null })).toBe(false);
  });
});

// Same ranges as migration 202610251000_participant_limits
const mlbb = { name: 'MLBB', min_players: 5, max_players: 6, min_participants: 4, max_participants: 64 };
const valorant = { name: 'Valorant', min_players: 5, max_players: 6, min_participants: 4, max_participants: 32 };
const tekken = { name: 'Tekken 8', min_players: 1, max_players: 1, min_participants: 8, max_participants: 128 };

describe('validateParticipants', () => {
  it('accepts values inside the game range, including the ends', () => {
    expect(validateParticipants(mlbb, '4')).toBe('');
    expect(validateParticipants(mlbb, '64')).toBe('');
    expect(validateParticipants(tekken, '128')).toBe('');
  });
  it('refuses values outside the range, naming teams or players', () => {
    expect(validateParticipants(mlbb, '3')).toBe('MLBB tournaments must allow between 4 and 64 teams.');
    expect(validateParticipants(valorant, '33')).toMatch(/between 4 and 32 teams/);
    expect(validateParticipants(tekken, '4')).toBe('Tekken 8 tournaments must allow between 8 and 128 players.');
  });
  it('refuses empty and non-whole numbers', () => {
    expect(validateParticipants(mlbb, '')).toMatch(/whole number/);
    expect(validateParticipants(mlbb, '12.5')).toMatch(/whole number/);
  });
});

describe('participant range helpers', () => {
  it('suggests 16 teams or 32 players, inside the range', () => {
    expect(defaultParticipants(mlbb)).toBe(16);
    expect(defaultParticipants(tekken)).toBe(32);
    expect(defaultParticipants({ ...mlbb, min_participants: 20 })).toBe(20);
  });
  it('labels the range', () => {
    expect(participantRangeLabel(mlbb)).toBe('Allowed: 4–64 teams');
    expect(participantRangeLabel(tekken)).toBe('Allowed: 8–128 players');
  });
});
