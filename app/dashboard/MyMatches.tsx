'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match } from '@/utils/types';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import { SectionLoading } from '@/components/PageLoading';
import { Swords } from 'lucide-react';

type UpcomingMatch = Match & { tournaments: { name: string } | null };

// Upcoming (scheduled or live) matches of every team the player is on
export default function MyMatches({ userId }: { userId: string }) {
  const supabase = createClient();
  const [matches, setMatches] = useState<UpcomingMatch[]>([]);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  // Number of rounds per tournament, to label rounds "Final", "Semifinals", ...
  const [roundCounts, setRoundCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Teams I'm on
        const { data: memberRows, error: membersError } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', userId);
        if (membersError) throw membersError;

        const teamIds = (memberRows || []).map((r) => r.team_id as string);
        setMyTeamIds(teamIds);
        if (teamIds.length === 0) return;

        // 2. Their matches that haven't finished, soonest first (no time set = last)
        const idList = teamIds.join(',');
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*, tournaments(name)')
          .or(`team_a_id.in.(${idList}),team_b_id.in.(${idList})`)
          .in('status', ['scheduled', 'live'])
          .order('scheduled_at', { ascending: true, nullsFirst: false });
        if (matchError) throw matchError;

        const upcoming = (matchData || []) as UpcomingMatch[];
        setMatches(upcoming);
        if (upcoming.length === 0) return;

        // 3. Names of my teams and the opponents
        const ids = new Set<string>();
        for (const m of upcoming) {
          if (m.team_a_id) ids.add(m.team_a_id);
          if (m.team_b_id) ids.add(m.team_b_id);
        }
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', [...ids]);
        if (teamsError) throw teamsError;
        setTeamNames(Object.fromEntries((teamsData || []).map((t) => [t.id, t.name])));

        // 4. Round count of each tournament (the highest round number is the final)
        const tournamentIds = [...new Set(upcoming.map((m) => m.tournament_id))];
        const { data: roundsData, error: roundsError } = await supabase
          .from('matches')
          .select('tournament_id, round')
          .in('tournament_id', tournamentIds);
        if (roundsError) throw roundsError;

        const counts: Record<string, number> = {};
        for (const r of roundsData || []) {
          counts[r.tournament_id] = Math.max(counts[r.tournament_id] || 0, r.round);
        }
        setRoundCounts(counts);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load your matches'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, userId]);

  return (
    <section className="w-full rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6 uppercase">
      <div className="flex justify-between items-center pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider">
              My Matches
            </h2>
            <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
              Upcoming scheduled and live tournament matches
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <SectionLoading label="Loading your matches..." />
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold tracking-wider" role="alert">
          {error}
        </div>
      ) : matches.length === 0 ? (
        <div className="p-8 rounded-2xl bg-stone-50/70 border border-stone-200/80 text-center">
          <p className="text-stone-500 text-xs font-bold tracking-wider">
            {myTeamIds.length === 0 ? 'You are not on an active team yet.' : 'No upcoming matches scheduled.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const mineIsA = m.team_a_id !== null && myTeamIds.includes(m.team_a_id);
            const myTeam = mineIsA ? m.team_a_id : m.team_b_id;
            const opponent = mineIsA ? m.team_b_id : m.team_a_id;

            return (
              <div
                key={m.id}
                className="rounded-2xl border border-stone-200/90 bg-stone-50/60 hover:bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:shadow-xs hover:border-amber-500/40"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-stone-950 text-sm sm:text-base tracking-wide">
                      {myTeam ? teamNames[myTeam] : 'Your team'}{' '}
                      <span className="text-stone-400 font-normal">vs</span>{' '}
                      {opponent ? teamNames[opponent] ?? 'Unknown team' : <span className="italic text-stone-400">TBD</span>}
                    </span>
                    {m.status === 'live' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-[10px] font-black tracking-wider animate-pulse">
                        LIVE NOW
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 font-semibold tracking-wider">
                    <Link href={`/tournaments/${m.tournament_id}`} className="hover:text-amber-700 underline transition-colors">
                      {m.tournaments?.name}
                    </Link>{' '}
                    · {roundLabel(m.round, roundCounts[m.tournament_id] || m.round)}
                  </p>
                </div>
                <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                  <span className="text-xs text-stone-600 font-semibold tracking-wider">
                    {formatDateTime(m.scheduled_at)}
                  </span>
                  <Link
                    href={`/matches/${m.id}`}
                    className="inline-flex items-center gap-1 text-xs font-black text-amber-700 hover:text-amber-800 tracking-wider hover:underline"
                  >
                    Match page (check-in, result) →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
