'use client';

import { useState } from 'react';
import Image from 'next/image';
import GameLogo from '@/components/GameLogo';
import { CATEGORY_ICONS } from '@/components/announcements/CategoryBadge';
import { CATEGORY_INFO, categoryOf } from '@/utils/announcements';
import { siteImageUrl } from '@/utils/site';

// The cover of an announcement card: the uploaded image, or (no image / it fails to load) a
// gradient in the category's colors with the game's logo, or the category icon for general posts.
// The image zooms slightly when the card is hovered (group-hover; off with reduced motion).
export default function AnnouncementCover({
  coverPath, category, gameId, sizes, priority = false, className = '',
}: {
  coverPath: string | null;
  category: string;
  gameId: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = siteImageUrl(coverPath);
  const id = categoryOf(category);
  const Icon = CATEGORY_ICONS[id];
  // `relative` unless the caller positions it (both classes at once: relative would win)
  const position = /(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative';

  return (
    <div className={`${position} overflow-hidden bg-ink ${className}`}>
      {src && !failed ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-linear-to-br ${CATEGORY_INFO[id].gradient} transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
        >
          {/* Faint triangle pattern + glow, like the site's dark bands */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_80%_20%,var(--color-gold)_0,transparent_45%)]" />
          {gameId ? (
            <GameLogo gameId={gameId} balanced className="absolute inset-0 drop-shadow-lg" />
          ) : (
            <Icon className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/25" />
          )}
        </div>
      )}
    </div>
  );
}
