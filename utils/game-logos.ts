// Logo image (in /public) for a game, matched by game id (e.g. `mlbb`) and/or name
// (e.g. "Mobile Legends: Bang Bang"). Returns null for an unknown game: components/GameLogo.tsx
// then shows the game's initials instead, so a missing logo is never blank or broken.
export function getGameLogo(name?: string | null, gameId?: string | null): string | null {
  const n = (name || '').toLowerCase().trim();
  const id = (gameId || '').toLowerCase().trim();

  if (id.includes('mlbb') || n.includes('mlbb') || n.includes('mobile legends')) return '/MLBB LOGO.png';
  if (id.includes('valo') || n.includes('valo')) return '/VALO LOGO.png';
  if (id.includes('tekken') || n.includes('tekken')) return '/TEKKEN 8 LOGO.png';
  if (id.includes('cod') || n.includes('codm') || n.includes('call of duty')) return '/CODM LOGO.png';
  if (id === 'lol' || id.includes('league') || n.includes('league of legends') || n === 'lol') return '/LOL LOGO.png';
  return null;
}

// Short label for the fallback badge: "League of Legends" -> "LOL", "Some Game" -> "SG"
export function gameInitials(name?: string | null): string {
  const words = (name || '').trim().split(/[\s:]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}
