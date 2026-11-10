'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Gamepad2 } from 'lucide-react';
import { getGameLogo, getGameLogoFit } from '@/utils/game-logos';

interface Props {
  name?: string | null;
  gameId?: string | null;
  // Size and position of the box (`relative` unless this says absolute/fixed), e.g. "w-28 h-28"
  className?: string;
  // Extra classes for the <Image> (object-contain is always on)
  imageClassName?: string;
  // Size of the gamepad fallback icon, e.g. "size-6" for small boxes
  fallbackClassName?: string;
  // Another file of the same logo (the light-background version from components/GameBadge.tsx)
  src?: string;
  sizes?: string;
  priority?: boolean;
  // Card stages: the logo is centered at a per-game width (about 60% of the box) so all five
  // logos look the same size despite their different shapes (utils/game-logos.ts getGameLogoFit)
  balanced?: boolean;
  // The game's name is already written right next to the logo (e.g. under it on the same card):
  // empty alt, so screen readers don't read the name twice
  decorative?: boolean;
}

// A game's wordmark inside a box the caller sizes (used by components/GameBadge.tsx variant="wordmark"
// and the card stages). Never blank or broken: without a logo, or when the image fails to load, it
// shows a neutral gamepad icon (11.4: never colored text like "LOL").
export default function GameLogo({
  name, gameId, className = '', imageClassName = '', fallbackClassName = 'size-[40%]', sizes = '160px', priority, decorative = false,
  balanced = false, src: srcOverride,
}: Props) {
  const src = srcOverride ?? getGameLogo(name, gameId);
  const fit = balanced ? getGameLogoFit(name, gameId) : null;
  const [failed, setFailed] = useState(false);
  // The box is `relative` unless the caller positions it (e.g. "absolute inset-0" on a card stage);
  // both classes at once would conflict
  const position = /(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative';

  return (
    <div className={`${position} ${className}`}>
      {src && !failed && fit ? (
        // Flex, not grid: iOS Safari (also inside the Messenger/Facebook browsers) resolved the
        // percentage width of a centered grid item against its own content, so wide logos grew
        // past the card and were cut off on the right. Padding keeps them off the edges.
        <div className="absolute inset-0 flex items-center justify-center p-[6%]">
          <div className={`relative max-h-full max-w-full ${fit}`}>
            <Image
              src={src}
              alt={decorative ? '' : name || 'Game logo'}
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
          alt={decorative ? '' : name || 'Game logo'}
          fill
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
          className={`object-contain ${imageClassName}`}
        />
      ) : (
        <span role="img" aria-label={name || 'Game'} className="absolute inset-0 grid place-items-center text-stone-400">
          <Gamepad2 className={`max-h-12 max-w-12 ${fallbackClassName}`} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
