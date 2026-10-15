import { getPublicTournament } from '@/utils/public-tournament';
import { formatDate, getTournamentStatus, statusLabels } from '@/utils/tournaments';
import { OG_SIZE, ogCard } from '@/utils/og-card';

// Preview image when /t/<id> is shared (Facebook, Messenger)
export const alt = 'DALTA Esports tournament';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPublicTournament(id);
  if (!data) return ogCard({ eyebrow: 'Tournament', title: 'Tournament not found' });

  const t = data.tournament;
  return ogCard({
    eyebrow: `${t.game} tournament`,
    title: t.name,
    subtitle: `${formatDate(t.start_date)} – ${formatDate(t.end_date)}`,
    footer: `${statusLabels[getTournamentStatus(t)]} · ${data.approved_count} / ${t.max_participants} teams`,
  });
}
