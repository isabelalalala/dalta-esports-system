import type { Tournament } from '@/utils/types';

// What the app shows. Only 'cancelled' is stored; the rest comes from the dates.
export type TournamentDisplayStatus =
  | 'upcoming'
  | 'registration_closed'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

export const statusLabels: Record<TournamentDisplayStatus, string> = {
  upcoming: 'Upcoming',
  registration_closed: 'Registration Closed',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const statusStyles: Record<TournamentDisplayStatus, string> = {
  upcoming: 'bg-[#00d2ff]/15 text-[#00d2ff] border-[#00d2ff]/50',
  registration_closed: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/50',
  ongoing: 'bg-green-500/15 text-green-300 border-green-500/50',
  completed: 'bg-gray-500/15 text-gray-300 border-gray-500/50',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/50',
};

// The database returns dates like "2026-10-19T00:00:00+00:00", but
// <input type="date"> only accepts "2026-10-19". Dates are saved as plain
// YYYY-MM-DD (stored as midnight UTC), so the first 10 characters are the date.
export function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

// Readable date such as "Oct 19, 2026". Built from the YYYY-MM-DD part so the
// day never shifts because of the viewer's time zone.
export function formatDate(value: string | null | undefined) {
  const date = toDateInput(value);
  if (!date) return '—';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Today as YYYY-MM-DD in the user's local time zone
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// YYYY-MM-DD strings compare correctly as plain text, so no Date objects are needed.
export function getTournamentStatus(
  t: Pick<Tournament, 'status' | 'start_date' | 'end_date' | 'registration_deadline'>
): TournamentDisplayStatus {
  if (t.status === 'cancelled') return 'cancelled';

  const now = today();
  const start = toDateInput(t.start_date);
  const end = toDateInput(t.end_date);
  const deadline = toDateInput(t.registration_deadline) || start;

  if (end && now > end) return 'completed';
  // Same rule the database uses: registration is open until the deadline,
  // and never after the start date.
  if (now <= deadline && (!start || now <= start)) return 'upcoming';
  if (start && now < start) return 'registration_closed';
  return 'ongoing';
}

// Checks the date order. Returns an error message, or '' if the dates are fine.
// The database enforces the same rules.
export function validateTournamentDates(startDate: string, endDate: string, registrationDeadline: string) {
  if (registrationDeadline > startDate) {
    return 'The registration deadline must be on or before the start date.';
  }
  if (endDate < startDate) {
    return 'The end date must be on or after the start date.';
  }
  return '';
}

// "Final", "Semifinals", "Quarterfinals", otherwise "Round 1", "Round 2", ...
export function roundLabel(round: number, roundCount: number) {
  const fromEnd = roundCount - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2) return 'Quarterfinals';
  return `Round ${round}`;
}

// A bye is a round-1 match with only one team; that team advances automatically.
export function isBye(match: { round: number; team_a_id: string | null; team_b_id: string | null }) {
  return match.round === 1 && (match.team_a_id === null || match.team_b_id === null);
}

// <input type="datetime-local"> works in local time without a time zone
// ("2026-10-19T14:30"), while the database stores a full timestamp.
export function toDateTimeInput(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The reverse: a datetime-local value (in the user's time zone) to a timestamp for the database
export function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

// Readable date and time such as "Oct 19, 2026, 2:30 PM" in the viewer's time zone
export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Time TBD';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
