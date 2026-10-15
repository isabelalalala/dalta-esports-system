// Match check-in window, the same rule as the database (check_in_match()):
// opens `minutes` before scheduled_at and closes at scheduled_at. The database decides;
// these helpers only decide what to show.

export type CheckinState =
  | 'off'        // the tournament has no check-in
  | 'no_time'    // the match has no time yet
  | 'not_open'   // before the window
  | 'open'
  | 'closed';    // the match time has passed

export function getCheckinWindow(scheduledAt: string | null, minutes: number) {
  if (!scheduledAt || minutes <= 0) return null;
  const closesAt = new Date(scheduledAt).getTime();
  return { opensAt: closesAt - minutes * 60_000, closesAt };
}

export function getCheckinState(scheduledAt: string | null, minutes: number, now: number): CheckinState {
  if (minutes <= 0) return 'off';
  const window = getCheckinWindow(scheduledAt, minutes);
  if (!window) return 'no_time';
  if (now < window.opensAt) return 'not_open';
  if (now < window.closesAt) return 'open';
  return 'closed';
}

// "in 12 min", "in 2 h 5 min", "in 3 d"
export function formatCountdown(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `in ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  return `in ${Math.floor(hours / 24)} d`;
}
