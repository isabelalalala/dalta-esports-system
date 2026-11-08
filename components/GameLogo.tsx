'use client';

import { useState } from 'react';
import Image from 'next/image';
import { gameInitials, getGameLogo } from '@/utils/game-logos';

interface Props {
  name?: string | null;
  gameId?: string | null;
  // Size and position of the box (it is always `relative`), e.g. "w-28 h-28"
  className?: string;
  // Extra classes for the <Image> (object-contain is always on)
  imageClassName?: string;
  // Text size of the initials badge, e.g. "text-sm" for small boxes
  fallbackClassName?: string;
  sizes?: string;
  priority?: boolean;
}

// A game's logo inside a box the caller sizes. Never blank: without a logo, or when the image
// fails to load, it shows the game's initials ("LOL") instead. Meant for the dark logo stages
// (bg-ink), so the initials are gold.
export default function GameLogo({
  name, gameId, className = '', imageClassName = '', fallbackClassName = 'text-2xl', sizes = '160px', priority,
}: Props) {
  const src = getGameLogo(name, gameId);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {src && !failed ? (
        <Image
          src={src}
          alt={name || 'Game logo'}
          fill
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
          className={`object-contain ${imageClassName}`}
        />
      ) : (
        <span
          role="img"
          aria-label={name || 'Game'}
          className={`absolute inset-0 grid place-items-center font-black uppercase tracking-wider text-gold ${fallbackClassName}`}
        >
          {gameInitials(name || gameId)}
        </span>
      )}
    </div>
  );
}
