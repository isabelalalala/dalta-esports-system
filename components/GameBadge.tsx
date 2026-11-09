'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Gamepad2 } from 'lucide-react';
import { getGameLogoSet } from '@/utils/game-logos';
import GameLogo from '@/components/GameLogo';

// The one way to show a game (11.4), so it looks the same everywhere:
//   variant="icon"     square symbol for small spaces (badges, tables, chips, lists, notifications)
//   variant="wordmark" the full logo for large spaces (game cards, tournament headers, divisions)
// withName adds the game's name as text next to the icon (the image is then decorative).
// Unknown game or an image that fails to load: a neutral gamepad icon, never colored text.
// surface: 'dark' = always on a dark stage (normal logo); 'auto' = follows the theme and uses the
// dark-letter version of white logos (Tekken 8, CODM) on light backgrounds. Icons are never cropped:
// object-contain inside the square, and the files carry ~10% transparent padding (11.6).

const ICON_SIZES = {
  xs: { box: 'size-5', px: 20, gap: 'gap-1.5', text: 'text-[11px]' },
  sm: { box: 'size-7', px: 28, gap: 'gap-2', text: 'text-xs' },
  md: { box: 'size-10', px: 40, gap: 'gap-2.5', text: 'text-sm' },
  lg: { box: 'size-14', px: 56, gap: 'gap-3', text: 'text-base' },
  xl: { box: 'size-20', px: 80, gap: 'gap-3', text: 'text-lg' },
} as const;

const WORDMARK_SIZES = {
  xs: 'h-5 w-16',
  sm: 'h-7 w-24',
  md: 'h-10 w-32',
  lg: 'h-16 w-52',
  xl: 'h-24 w-72',
} as const;

export type GameBadgeSize = keyof typeof ICON_SIZES;

interface Props {
  game?: string | null;   // game id, e.g. 'lol'
  name?: string | null;   // game name, e.g. 'League of Legends' (either one is enough)
  variant?: 'icon' | 'wordmark';
  size?: GameBadgeSize;
  withName?: boolean;
  surface?: 'auto' | 'dark';
  className?: string;
  nameClassName?: string;
}

export default function GameBadge({
  game, name, variant = 'icon', size = 'sm', withName = false, surface = 'auto', className = '', nameClassName = '',
}: Props) {
  const set = getGameLogoSet(name, game);
  const label = name || set?.label || 'Game';

  if (variant === 'wordmark') {
    return <Wordmark set={set} game={game} label={label} surface={surface} className={className || WORDMARK_SIZES[size]} />;
  }

  const icon = (
    <Icon
      src={set?.icon ?? null} lightSrc={surface === 'auto' ? set?.iconLight ?? null : null}
      label={withName ? '' : label} size={size} className={withName ? '' : className}
    />
  );
  if (!withName) return icon;
  const s = ICON_SIZES[size];
  return (
    <span className={`inline-flex min-w-0 items-center ${s.gap} ${className}`}>
      {icon}
      <span className={`min-w-0 truncate ${s.text} ${nameClassName}`}>{label}</span>
    </span>
  );
}

function Icon({ src, lightSrc, label, size, className }: {
  src: string | null; lightSrc: string | null; label: string; size: GameBadgeSize; className: string;
}) {
  const [failed, setFailed] = useState(false);
  const { box, px } = ICON_SIZES[size];
  if (!src || failed) {
    return (
      <span
        role={label ? 'img' : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
        title={label || undefined}
        className={`inline-grid shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500 ${box} ${className}`}
      >
        <Gamepad2 className="size-[65%]" aria-hidden="true" />
      </span>
    );
  }
  const img = (file: string, extra = '') => (
    <Image
      src={file}
      alt={label}
      width={px}
      height={px}
      sizes={`${px}px`}
      onError={() => setFailed(true)}
      className={`block size-full object-contain ${extra}`}
    />
  );
  return (
    <span className={`relative inline-flex shrink-0 ${box} ${className}`} title={label || undefined}>
      {lightSrc ? (
        <>
          {img(lightSrc, 'logo-on-light')}
          {img(src, 'logo-on-dark')}
        </>
      ) : img(src)}
    </span>
  );
}

function Wordmark({ set, game, label, surface, className }: {
  set: ReturnType<typeof getGameLogoSet>; game?: string | null; label: string; surface: 'auto' | 'dark'; className: string;
}) {
  // White logos get their dark-letter version on light backgrounds; the theme decides which one shows
  if (surface === 'auto' && set?.light) {
    return (
      <span className={`relative inline-block shrink-0 ${className}`}>
        <span className="logo-on-light absolute inset-0">
          <GameLogo name={label} gameId={game} src={set.light} className="absolute inset-0" sizes="300px" />
        </span>
        <span className="logo-on-dark absolute inset-0">
          <GameLogo name={label} gameId={game} className="absolute inset-0" sizes="300px" />
        </span>
      </span>
    );
  }
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <GameLogo name={label} gameId={game} className="absolute inset-0" sizes="300px" />
    </span>
  );
}
