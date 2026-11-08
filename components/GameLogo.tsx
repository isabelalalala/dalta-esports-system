'use client';

import { useState } from 'react';
import Image from 'next/image';
import { gameInitials, getGameLogo, getGameLogoFit } from '@/utils/game-logos';

interface Props {
  name?: string | null;
  gameId?: string | null;
  // Size and position of the box (`relative` unless this says absolute/fixed), e.g. "w-28 h-28"
  className?: string;
  // Extra classes for the <Image> (object-contain is always on)
  imageClassName?: string;
  // Text size of the initials badge, e.g. "text-sm" for small boxes
  fallbackClassName?: string;
  sizes?: string;
  priority?: boolean;
  // Card stages: the logo is centered at a per-game width (about 60% of the box) so all five
  // logos look the same size despite their different shapes (utils/game-logos.ts getGameLogoFit)
  balanced?: boolean;
}

// A game's logo inside a box the caller sizes. Never blank: without a logo, or when the image
// fails to load, it shows the game's initials ("LOL") instead. Meant for the dark logo stages
// (bg-ink), so the initials are gold.
export default function GameLogo({
  name, gameId, className = '', imageClassName = '', fallbackClassName = 'text-2xl', sizes = '160px', priority,
  balanced = false,
}: Props) {
  const src = getGameLogo(name, gameId);
  const fit = balanced ? getGameLogoFit(name, gameId) : null;
  const [failed, setFailed] = useState(false);
  // The box is `relative` unless the caller positions it (e.g. "absolute inset-0" on a card stage);
  // both classes at once would conflict
  const position = /(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative';

  return (
    <div className={`${position} ${className}`}>
      {src && !failed && fit ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className={`relative max-h-full ${fit}`}>
            <Image
              src={src}
              alt={name || 'Game logo'}
              fill
              sizes={sizes}
              priority={priority}
              onError={() => setFailed(true)}
              className={`object-contain ${imageClassName}`}
            />
          </div>
        </div>
      ) : src && !failed ? (
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
