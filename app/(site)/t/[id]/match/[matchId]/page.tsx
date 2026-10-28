import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicTournament, teamNameMap, type PublicTournament } from '@/utils/public-tournament';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import { publicMatchPath, publicTournamentPath } from '@/utils/site-url';
import FacebookPlayer from '@/components/FacebookPlayer';
import ShareButton from '@/components/ShareButton';
import CalendarLinks from '@/components/CalendarLinks';
import LiveRefresher from '@/components/site/LiveRefresher';
import { SectionTitle } from '@/components/site/SiteParts';
import { SectionLoading } from '@/components/PageLoading';
import PredictionsProvider from '@/components/PredictionsProvider';
import PredictionPicker from '@/components/PredictionPicker';
import { Target } from 'lucide-react';

const TZ = 'Asia/Manila';

// The match and the names shown everywhere on this page (and in the link preview)
function describeMatch(data: PublicTournament, matchId: string) {
  const match = data.matches.find((m) => m.id === matchId);
  if (!match) return null;
  const names = teamNameMap(data);
  const roundCount = data.matches.reduce((max, m) => Math.max(max, m.round), 0);
  const teamA = match.team_a_id ? names[match.team_a_id] ?? 'Unknown team' : 'TBD';
  const teamB = match.team_b_id ? names[match.team_b_id] ?? 'Unknown team' : 'TBD';
  return { match, teamA, teamB, round: roundLabel(match.round, roundCount), when: formatDateTime(match.scheduled_at, TZ) };
}

export async function generateMetadata({ params }: PageProps<'/t/[id]/match/[matchId]'>): Promise<Metadata> {
  const { id, matchId } = await params;
  const data = await getPublicTournament(id);
  const info = data && describeMatch(data, matchId);
  if (!data || !info) return { title: 'Match not found · DALTA Esports' };

  const title = `${info.teamA} vs ${info.teamB}`;
  const description = info.match.status === 'completed'
    ? `${info.round} · ${data.tournament.name} · Final: ${info.match.is_forfeit ? 'won by forfeit' : `${info.match.score_a ?? '-'} - ${info.match.score_b ?? '-'}`}`
    : `${info.round} · ${data.tournament.name} · ${info.when} (PH time)`;
  const url = publicMatchPath(id, matchId);
  return {
    title: `${title} · DALTA Esports`,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'DALTA Esports' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// Public match page (no login): teams, time, score, live stream, calendar and share.
export default function PublicMatchPage({ params }: PageProps<'/t/[id]/match/[matchId]'>) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <MatchContent params={params} />
    </Suspense>
  );
}

async function MatchContent({ params }: { params: PageProps<'/t/[id]/match/[matchId]'>['params'] }) {
  const { id, matchId } = await params;
  const data = await getPublicTournament(id);
  const info = data && describeMatch(data, matchId);
  if (!data || !info) notFound();

  const { match, teamA, teamB } = info;
  const done = match.status === 'completed';
  // A stream for this match, or else any live stream of the tournament
  const stream = data.live_streams.find((s) => s.match_id === match.id) ?? (match.status === 'live' ? data.live_streams[0] : undefined);
  const teamClass = (teamId: string | null) =>
    done ? (match.winner_team_id === teamId ? 'text-amber-700 font-black' : 'text-stone-400') : 'text-stone-950 font-black';

  return (
    <div className="space-y-8 uppercase">
      <LiveRefresher tournamentId={id} />
      <Link href={publicTournamentPath(id)} className="inline-flex items-center gap-1.5 text-xs font-black text-amber-800 hover:text-amber-900 tracking-wider">
        ← {data.tournament.name}
      </Link>

      <section className="rounded-2xl border border-stone-200/90 bg-white shadow-xs p-6 sm:p-8 space-y-5 text-center">
        <p className="text-xs uppercase tracking-widest text-amber-800 font-extrabold">
          {data.tournament.game} · {info.round} · Match {match.match_number}
        </p>
        <h1 className="sr-only">{teamA} vs {teamB}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <p className={`text-base sm:text-xl font-black leading-relaxed ${teamClass(match.team_a_id)}`}>{teamA}</p>
          <p className="text-3xl sm:text-4xl font-black tabular-nums text-stone-950">
            {done && !match.is_forfeit ? `${match.score_a ?? '-'} : ${match.score_b ?? '-'}` : 'vs'}
          </p>
          <p className={`text-base sm:text-xl font-black leading-relaxed ${teamClass(match.team_b_id)}`}>{teamB}</p>
        </div>
        <p className="text-xs sm:text-sm text-stone-600 font-medium">
          {match.status === 'live' && <span className="text-red-600 font-black mr-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> LIVE</span>}
          {done
            ? `${match.winner_team_id === match.team_a_id ? teamA : teamB} won${match.is_forfeit ? ' by forfeit' : ''}`
            : `${info.when} (Philippine time)`}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <ShareButton path={publicMatchPath(id, match.id)} title={`${teamA} vs ${teamB}`} text={`${info.round}, ${data.tournament.name}`} />
          {match.scheduled_at && !done && <CalendarLinks kind="match" id={match.id} />}
        </div>
      </section>

      {/* Pick'em: community split for everyone, pick buttons for logged-in audience members */}
      {match.team_a_id && match.team_b_id && (
        <section className="space-y-3">
          <SectionTitle><span className="inline-flex items-center gap-2"><Target className="h-5 w-5 text-amber-700" /> Who will win?</span></SectionTitle>
          <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs">
            <PredictionsProvider matches={[match]}>
              <PredictionPicker match={match} teamNames={teamNameMap(data)} />
            </PredictionsProvider>
          </div>
        </section>
      )}

      {stream && (
        <section className="space-y-3">
          <SectionTitle><span className="inline-block h-3 w-3 rounded-full bg-red-500 animate-pulse mr-2" />Live now</SectionTitle>
          <div className="rounded-2xl border border-stone-200 overflow-hidden bg-black">
            <FacebookPlayer url={stream.facebook_url} title={stream.title} />
          </div>
        </section>
      )}

      {/* All matches of either team, e.g. for players and their families */}
      {(match.team_a_id || match.team_b_id) && (
        <section className="space-y-3">
          <SectionTitle>Follow a team</SectionTitle>
          <div className="flex flex-col gap-3">
            {[{ teamId: match.team_a_id, label: teamA }, { teamId: match.team_b_id, label: teamB }]
              .filter((t) => t.teamId)
              .map((t) => (
                <div key={t.teamId} className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-white min-w-32">{t.label}</span>
                  <CalendarLinks kind="team" id={t.teamId!} label="All matches" />
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
