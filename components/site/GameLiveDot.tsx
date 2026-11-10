'use client';

import Link from 'next/link';
import { useLiveGames } from '@/utils/use-live-games';

// Pulsing red "LIVE" badge in the corner of a homepage game card while that game has a live match.
// It is its own link (a sibling of the card's link, never inside it: links can't be nested) to the
// public match page, which shows the stream.
export default function GameLiveDot({ gameId, gameName }: { gameId: string; gameName: string }) {
  const href = useLiveGames()[gameId];
  if (!href) return null;
  return (
    <Link
      href={href}
      aria-label={`${gameName} match live now: watch`}
      className="absolute top-2 right-2 z-20 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-md hover:bg-red-700"
    >
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 animate-ping motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      Live
    </Link>
  );
}
