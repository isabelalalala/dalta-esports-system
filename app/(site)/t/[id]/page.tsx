import { Suspense } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicTournament, teamNameMap } from '@/utils/public-tournament';
import { formatDate, formatDateTime, getTournamentStatus, isBye, roundLabel, statusLabels, statusStyles } from '@/utils/tournaments';
import { publicMatchPath, publicTournamentPath } from '@/utils/site-url';
import type { Match } from '@/utils/types';
import Bracket from '@/app/tournaments/[id]/Bracket';
import FacebookPlayer from '@/components/FacebookPlayer';
import ShareButton from '@/components/ShareButton';
import CalendarLinks from '@/components/CalendarLinks';
import LiveRefresher from '@/components/site/LiveRefresher';
import { EmptyNote, Paragraphs, SectionTitle, SiteBox } from '@/components/site/SiteParts';
import { SectionLoading } from '@/components/PageLoading';
import PredictionsProvider from '@/components/PredictionsProvider';
import PredictionPicker from '@/components/PredictionPicker';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { BadgeCheck, Calendar, Clock, ExternalLink, MessageSquare, Target, Trophy, Tv, Users } from 'lucide-react';

const TZ = 'Asia/Manila';

function getGameLogo(game: string, gameId?: string | null): string | null {
  const g = (game || '').toLowerCase().trim();
  const id = (gameId || '').toLowerCase().trim();

  if (g.includes('mlbb') || g.includes('mobile legends') || id.includes('mlbb')) {
    return '/MLBB LOGO.png';
  }
  if (g.includes('valo') || g.includes('valorant') || id.includes('valo')) {
    return '/VALO LOGO.png';
  }
  if (g.includes('tekken') || id.includes('tekken')) {
    return '/TEKKEMN 8 LOGO.png';
  }
  if (g.includes('codm') || g.includes('call of duty') || id.includes('cod')) {
    return '/CODM LOGO.png';
  }
  return null;
}

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
  const logo = getGameLogo(t.game, t.game_id);

  const matchRow = (m: Match) => (
    <li key={m.id}>
      <Link href={publicMatchPath(t.id, m.id)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-5 py-3.5 hover:bg-amber-50/50 transition-colors">
        <span>
          <span className={m.status === 'completed' && m.winner_team_id === m.team_a_id ? 'text-[#5B271E] font-black' : 'text-stone-950 font-bold'}>{name(m.team_a_id)}</span>
          {m.status === 'completed'
            ? <span className="mx-2 tabular-nums text-stone-900 font-extrabold">{m.is_forfeit ? 'forfeit' : `${m.score_a ?? '-'} : ${m.score_b ?? '-'}`}</span>
            : <span className="mx-2 text-stone-400 font-medium">vs</span>}
          <span className={m.status === 'completed' && m.winner_team_id === m.team_b_id ? 'text-[#5B271E] font-black' : 'text-stone-950 font-bold'}>{name(m.team_b_id)}</span>
          {m.status === 'live' && <span className="ml-2 text-xs text-red-600 font-black"><span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> LIVE</span>}
        </span>
        <span className="text-xs text-stone-500 font-medium">
          {roundLabel(m.round, roundCount)} · {formatDateTime(m.scheduled_at, TZ)}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="space-y-8 uppercase text-stone-950">
      <LiveRefresher tournamentId={t.id} />

      {/* 1. Main Hero Container */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Tournament Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Tournaments
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border uppercase shadow-xs ${statusStyles[status]}`}>
              {statusLabels[status]}
            </span>
            {t.requires_verification && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border border-sky-500/50 bg-sky-500/20 text-sky-200 uppercase">
                <BadgeCheck className="h-3.5 w-3.5 text-sky-300" /> Verified Students Only
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            {t.name}
          </h1>
          <p
            className="animate-hero-tagline text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
            style={{ color: '#ffffff' }}
          >
            <span className="text-[#FFCC37] font-black">{t.game}</span>
            <span>•</span>
            <span>{formatDate(t.start_date)} – {formatDate(t.end_date)}</span>
            <span>•</span>
            <span>{data.approved_count} / {t.max_participants || '∞'} Teams</span>
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 pt-2">
          <ShareButton path={publicTournamentPath(t.id)} title={t.name} text={`${t.name} (${t.game}) on DALTA Esports`} />
          <CalendarLinks kind="tournament" id={t.id} label="Add matches to calendar" />
          {status === 'upcoming' && (
            <Link
              href={`/tournaments/${t.id}`}
              className="px-4 py-2 rounded-xl bg-gold hover:bg-golddark text-stone-950 text-xs font-black tracking-wider transition-all inline-flex items-center gap-1.5 border border-amber-400"
            >
              <span>Register Team</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </section>

      {/* 2. Live Broadcast */}
      {data.live_streams.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-stone-200/90 pb-3">
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Live Broadcast</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-600 animate-ping mr-1" />
              Live Stream Now
            </h2>
          </div>
          {data.live_streams.map((s) => (
            <div key={s.id} className="rounded-3xl border border-stone-200 overflow-hidden bg-black shadow-md">
              <FacebookPlayer url={s.facebook_url} title={s.title} />
            </div>
          ))}
        </section>
      )}

      {/* 3. Media & Information Editorial Row */}
      <div className="animate-stagger-1 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {logo ? (
          <div className="lg:col-span-5 w-full">
            <div className="relative aspect-[4/3] max-h-[380px] w-full rounded-3xl border border-stone-800/80 bg-[#0e0c0b] overflow-hidden shadow-md flex items-center justify-center p-6 sm:p-8">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 85% 85%, rgba(164, 148, 140, 0.35) 0%, rgba(35, 30, 27, 0.7) 45%, #0e0c0b 100%)',
                }}
              />
              <div className="absolute top-4 right-4 z-20 pointer-events-none">
                <span className="text-[10px] font-black tracking-widest px-3 py-1.5 rounded-md border border-[#FFCC37]/60 bg-[#0e0c0b]/85 text-[#FFCC37] uppercase backdrop-blur-md shadow-md">
                  {statusLabels[status]}
                </span>
              </div>
              <div className="relative z-0 w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
                <Image
                  src={logo}
                  alt={t.game}
                  fill
                  sizes="(max-width: 1024px) 200px, 220px"
                  className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
                  priority
                />
              </div>
              <div className="absolute bottom-4 left-6 right-6 text-center z-10">
                <span className="text-xs font-black tracking-widest text-stone-400 uppercase">
                  {t.game} Division
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className={logo ? 'lg:col-span-7 w-full space-y-6' : 'w-full space-y-6'}>
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-4 space-y-1">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">
                Competition Details
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
                Overview &amp; Information
              </h2>
            </div>

            <div className="text-stone-800 text-xs sm:text-sm font-medium uppercase tracking-wide leading-relaxed">
              {t.description ? (
                <Paragraphs text={t.description} />
              ) : (
                <p className="text-stone-400 italic">No description provided for this tournament.</p>
              )}
            </div>

            {status === 'upcoming' && (
              <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-4">
                <p className="text-xs text-stone-500 font-bold tracking-wider">
                  Team Captains can register their verified rosters online.
                </p>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="px-5 py-2.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all shrink-0"
                >
                  Register Team →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Rules Section (if present) */}
      {t.rules && (
        <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Governance</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">Rules &amp; Regulations</h2>
          </div>
          <div className="text-stone-800 text-xs sm:text-sm font-medium uppercase tracking-wide leading-relaxed">
            <Paragraphs text={t.rules} />
          </div>
        </section>
      )}

      {/* 5. Approved Teams */}
      <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
        <div className="border-b border-stone-100 pb-3">
          <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Roster</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
            Participating Teams ({data.teams.length})
          </h2>
        </div>
        {data.teams.length === 0 ? (
          <EmptyNote>No approved teams yet.</EmptyNote>
        ) : (
          <ul className="flex flex-wrap gap-2.5">
            {data.teams.map((team) => (
              <li
                key={team.id}
                className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-black uppercase text-stone-900 shadow-2xs hover:bg-white hover:border-amber-400/60 transition-colors"
              >
                {team.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6. Bracket */}
      <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
        <div className="border-b border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Playoffs</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">Tournament Bracket</h2>
          </div>
          {data.matches.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-stone-600 font-black uppercase tracking-wider">
              <Target className="h-4 w-4 text-[#5B271E]" />
              <Link href={`/tournaments/${t.id}/predictions`} className="text-[#5B271E] hover:text-[#FFCC37] underline">
                Pick&apos;em Leaderboard →
              </Link>
            </div>
          )}
        </div>

        {data.matches.length === 0 ? (
          <EmptyNote>The bracket appears once registration closes and the organizers create it.</EmptyNote>
        ) : (
          <div className="space-y-4">
            <PredictionsProvider matches={data.matches}>
              <Bracket
                matches={data.matches}
                teamNames={names}
                timeZone={TZ}
                matchHref={(m) => publicMatchPath(t.id, m.id)}
                renderBelow={(m) => <PredictionPicker match={m} teamNames={names} compact />}
              />
            </PredictionsProvider>
          </div>
        )}
      </section>

      {/* 7. Schedule & Results */}
      {upcoming.length > 0 && (
        <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Schedule</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">Upcoming Matches</h2>
            <p className="text-[11px] text-stone-400 font-semibold uppercase mt-0.5">Times are Philippine Time (PHT).</p>
          </div>
          <ul className="rounded-2xl border border-stone-200/90 bg-white shadow-2xs divide-y divide-stone-100 overflow-hidden">
            {upcoming.map(matchRow)}
          </ul>
        </section>
      )}

      {results.length > 0 && (
        <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Archive</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">Match Results</h2>
          </div>
          <ul className="rounded-2xl border border-stone-200/90 bg-white shadow-2xs divide-y divide-stone-100 overflow-hidden">
            {results.map(matchRow)}
          </ul>
        </section>
      )}
    </div>
  );
}
