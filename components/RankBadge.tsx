import { rankTone } from '@/utils/game-profiles';

// A player's rank as a colored text badge ("Gold 2"): neutral for low ranks, gold in the middle,
// maroon for the top of the list (utils/game-profiles.ts rankTone). No official rank icons.
// position/count come from the game's ordered rank list; old free-text ranks have none (neutral).
export default function RankBadge({
  rank, position, count, className = '',
}: { rank: string | null | undefined; position?: number | null; count?: number | null; className?: string }) {
  if (!rank) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide whitespace-nowrap ${rankTone(position, count)} ${className}`}
      title={position && count ? `Rank ${position} of ${count} in this game's ladder` : undefined}
    >
      {rank}
    </span>
  );
}
