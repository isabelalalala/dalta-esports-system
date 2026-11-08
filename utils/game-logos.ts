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
}

const LOGOS: Record<'mlbb' | 'valorant' | 'tekken8' | 'codm' | 'lol', GameLogoInfo> = {
  mlbb: { src: '/games/mlbb.webp', fit: 'w-[60%] aspect-[913/275]' },
  valorant: { src: '/games/valorant.webp', fit: 'w-[42%] aspect-[805/532]' },
  tekken8: { src: '/games/tekken8.webp', fit: 'w-[78%] aspect-[921/138]' },
  codm: { src: '/games/codm.webp', fit: 'w-[57%] aspect-[956/318]' },
  lol: { src: '/games/lol.webp', fit: 'w-[54%] aspect-[1400/531]' },
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
