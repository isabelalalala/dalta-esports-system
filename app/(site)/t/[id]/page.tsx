import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicTournament, teamNameMap } from '@/utils/public-tournament';
import { formatDate, formatDateTime, getTournamentStatus, isBye, roundLabel, statusLabels } from '@/utils/tournaments';
import { publicMatchPath, publicTournamentPath } from '@/utils/site-url';
import type { Match } from '@/utils/types';
import Bracket from '@/app/tournaments/[id]/Bracket';
import FacebookPlayer from '@/components/FacebookPlayer';
import ShareButton from '@/components/ShareButton';
import CalendarLinks from '@/components/CalendarLinks';
import LiveRefresher from '@/components/site/LiveRefresher';
import { EmptyNote, Paragraphs, SectionTitle, SiteBox } from '@/components/site/SiteParts';
import { SectionLoading } from '@/components/PageLoading';

// The server's clock is UTC, so times on this server-rendered page are shown in PH time
const TZ = 'Asia/Manila';

// Link previews on Facebook/Messenger (the image is opengraph-image.tsx next to this file)
export async function generateMetadata({ params }: PageProps<'/t/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const data = await getPublicTournament(id);
  if (!data) return { title: 'Tournament not found · DALTA Esports' };
  const t = data.tournament;
  const description = `${t.game} tournament · ${formatDate(t.start_date)} – ${formatDate(t.end_date)} · ${statusLabels[getTournamentStatus(t)]}`;
  return {
    title: `${t.name} · DALTA Esports`,
    description,
    alternates: { canonical: publicTournamentPath(t.id) },
    openGraph: { title: t.name, description, url: publicTournamentPath(t.id), type: 'website', siteName: 'DALTA Esports' },
    twitter: { card: 'summary_large_image', title: t.name, description },
  };
}

// Public tournament page (no login): info, rules, teams, bracket, schedule, results, live stream.
// The id comes from the URL (only known at request time), so the content is inside Suspense.
export default function PublicTournamentPage({ params }: PageProps<'/t/[id]'>) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <TournamentContent params={params} />
    </Suspense>
  );
}

async function TournamentContent({ params }: { params: PageProps<'/t/[id]'>['params'] }) {
  const { id } = await params;
  const data = await getPublicTournament(id);
  if (!data) notFound();

  const t = data.tournament;
  const status = getTournamentStatus(t);
  const names = teamNameMap(data);
  const name = (teamId: string | null) => (teamId ? names[teamId] ?? 'Unknown team' : 'TBD');
  const realMatches = data.matches.filter((m) => !isBye(m));
  const roundCount = data.matches.reduce((max, m) => Math.max(max, m.round), 0);
  const upcoming = realMatches
    .filter((m) => m.status !== 'completed')
    .sort((a, b) => (a.scheduled_at ?? '9999').localeCompare(b.scheduled_at ?? '9999'));
  const results = realMatches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => b.round - a.round || a.match_number - b.match_number);

  const matchRow = (m: Match) => (
    <li key={m.id}>
      <Link href={publicMatchPath(t.id, m.id)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-4 py-3 hover:bg-brown/30">
        <span>
          <span className={m.status === 'completed' && m.winner_team_id === m.team_a_id ? 'text-gold font-bold' : 'text-white'}>{name(m.team_a_id)}</span>
          {m.status === 'completed'
            ? <span className="mx-2 tabular-nums text-white">{m.is_forfeit ? 'forfeit' : `${m.score_a ?? '-'} : ${m.score_b ?? '-'}`}</span>
            : <span className="mx-2 text-gray-500">vs</span>}
          <span className={m.status === 'completed' && m.winner_team_id === m.team_b_id ? 'text-gold font-bold' : 'text-white'}>{name(m.team_b_id)}</span>
          {m.status === 'live' && <span className="ml-2 text-xs text-red-400 font-bold">● LIVE</span>}
        </span>
        <span className="text-xs text-gray-400">
          {roundLabel(m.round, roundCount)} · {formatDateTime(m.scheduled_at, TZ)}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="space-y-8">
      <LiveRefresher tournamentId={t.id} />

      {/* Header */}
      <section className="border-2 border-gold bg-sitecard shadow-[6px_6px_0_var(--color-brown)] p-6 space-y-4">
        <p className="text-xs uppercase tracking-widest text-gray-400">{t.game} tournament</p>
        <h1 className="font-pixel text-gold text-lg sm:text-2xl leading-relaxed">{t.name}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-300">
          <span className="font-bold text-gold">{statusLabels[status]}</span>
          <span>{formatDate(t.start_date)} – {formatDate(t.end_date)}</span>
          <span>Register by {formatDate(t.registration_deadline)}</span>
          <span>{data.approved_count} / {t.max_participants} teams</span>
          {t.requires_verification && <span>✓ Verified students only</span>}
        </div>
        <div className="flex flex-wrap gap-3">
          <ShareButton path={publicTournamentPath(t.id)} title={t.name} text={`${t.name} (${t.game}) on DALTA Esports`} />
          <CalendarLinks kind="tournament" id={t.id} label="Add all matches to calendar" />
        </div>
        {status === 'upcoming' && (
          <p className="text-sm text-gray-400">
            Captains: <Link href={`/tournaments/${t.id}`} className="text-gold hover:underline">log in to register your team →</Link>
          </p>
        )}
      </section>

      {/* Live stream */}
      {data.live_streams.length > 0 && (
        <section className="space-y-4">
          <SectionTitle>🔴 Live now</SectionTitle>
          {data.live_streams.map((s) => (
            <div key={s.id} className="border-2 border-red-500/70 bg-black">
              <FacebookPlayer url={s.facebook_url} title={s.title} />
            </div>
          ))}
        </section>
      )}

      {(t.description || t.rules) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {t.description && (
            <SiteBox><SectionTitle>About</SectionTitle><Paragraphs text={t.description} /></SiteBox>
          )}
          {t.rules && (
            <SiteBox><SectionTitle>Rules</SectionTitle><Paragraphs text={t.rules} /></SiteBox>
          )}
        </div>
      )}

      <section>
        <SectionTitle>Teams</SectionTitle>
        {data.teams.length === 0 ? (
          <EmptyNote>No approved teams yet.</EmptyNote>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.teams.map((team) => (
              <li key={team.id} className="px-3 py-1.5 border-2 border-brownlight bg-sitecard text-sm font-semibold">{team.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Bracket</SectionTitle>
        {data.matches.length === 0 ? (
          <EmptyNote>The bracket appears once registration closes and the organizers create it.</EmptyNote>
        ) : (
          <div className="border-2 border-brownlight bg-sitecard p-4">
            <Bracket matches={data.matches} teamNames={names} timeZone={TZ} matchHref={(m) => publicMatchPath(t.id, m.id)} />
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <SectionTitle>Schedule</SectionTitle>
          <p className="text-xs text-gray-500 mb-2">Times are Philippine time.</p>
          <ul className="border-2 border-brownlight bg-sitecard divide-y-2 divide-brown">{upcoming.map(matchRow)}</ul>
        </section>
      )}

      {results.length > 0 && (
        <section>
          <SectionTitle>Results</SectionTitle>
          <ul className="border-2 border-brownlight bg-sitecard divide-y-2 divide-brown">{results.map(matchRow)}</ul>
        </section>
      )}
    </div>
  );
}
