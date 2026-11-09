import { describe, expect, it } from 'vitest';
import { registrationStep, registrationTab, startsInText } from '@/utils/registrations';

const base = {
  status: 'approved' as const,
  tournamentStatus: 'upcoming' as const,
  hasLiveMatch: false,
  hasPlayedMatch: false,
  hasUpcomingMatch: false,
  checkInActive: false,
};

describe('registrationTab', () => {
  it('groups tournament statuses', () => {
    expect(registrationTab('upcoming')).toBe('upcoming');
    expect(registrationTab('registration_closed')).toBe('upcoming');
    expect(registrationTab('ongoing')).toBe('ongoing');
    expect(registrationTab('completed')).toBe('completed');
    expect(registrationTab('cancelled')).toBe('completed');
  });
});

describe('startsInText', () => {
  it('counts calendar days', () => {
    expect(startsInText('upcoming', '2026-11-24T00:00:00+00:00', '2026-11-09')).toBe('Starts in 15 days');
    expect(startsInText('upcoming', '2026-11-10', '2026-11-09')).toBe('Starts tomorrow');
    expect(startsInText('registration_closed', '2026-11-09', '2026-11-09')).toBe('Starts today');
    expect(startsInText('upcoming', null, '2026-11-09')).toBe('Start date TBA');
    expect(startsInText('ongoing', '2026-11-01', '2026-11-09')).toBe('Ongoing');
    expect(startsInText('completed', '2026-11-01', '2026-11-09')).toBe('Completed');
  });
});

describe('registrationStep', () => {
  it('follows the registration and the team matches', () => {
    expect(registrationStep({ ...base, status: 'pending' })).toEqual({ current: 0, stopped: false });
    expect(registrationStep({ ...base, status: 'rejected' })).toEqual({ current: 0, stopped: true });
    expect(registrationStep({ ...base, status: 'cancelled' }).stopped).toBe(true);
    expect(registrationStep(base).current).toBe(1);
    expect(registrationStep({ ...base, hasUpcomingMatch: true, checkInActive: true }).current).toBe(2);
    expect(registrationStep({ ...base, hasLiveMatch: true }).current).toBe(3);
    expect(registrationStep({ ...base, tournamentStatus: 'ongoing', hasPlayedMatch: true, hasUpcomingMatch: true }).current).toBe(3);
    // Eliminated (or champion): nothing left to play
    expect(registrationStep({ ...base, tournamentStatus: 'ongoing', hasPlayedMatch: true }).current).toBe(4);
    expect(registrationStep({ ...base, tournamentStatus: 'completed' }).current).toBe(4);
  });
});
