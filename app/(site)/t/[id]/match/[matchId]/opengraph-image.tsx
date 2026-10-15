import { getPublicTournament, teamNameMap } from '@/utils/public-tournament';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import { OG_SIZE, ogCard } from '@/utils/og-card';

// Preview image when a match link is shared (Facebook, Messenger)
export const alt = 'DALTA Esports match';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params;
  const data = await getPublicTournament(id);
  const match = data?.matches.find((m) => m.id === matchId);
  if (!data || !match) return ogCard({ eyebrow: 'Match', title: 'Match not found' });

  const names = teamNameMap(data);
  const roundCount = data.matches.reduce((max, m) => Math.max(max, m.round), 0);
  const teamA = match.team_a_id ? names[match.team_a_id] ?? 'TBD' : 'TBD';
  const teamB = match.team_b_id ? names[match.team_b_id] ?? 'TBD' : 'TBD';
  const result = match.status === 'completed'
    ? (match.is_forfeit ? 'Won by forfeit' : `Final: ${match.score_a ?? '-'} - ${match.score_b ?? '-'}`)
    : `${formatDateTime(match.scheduled_at, 'Asia/Manila')} (PH time)`;

  return ogCard({
    eyebrow: `${data.tournament.game} · ${roundLabel(match.round, roundCount)}`,
    title: `${teamA} vs ${teamB}`,
    subtitle: result,
    footer: data.tournament.name,
  });
}
