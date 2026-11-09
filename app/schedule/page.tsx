'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { getErrorMessage } from '@/utils/errors';
import type { Match, Tournament } from '@/utils/types';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import { fetchRoundCounts, fetchTeamNames } from '@/utils/matches';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Calendar, ChevronRight, Filter, Tv } from 'lucide-react';
import AutoUpdateBadge from '@/components/AutoUpdateBadge';
import { LiveTag, ScoreBoard, VersusBadge, VersusRow } from '@/components/MatchVersus';

type ScheduleMatch = Match & { tournaments: { name: string } | null };

const LIST_LIMIT = 30;

export default function SchedulePage() {
  const supabase = createClient();
  usePageTitle('Schedule & Results');
  const [tournaments, setTournaments] = useState<Pick<Tournament, 'id' | 'name'>[]>([]);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'results'>('all');
  const [live, setLive] = useState<ScheduleMatch[]>([]);
  const [upcoming, setUpcoming] = useState<ScheduleMatch[]>([]);
  const [results, setResults] = useState<ScheduleMatch[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [roundCounts, setRoundCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  // Live scores and schedule changes
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  useRealtimeRefresh('schedule', [{ table: 'matches' }], reload, 1000);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: tournamentsData, error: tourError } = await supabase
          .from('tournaments')
          .select('id, name')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(tournamentsData || []);

        const base = () => {
          const q = supabase.from('matches').select('*, tournaments(name)');
          return filter === 'all' ? q : q.eq('tournament_id', filter);
        };

        const [liveRes, upcomingRes, resultsRes] = await Promise.all([
          base().eq('status', 'live').order('scheduled_at'),
          base()
            .eq('status', 'scheduled')
            .order('scheduled_at', { ascending: true, nullsFirst: false })
            .limit(LIST_LIMIT),
          base()
            .eq('status', 'completed')
            .not('team_a_id', 'is', null)
            .not('team_b_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(LIST_LIMIT),
        ]);
        if (liveRes.error) throw liveRes.error;
        if (upcomingRes.error) throw upcomingRes.error;
        if (resultsRes.error) throw resultsRes.error;

        const all = [...(liveRes.data || []), ...(upcomingRes.data || []), ...(resultsRes.data || [])] as ScheduleMatch[];
        setLive(liveRes.data as ScheduleMatch[]);
        setUpcoming(upcomingRes.data as ScheduleMatch[]);
        setResults(resultsRes.data as ScheduleMatch[]);
        setTeamNames(await fetchTeamNames(supabase, all));
        setRoundCounts(await fetchRoundCounts(supabase, [...new Set(all.map((m) => m.tournament_id))]));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the schedule'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, filter, reloadCount]);

  const name = (teamId: string | null) => (teamId ? teamNames[teamId] ?? 'Unknown team' : 'TBD');

  const totalMatches = live.length + upcoming.length + results.length;

  if (loading) {
    return <PageLoading label="Loading schedule & results..." />;
  }

  return (
    <div className="w-full space-y-8 text-stone-950">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 @5xl:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Match Schedule Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-page-hero font-black tracking-wider uppercase leading-tight text-white"
          >
            Schedule &amp; Results
          </h1>
          <p
            className="text-base sm:text-lg font-medium leading-relaxed text-white"
          >
            Upcoming tournament fixtures, live arena bouts, and verified match results.
          </p>
        </div>
      </section>

      {/* 2. Controls & Filter Bar */}
      <div className="space-y-4">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}

        <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          {/* Tournament selector */}
          <div className="flex items-center gap-3 w-full @3xl:w-auto min-w-0">
            <Filter className="w-4 h-4 text-maroon shrink-0" />
            <label htmlFor="tournament-filter" className="sr-only">Filter by Tournament</label>
            <select
              id="tournament-filter"
              value={filter}
              onChange={(e) => {
                setLoading(true);
                setFilter(e.target.value);
              }}
              className="w-full @3xl:w-80 max-w-full p-3 rounded-xl bg-stone-50 border border-stone-300 text-stone-950 font-bold text-xs tracking-wider focus:bg-surface focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-2xs outline-none transition-all cursor-pointer"
            >
              <option value="all">All Tournaments</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick tab filters */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Match view filter">
            {[
              { id: 'all', label: `All (${totalMatches})` },
              { id: 'live', label: `Live (${live.length})`, highlight: live.length > 0 },
              { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
              { id: 'results', label: `Results (${results.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-gold text-stone-950 border border-amber-400 shadow-xs'
                    : tab.highlight
                    ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                    : 'bg-stone-100 text-stone-700 hover:text-stone-950 hover:bg-stone-200/80 border border-transparent'
                }`}
              >
                {tab.id === 'live' && live.length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                )}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Match Sections */}
      <div className="space-y-8">
        {/* Live Matches */}
        {(activeTab === 'all' || activeTab === 'live') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base sm:text-lg font-black text-stone-950 tracking-wider flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="text-red-700">Live Now</span>
                <span className="text-xs text-stone-500 font-bold">({live.length})</span>
              </h2>
              <AutoUpdateBadge />
              {live.length > 0 && (
                <Link
                  href="/live"
                  className="inline-flex items-center gap-1 text-xs font-bold text-maroon hover:text-gold tracking-wider transition-colors"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Open Live Broadcasts</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {live.length === 0 ? (
              activeTab === 'live' ? (
                <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 text-center text-stone-500 font-bold tracking-wider text-xs">
                  No matches currently in progress.
                </div>
              ) : null
            ) : (
              <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
                {live.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white border-2 border-red-500/70 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-4 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
                      <LiveTag label="Live arena" />
                      <Link
                        href={`/tournaments/${m.tournament_id}`}
                        className="text-[11px] font-bold text-stone-600 hover:text-gold transition-colors"
                      >
                        {m.tournaments?.name} · {roundLabel(m.round, roundCounts[m.tournament_id] || m.round)}
                      </Link>
                    </div>

                    {/* name | score | name: the score keeps its width, long names are cut with "..." */}
                    <VersusRow
                      teamA={name(m.team_a_id)}
                      teamB={name(m.team_b_id)}
                      middle={<ScoreBoard a={m.score_a} b={m.score_b} />}
                    />

                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/live"
                        className="uppercase inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs tracking-wider border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>Watch Stream</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Upcoming Matches */}
        {(activeTab === 'all' || activeTab === 'upcoming') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base sm:text-lg font-black text-stone-950 tracking-wider">
                Upcoming Fixtures <span className="text-xs text-stone-500 font-bold">({upcoming.length})</span>
              </h2>
            </div>

            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 text-center text-stone-500 font-bold tracking-wider text-xs">
                No upcoming matches scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs hover:border-stone-300 hover:-translate-y-0.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <VersusRow
                        teamA={name(m.team_a_id)}
                        teamB={name(m.team_b_id)}
                        middle={<VersusBadge />}
                      />

                      <div className="flex items-center gap-2 text-xs text-stone-500 font-medium tracking-wide">
                        <Link
                          href={`/tournaments/${m.tournament_id}`}
                          className="hover:text-gold underline font-semibold transition-colors"
                        >
                          {m.tournaments?.name}
                        </Link>
                        <span>·</span>
                        <span>{roundLabel(m.round, roundCounts[m.tournament_id] || m.round)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 text-stone-600 text-xs font-bold tracking-wider sm:text-right bg-stone-50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl">
                      <Calendar className="w-3.5 h-3.5 text-maroon shrink-0" />
                      <span>{formatDateTime(m.scheduled_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Results */}
        {(activeTab === 'all' || activeTab === 'results') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base sm:text-lg font-black text-stone-950 tracking-wider">
                Recent Results <span className="text-xs text-stone-500 font-bold">({results.length})</span>
              </h2>
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 text-center text-stone-500 font-bold tracking-wider text-xs">
                No completed results recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((m) => {
                  const isTeamAWinner = m.winner_team_id === m.team_a_id;
                  const isTeamBWinner = m.winner_team_id === m.team_b_id;

                  return (
                    <div
                      key={m.id}
                      className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs hover:border-stone-300 hover:-translate-y-0.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <VersusRow
                          teamA={name(m.team_a_id)}
                          teamB={name(m.team_b_id)}
                          winner={isTeamAWinner ? 'a' : isTeamBWinner ? 'b' : null}
                          middle={<ScoreBoard finished a={m.score_a} b={m.score_b} forfeit={m.is_forfeit} />}
                        />

                        <div className="flex items-center gap-2 text-xs text-stone-500 font-medium tracking-wide">
                          <Link
                            href={`/tournaments/${m.tournament_id}`}
                            className="hover:text-gold underline font-semibold transition-colors"
                          >
                            {m.tournaments?.name}
                          </Link>
                          <span>·</span>
                          <span>{roundLabel(m.round, roundCounts[m.tournament_id] || m.round)}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        <Link
                          href={`/tournaments/${m.tournament_id}`}
                          className="text-xs font-bold text-maroon hover:text-gold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>View Bracket</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
