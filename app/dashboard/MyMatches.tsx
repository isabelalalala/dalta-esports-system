'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match } from '@/utils/types';
import { formatDateTime, roundLabel } from '@/utils/tournaments';

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
    <div className="mt-8 bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-6">
      <h2 className="text-xl font-bold text-[#00d2ff] mb-4">⚔️ My Matches</h2>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : error ? (
        <p className="text-red-300">{error}</p>
      ) : matches.length === 0 ? (
        <p className="text-gray-400">
          {myTeamIds.length === 0 ? 'You are not on a team yet.' : 'No upcoming matches.'}
        </p>
      ) : (
        <ul className="divide-y divide-[#00d2ff]/20">
          {matches.map((m) => {
            // Which side is mine decides who the opponent is
            const mineIsA = m.team_a_id !== null && myTeamIds.includes(m.team_a_id);
            const myTeam = mineIsA ? m.team_a_id : m.team_b_id;
            const opponent = mineIsA ? m.team_b_id : m.team_a_id;

            return (
              <li key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">
                    {myTeam ? teamNames[myTeam] : 'Your team'}{' '}
                    <span className="text-gray-400 font-normal">vs</span>{' '}
                    {opponent ? teamNames[opponent] ?? 'Unknown team' : <span className="italic text-gray-500">TBD</span>}
                    {m.status === 'live' && (
                      <span className="ml-2 text-xs bg-green-500/20 text-green-400 border border-green-500/50 px-2 py-0.5 rounded-full font-bold">
                        LIVE
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400">
                    <Link href={`/tournaments/${m.tournament_id}`} className="hover:text-white underline">
                      {m.tournaments?.name}
                    </Link>{' '}
                    · {roundLabel(m.round, roundCounts[m.tournament_id] || m.round)}
                  </p>
                </div>
                <p className="text-sm text-gray-300 sm:text-right">{formatDateTime(m.scheduled_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
