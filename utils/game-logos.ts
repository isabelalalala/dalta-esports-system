// Logo image (in /public) for a game, matched by game id (e.g. `mlbb`) and/or name
// (e.g. "Mobile Legends: Bang Bang"). Returns null when there is no logo (League of Legends),
// so the page shows its fallback icon instead.
export function getGameLogo(name?: string | null, gameId?: string | null): string | null {
  const n = (name || '').toLowerCase().trim();
  const id = (gameId || '').toLowerCase().trim();

  if (id.includes('mlbb') || n.includes('mlbb') || n.includes('mobile legends')) return '/MLBB LOGO.png';
  if (id.includes('valo') || n.includes('valo')) return '/VALO LOGO.png';
  if (id.includes('tekken') || n.includes('tekken')) return '/TEKKEN 8 LOGO.png';
  if (id.includes('cod') || n.includes('codm') || n.includes('call of duty')) return '/CODM LOGO.png';
  return null;
}
