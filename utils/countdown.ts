// Time left until a moment, for components/site/Countdown.tsx (plain code, unit-tested)

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// The two biggest units left: "3 days 4 hrs", "5 hrs 12 min", "8 min"
export function countdownParts(msLeft: number): { value: number; label: string }[] {
  const days = Math.floor(msLeft / DAY);
  const hours = Math.floor((msLeft % DAY) / HOUR);
  const minutes = Math.max(1, Math.ceil((msLeft % HOUR) / MINUTE));
  const unit = (value: number, one: string, many: string) => ({ value, label: value === 1 ? one : many });
  if (days > 0) return [unit(days, 'day', 'days'), unit(hours, 'hr', 'hrs')];
  if (hours > 0) return [unit(hours, 'hr', 'hrs'), unit(Math.floor((msLeft % HOUR) / MINUTE), 'min', 'min')];
  return [unit(minutes, 'min', 'min')];
}
