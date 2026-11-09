'use client';

import { useState } from 'react';
import Image from 'next/image';
import { initialsOf } from '@/utils/avatars';
import { gameColorClass } from '@/utils/game-logos';

const sizes = {
  sm: { box: 'size-10 text-sm rounded-xl', px: 40 },
  md: { box: 'size-14 text-lg rounded-2xl', px: 56 },
  lg: { box: 'size-20 text-2xl rounded-2xl', px: 80 },
  xl: { box: 'size-28 text-3xl rounded-3xl', px: 112 },
} as const;

// A team's logo (team-logos bucket), or the team's initials on the game's color when it has none
// or the image can't load. Decorative next to the visible team name, so the alt text is empty.
export default function TeamLogo({
  url, name, gameId, gameName, size = 'md', className = '',
}: {
  url?: string | null;
  name: string;
  gameId?: string | null;
  gameName?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const { box, px } = sizes[size];
  const base = `relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-stone-200/90 shadow-xs ${box} ${className}`;

  if (url && !failed) {
    return (
      <span className={`${base} bg-stone-100`}>
        <Image
          src={url}
          alt=""
          width={px}
          height={px}
          // Already resized to 512x512 WebP when uploaded
          unoptimized
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className={`${base} ${gameColorClass(gameName, gameId)} font-black tracking-wide text-white`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
