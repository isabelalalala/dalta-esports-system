import type { Game, Tournament } from '@/utils/types';

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
  upcoming: 'bg-gold/15 text-gold border-gold/50',
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
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
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

// The moment registration closes: the end of the deadline day (or the start date when there is no
// deadline) in Philippine time, as an ISO string for <Countdown>. '' when neither date is set.
export function registrationClosesAt(t: Pick<Tournament, 'start_date' | 'registration_deadline'>) {
  const day = toDateInput(t.registration_deadline) || toDateInput(t.start_date);
  if (!day) return '';
  return new Date(new Date(`${day}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
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

// What a tournament of this game counts: players for solo games (Tekken 8), else teams
export function participantUnit(game: Pick<Game, 'max_players'>) {
  return game.max_players === 1 ? 'players' : 'teams';
}

// "Allowed: 4-64 teams" hint under the Max Participants field
export function participantRangeLabel(game: Pick<Game, 'min_participants' | 'max_participants' | 'max_players'>) {
  return `Allowed: ${game.min_participants}–${game.max_participants} ${participantUnit(game)}`;
}

// A bracket-friendly starting value when a game is picked: 16 (32 for solo games),
// kept inside the game's range
export function defaultParticipants(game: Pick<Game, 'min_participants' | 'max_participants' | 'max_players'>) {
  const preferred = game.max_players === 1 ? 32 : 16;
  return Math.min(Math.max(preferred, game.min_participants), game.max_participants);
}

// Checks Max Participants against the game's range (games.min_participants/max_participants).
// Returns an error message, or '' if it's fine. The database trigger
// check_tournament_participants() enforces the same rule.
export function validateParticipants(
  game: Pick<Game, 'name' | 'min_participants' | 'max_participants' | 'max_players'>,
  value: string,
) {
  const count = Number(value);
  if (!value.trim() || !Number.isInteger(count)) {
    return 'Enter the maximum number of participants as a whole number.';
  }
  if (count < game.min_participants || count > game.max_participants) {
    return `${game.name} tournaments must allow between ${game.min_participants} and ${game.max_participants} ${participantUnit(game)}.`;
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

// Every real moment (match times, posted at, submitted at) is shown the same way, in Philippine
// time, whatever the viewer's device or the server clock says: "Nov 9, 2026 · 7:00 PM".
// (DALTA's players and audience are in the Philippines; UTC+8, no daylight saving.)
export const PH_TIME_ZONE = 'Asia/Manila';
const phDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: PH_TIME_ZONE });
const phTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: PH_TIME_ZONE });
const phShortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: PH_TIME_ZONE });

// "Nov 9, 2026 · 7:00 PM" (Philippine time unless another zone is given)
export function formatDateTime(value: string | Date | null | undefined, timeZone: string = PH_TIME_ZONE) {
  if (!value) return 'Time TBD';
  const date = new Date(value);
  if (timeZone === PH_TIME_ZONE) return `${phDate.format(date)} · ${phTime.format(date)}`;
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(date);
  return `${day} · ${time}`;
}

// "Nov 9, 2026" for a moment (e.g. joined on), in Philippine time
export function formatMomentDate(value: string | Date | null | undefined) {
  return value ? phDate.format(new Date(value)) : '—';
}

// "7:00 PM", or "Nov 9 · 7:00 PM" with withDay
export function formatTime(value: string | number | Date, withDay = false) {
  const date = new Date(value);
  return withDay ? `${phShortDate.format(date)} · ${phTime.format(date)}` : phTime.format(date);
}
