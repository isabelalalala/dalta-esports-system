// Logic for the My Registrations cards (app/registrations/RegistrationCard.tsx): which tab a
// registration belongs to, the "Starts in 15 days" text and the progress steps. Plain code,
// unit-tested in registrations.test.ts. The database decides everything; this only decides what
// to show.
import type { RegistrationStatus } from '@/utils/types';
import type { TournamentDisplayStatus } from '@/utils/tournaments';

export type RegistrationTab = 'upcoming' | 'ongoing' | 'completed';

export const REGISTRATION_TABS: { value: RegistrationTab | 'all'; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];

// Upcoming = registration open or closed but not started; cancelled tournaments count as completed
export function registrationTab(status: TournamentDisplayStatus): RegistrationTab {
  if (status === 'ongoing') return 'ongoing';
  if (status === 'completed' || status === 'cancelled') return 'completed';
  return 'upcoming';
}

// "Starts in 15 days" / "Starts tomorrow" / "Starts today" / "Ongoing" / "Completed" / "Cancelled".
// Dates are calendar days (YYYY-MM-DD); today is the Philippine date.
export function startsInText(status: TournamentDisplayStatus, startDate: string | null | undefined, today: string): string {
  if (status === 'ongoing') return 'Ongoing';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  const start = (startDate ?? '').slice(0, 10);
  if (!start) return 'Start date TBA';
  const days = Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return `Starts in ${days} days`;
}

export const REGISTRATION_STEPS = ['Registered', 'Approved', 'Check-in', 'Playing', 'Finished'] as const;

// Where a registration is on Registered → Approved → Check-in → Playing → Finished.
// current = index of the highlighted step; stopped = rejected or withdrawn (the steps are greyed out).
export function registrationStep(input: {
  status: RegistrationStatus;
  tournamentStatus: TournamentDisplayStatus;
  // The team has a live match / has finished at least one match / still has a match to play
  hasLiveMatch: boolean;
  hasPlayedMatch: boolean;
  hasUpcomingMatch: boolean;
  // The next match's check-in window is open, or the team already checked in for it
  checkInActive: boolean;
}): { current: number; stopped: boolean } {
  if (input.status === 'rejected' || input.status === 'cancelled') return { current: 0, stopped: true };
  if (input.status === 'pending') return { current: 0, stopped: false };
  // Approved from here on
  if (input.tournamentStatus === 'completed' || (input.hasPlayedMatch && !input.hasUpcomingMatch && !input.hasLiveMatch)) {
    return { current: 4, stopped: false };
  }
  if (input.hasLiveMatch || (input.tournamentStatus === 'ongoing' && input.hasPlayedMatch)) return { current: 3, stopped: false };
  if (input.checkInActive) return { current: 2, stopped: false };
  return { current: 1, stopped: false };
}
