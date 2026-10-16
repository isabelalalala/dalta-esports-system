'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match, Tournament } from '@/utils/types';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import { fetchRoundCounts, fetchTeamNames } from '@/utils/matches';
import { SectionLoading } from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';

type ScheduleMatch = Match & { tournaments: { name: string } | null };

// How many upcoming matches and results to show
const LIST_LIMIT = 30;

// Match schedule and results across all tournaments (DFD 3.0: "Announcement and Match Update")
export default function SchedulePage() {
  const supabase = createClient();
  usePageTitle('Schedule');
  const [tournaments, setTournaments] = useState<Pick<Tournament, 'id' | 'name'>[]>([]);
  const [filter, setFilter] = useState('all');
  const [live, setLive] = useState<ScheduleMatch[]>([]);
  const [upcoming, setUpcoming] = useState<ScheduleMatch[]>([]);
  const [results, setResults] = useState<ScheduleMatch[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [roundCounts, setRoundCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: tournamentsData, error: tourError } = await supabase
          .from('tournaments')
          .select('id, name')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(tournamentsData || []);

        // Same base query for all three lists, optionally for one tournament
        const base = () => {
          const q = supabase.from('matches').select('*, tournaments(name)');
          return filter === 'all' ? q : q.eq('tournament_id', filter);
        };

        const [liveRes, upcomingRes, resultsRes] = await Promise.all([
          base().eq('status', 'live').order('scheduled_at'),
          // Soonest first; matches without a time yet go last
          base()
            .eq('status', 'scheduled')
            .order('scheduled_at', { ascending: true, nullsFirst: false })
            .limit(LIST_LIMIT),
          // Byes have only one team, so they aren't real results
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

        const all = [...liveRes.data, ...upcomingRes.data, ...resultsRes.data] as ScheduleMatch[];
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
  }, [supabase, filter]);

  const name = (teamId: string | null) => (teamId ? teamNames[teamId] ?? 'Unknown team' : 'TBD');

  // One match line. Results show the score, with the winner highlighted.
  const renderMatch = (m: ScheduleMatch, showScore: boolean) => {
    const teamClass = (teamId: string | null) =>
      m.status === 'completed'
        ? m.winner_team_id === teamId ? 'text-gold font-bold' : 'text-gray-400'
        : teamId ? 'text-white font-semibold' : 'italic text-gray-400';

    return (
      <li key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div className="min-w-0">
          <p>
            <span className={teamClass(m.team_a_id)}>{name(m.team_a_id)}</span>
            {showScore && m.is_forfeit ? (
              <span className="mx-2 text-yellow-300 text-sm">forfeit</span>
            ) : showScore ? (
              <span className="mx-2 tabular-nums text-white">{m.score_a ?? '-'} : {m.score_b ?? '-'}</span>
            ) : (
              <span className="mx-2 text-gray-400">vs</span>
            )}
            <span className={teamClass(m.team_b_id)}>{name(m.team_b_id)}</span>
          </p>
          <p className="text-sm text-gray-400">
            <Link href={`/tournaments/${m.tournament_id}`} className="underline hover:text-white">
              {m.tournaments?.name}
            </Link>
            {' · '}{roundLabel(m.round, roundCounts[m.tournament_id] || m.round)}
          </p>
        </div>
        <p className="text-sm text-gray-300 sm:text-right shrink-0">
          {m.status === 'live' ? (
            <span className="text-green-400 font-bold">● LIVE</span>
          ) : (
            formatDateTime(m.scheduled_at)
          )}
        </p>
      </li>
    );
  };

  const section = (title: string, list: ScheduleMatch[], emptyText: string, showScore: boolean) => (
    <section className="bg-sitecard border border-brownlight p-6">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      {list.length === 0 ? (
        <p className="text-gray-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-brown">{list.map((m) => renderMatch(m, showScore))}</ul>
      )}
    </section>
  );

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/dashboard" className="inline-block text-gold hover:underline">
          ← Back to Dashboard
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Schedule &amp; Results</h1>

        <select
          value={filter}
          onChange={(e) => { setLoading(true); setFilter(e.target.value); }}
          className="w-full border border-brownlight bg-sitebg px-4 py-3 text-white outline-none focus:border-gold"
          aria-label="Filter by tournament"
        >
          <option value="all">All tournaments</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}

        {loading ? (
          <div className="py-12 grid place-items-center"><SectionLoading /></div>
        ) : (
          <>
            {live.length > 0 && section('🔴 Live now', live, '', true)}
            {section('Upcoming matches', upcoming, 'No upcoming matches scheduled.', false)}
            {section('Recent results', results, 'No results yet.', true)}
          </>
        )}
      </div>
    </main>
  );
}
