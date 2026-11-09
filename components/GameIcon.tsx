import Image from 'next/image';
import { gameColorClass, getGameIcon } from '@/utils/game-logos';

const sizes = {
  xs: { box: 'size-6 rounded-md text-[9px]', px: 24 },
  sm: { box: 'size-8 rounded-lg text-[10px]', px: 32 },
  md: { box: 'size-11 rounded-xl text-xs', px: 44 },
  lg: { box: 'size-16 rounded-2xl text-base', px: 64 },
  xl: { box: 'size-20 rounded-2xl text-lg', px: 80 },
} as const;

// The compact, square version of a game's logo for small spaces (team card badges, registration
// cards, lists, pickers), where the wide wordmark would be unreadable. Without an icon file
// (utils/game-logos.ts `icon`) it is a badge with the game's short name ("VAL", "T8") on the game's
// color: plain text, so it stays sharp on every screen. The name is read out for screen readers.
export default function GameIcon({
  name, gameId, size = 'sm', className = '',
}: { name?: string | null; gameId?: string | null; size?: keyof typeof sizes; className?: string }) {
  const { src, short } = getGameIcon(name, gameId);
  const { box, px } = sizes[size];

  if (src) {
    return (
      <span className={`relative inline-flex shrink-0 overflow-hidden ${box} ${className}`}>
        <Image src={src} alt={name || 'Game'} width={px} height={px} sizes={`${px}px`} className="h-full w-full object-contain" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={name || 'Game'}
      title={name || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-black tracking-tight text-white shadow-xs ${gameColorClass(name, gameId)} ${box} ${className}`}
    >
      {short}
    </span>
  );
}
