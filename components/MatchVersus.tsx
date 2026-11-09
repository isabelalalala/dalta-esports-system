import type { ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import FlipScore from '@/components/FlipScore';

// Shared "Team A vs Team B" pieces for match cards (schedule, My Matches, public tournament page,
// homepage strip), so every match looks like a match: big team names, a gold VS badge or a dark
// scoreboard in the middle, and a red pulsing LIVE tag. Works in server and client components.

// Red "LIVE" tag with a pulsing dot (the pulse is off with reduced motion)
export function LiveTag({ label = 'Live', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xs ${className}`}>
      <span className="relative flex size-1.5" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      {label}
    </span>
  );
}

// Gold "VS" badge between the team names. live = it glows softly.
export function VersusBadge({ live = false, size = 'md' }: { live?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-lg border border-golddark bg-gold font-black italic tracking-tight text-ink shadow-xs -skew-x-6 ${
        size === 'sm' ? 'h-6 px-1.5 text-[10px]' : 'h-8 px-2.5 text-xs'
      } ${live ? 'vs-badge-live' : ''}`}
    >
      <span className="skew-x-6">VS</span>
    </span>
  );
}

// Dark scoreboard "2 : 1". Digits flip when they change while the page is open.
// A finished match saved without scores shows "- : -" (not a misleading 0 : 0).
export function ScoreBoard({
  a, b, forfeit = false, size = 'md', finished = false,
}: { a: number | null | undefined; b: number | null | undefined; forfeit?: boolean; size?: 'sm' | 'md'; finished?: boolean }) {
  const fallback = finished ? '-' : '0';
  if (forfeit) {
    return (
      <span className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-red-700">
        Forfeit
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-lg bg-stone-900 font-black text-gold shadow-xs ${
        size === 'sm' ? 'px-2 py-0.5 text-sm' : 'px-3 py-1 text-base sm:text-lg'
      }`}
      aria-label={a == null && b == null && finished ? 'No score recorded' : `Score ${a ?? 0} to ${b ?? 0}`}
    >
      <FlipScore value={a} fallback={fallback} />
      <span className="px-1.5 text-stone-400" aria-hidden="true">:</span>
      <FlipScore value={b} fallback={fallback} />
    </span>
  );
}

// name | middle | name. Long names are cut with "..." so the middle keeps its place.
// winner = 'a' | 'b' highlights that side (maroon + trophy) and mutes the other.
export function VersusRow({
  teamA, teamB, middle, winner = null, size = 'md',
}: {
  teamA: ReactNode;
  teamB: ReactNode;
  middle: ReactNode;
  winner?: 'a' | 'b' | null;
  size?: 'sm' | 'md';
}) {
  const nameClass = (side: 'a' | 'b') =>
    `min-w-0 truncate uppercase tracking-wide ${size === 'sm' ? 'text-sm' : 'text-sm sm:text-lg'} ${
      winner === side ? 'font-black text-maroon' : winner ? 'font-bold text-stone-500' : 'font-black text-stone-950'
    }`;
  const trophy = <Trophy className="size-4 shrink-0 text-gold drop-shadow-sm" aria-label="Winner" />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        {winner === 'a' && trophy}
        <span className={nameClass('a')}>{teamA}</span>
      </span>
      {middle}
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={nameClass('b')}>{teamB}</span>
        {winner === 'b' && trophy}
      </span>
    </div>
  );
}
