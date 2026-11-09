import GameBadge, { type GameBadgeSize } from '@/components/GameBadge';

// The square game icon for small spaces (team card badges, registration cards, lists, pickers).
// Kept for the existing callers; it is components/GameBadge.tsx with variant="icon" (11.4).
export default function GameIcon({
  name, gameId, size = 'sm', className = '',
}: { name?: string | null; gameId?: string | null; size?: GameBadgeSize; className?: string }) {
  return <GameBadge game={gameId} name={name} variant="icon" size={size} className={className} />;
}
