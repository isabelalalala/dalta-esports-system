import { getHallOfFame } from '@/utils/site-data';
import { OG_SIZE, ogCard } from '@/utils/og-card';

// Preview image when /hall-of-fame is shared (Facebook, Messenger): the latest champion
export const alt = 'DALTA Esports Hall of Fame';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const entries = await getHallOfFame();
  const latest = entries[0];
  if (!latest) {
    return ogCard({ eyebrow: 'DALTA Esports', title: 'Hall of Fame', subtitle: 'Every champion, season after season.' });
  }
  return ogCard({
    eyebrow: 'Hall of Fame',
    title: latest.champion_team_name,
    subtitle: `Champion of ${latest.tournament_name}${latest.game_name ? ` (${latest.game_name})` : ''}`,
    footer: `${entries.length} ${entries.length === 1 ? 'champion' : 'champions'} in the Hall of Fame`,
  });
}
