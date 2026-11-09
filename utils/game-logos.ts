// Logos for the 5 supported games, in /public/games. The files are trimmed (no empty border
// around the artwork), so `object-contain` makes them as big as their box allows.
//
// `fit`: Tailwind classes for the "balanced" mode of components/GameLogo.tsx. The logos have very
// different shapes (Tekken is ~6.7x wider than tall, Valorant ~1.5x), so one box size would make
// Valorant look tiny or Tekken huge. Each width is roughly proportional to the square root of the
// logo's aspect ratio (the same visual area for every logo), aimed at ~60% of the card for MLBB.
// The aspect-[w/h] class is the real image ratio, so the image fills its box exactly.
interface GameLogoInfo {
  src: string;
  fit: string;
  // Background behind a team's initials when it has no logo (components/TeamLogo.tsx). Palette
  // classes that dark mode doesn't remap, with white text; not the meaning colors.
  color: string;
  // Two versions per game (11.4), both cut/recolored from the wordmark by scripts/make-game-icons.mjs:
  // `icon` = the square symbol for small spaces (badges, tables, chips, notifications), `light` = the
  // wordmark for light backgrounds when its letters are white (Tekken 8, CODM). `short` is only used
  // in text contexts (alt texts, sorting), never as a visible badge.
  short: string;
  icon: string;
  // The icon for light backgrounds, when the logo has white parts (Tekken 8's whole wordmark)
  iconLight?: string;
  light?: string;
  // Full game name, for alt texts and tooltips when the caller has none
  label: string;
}

const LOGOS: Record<'mlbb' | 'valorant' | 'tekken8' | 'codm' | 'lol', GameLogoInfo> = {
  mlbb: { src: '/games/mlbb.webp', fit: 'w-[60%] aspect-[913/275]', color: 'bg-orange-700', short: 'ML', icon: '/games/mlbb-icon.webp', label: 'Mobile Legends: Bang Bang' },
  valorant: { src: '/games/valorant.webp', fit: 'w-[42%] aspect-[805/532]', color: 'bg-rose-700', short: 'VAL', icon: '/games/valorant-icon.webp', label: 'Valorant' },
  tekken8: { src: '/games/tekken8.webp', fit: 'w-[78%] aspect-[921/138]', color: 'bg-violet-700', short: 'T8', icon: '/games/tekken8-icon.webp', iconLight: '/games/tekken8-icon-light.webp', light: '/games/tekken8-light.webp', label: 'Tekken 8' },
  codm: { src: '/games/codm.webp', fit: 'w-[57%] aspect-[956/318]', color: 'bg-lime-800', short: 'COD', icon: '/games/codm-icon.webp', light: '/games/codm-light.webp', label: 'Call of Duty: Mobile' },
  lol: { src: '/games/lol.webp', fit: 'w-[54%] aspect-[1400/531]', color: 'bg-cyan-800', short: 'LoL', icon: '/games/lol-icon.webp', label: 'League of Legends' },
};

// Which game it is, matched by game id (e.g. `mlbb`) and/or name (e.g. "Mobile Legends: Bang Bang")
function findLogo(name?: string | null, gameId?: string | null): GameLogoInfo | null {
  const n = (name || '').toLowerCase().trim();
  const id = (gameId || '').toLowerCase().trim();

  if (id.includes('mlbb') || n.includes('mlbb') || n.includes('mobile legends')) return LOGOS.mlbb;
  if (id.includes('valo') || n.includes('valo')) return LOGOS.valorant;
  if (id.includes('tekken') || n.includes('tekken')) return LOGOS.tekken8;
  if (id.includes('cod') || n.includes('codm') || n.includes('call of duty')) return LOGOS.codm;
  if (id === 'lol' || id.includes('league') || n.includes('league of legends') || n === 'lol') return LOGOS.lol;
  return null;
}

// Logo image for a game. Returns null for an unknown game: components/GameLogo.tsx then shows
// the game's initials instead, so a missing logo is never blank or broken.
export function getGameLogo(name?: string | null, gameId?: string | null): string | null {
  return findLogo(name, gameId)?.src ?? null;
}

// Size classes that make the logos look equally big on a card (null for an unknown game)
export function getGameLogoFit(name?: string | null, gameId?: string | null): string | null {
  return findLogo(name, gameId)?.fit ?? null;
}

// Short label for the fallback badge: "League of Legends" -> "LOL", "Some Game" -> "SG"
export function gameInitials(name?: string | null): string {
  const words = (name || '').trim().split(/[\s:]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

// The compact icon of a game (square image) and the text used where no image fits
export function getGameIcon(name?: string | null, gameId?: string | null): { src: string | null; short: string } {
  const info = findLogo(name, gameId);
  return { src: info?.icon ?? null, short: info?.short ?? gameInitials(name || gameId).slice(0, 3) };
}

// Everything components/GameBadge.tsx needs: wordmark, light-background wordmark, icon and full name.
// null for an unknown game (the badge then shows a neutral gamepad icon).
export function getGameLogoSet(name?: string | null, gameId?: string | null) {
  const info = findLogo(name, gameId);
  if (!info) return null;
  return { wordmark: info.src, light: info.light ?? null, icon: info.icon, iconLight: info.iconLight ?? null, label: info.label, fit: info.fit };
}

// The game's color for a team's initials badge (maroon for an unknown game)
export function gameColorClass(name?: string | null, gameId?: string | null): string {
  return findLogo(name, gameId)?.color ?? 'bg-maroon';
}
