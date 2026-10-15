'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match, MatchCheckin, MatchResultSubmission, MatchTeam } from '@/utils/types';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import CheckinSection from './CheckinSection';
import ResultSection from './ResultSection';

interface MatchTournament {
  id: string;
  name: string;
  game: string;
  checkin_window_minutes: number;
}

// Match page: check-in and result submission for captains and staff.
// Everyone logged in can view it.
export default function MatchPage() {
  const supabase = createClient();
  const params = useParams();
  const id = params?.id as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<MatchTournament | null>(null);
  const [teams, setTeams] = useState<MatchTeam[]>([]);
  const [checkins, setCheckins] = useState<MatchCheckin[]>([]);
  // Newest first; RLS returns them only to the two teams and staff
  const [submissions, setSubmissions] = useState<MatchResultSubmission[]>([]);
  const [roundCount, setRoundCount] = useState(1);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  // The current time, refreshed every 30 seconds for the check-in countdown
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Increase this to load everything again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);
        const { data: myRole } = await supabase.rpc('get_my_role');
        setRole(myRole ?? '');

        const { data: matchData, error: matchError } = await supabase
          .from('matches').select('*').eq('id', id).single();
        if (matchError) throw matchError;
        setMatch(matchData);

        const [tournamentRes, teamsRes, checkinsRes, roundsRes, resultsRes] = await Promise.all([
          supabase.from('tournaments').select('id, name, game, checkin_window_minutes').eq('id', matchData.tournament_id).single(),
          supabase.from('teams').select('id, name, captain_id')
            .in('id', [matchData.team_a_id, matchData.team_b_id].filter(Boolean)),
          supabase.from('match_checkins').select('*').eq('match_id', id),
          supabase.from('matches').select('round').eq('tournament_id', matchData.tournament_id)
            .order('round', { ascending: false }).limit(1),
          supabase.from('match_result_submissions').select('*').eq('match_id', id)
            .order('created_at', { ascending: false }),
        ]);
        if (tournamentRes.error) throw tournamentRes.error;
        if (teamsRes.error) throw teamsRes.error;
        if (checkinsRes.error) throw checkinsRes.error;
        if (resultsRes.error) throw resultsRes.error;
        setTournament(tournamentRes.data);
        setTeams(teamsRes.data || []);
        setCheckins(checkinsRes.data || []);
        setSubmissions(resultsRes.data || []);
        setRoundCount(roundsRes.data?.[0]?.round ?? matchData.round);
        setNow(Date.now());
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the match'));
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [supabase, id, reloadCount]);

  // Keep the countdown current
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Reload when this match, its check-ins or its results change (Supabase Realtime)
  useEffect(() => {
    if (!id) return;
    const reload = () => setReloadCount((n) => n + 1);
    const channel = supabase
      .channel(`match-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_checkins', filter: `match_id=eq.${id}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_result_submissions', filter: `match_id=eq.${id}` }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, id]);

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;
  if (!match || !tournament) {
    return <div className="min-h-screen bg-[#0a0a0c] text-red-400 p-10 text-center">{error || 'Match not found.'}</div>;
  }

  const teamA = teams.find((t) => t.id === match.team_a_id) ?? null;
  const teamB = teams.find((t) => t.id === match.team_b_id) ?? null;
  const isStaff = role === 'admin' || role === 'staff';
  const myTeamId = [teamA, teamB].find((t) => t?.captain_id === userId)?.id ?? null;
  const winnerName = match.winner_team_id === teamA?.id ? teamA?.name : match.winner_team_id === teamB?.id ? teamB?.name : null;

  const teamClass = (teamId: string | undefined) =>
    match.status === 'completed'
      ? match.winner_team_id === teamId ? 'text-[#00d2ff]' : 'text-gray-500'
      : 'text-white';

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href={`/tournaments/${tournament.id}`} className="inline-block text-[#00d2ff] hover:underline">
          ← {tournament.name}
        </Link>

        {/* Match header */}
        <div className="bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-6 space-y-4">
          <p className="text-xs uppercase font-bold text-gray-400 tracking-widest">
            {tournament.game} · {roundLabel(match.round, roundCount)} · Match {match.match_number}
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <p className={`text-2xl font-bold ${teamClass(teamA?.id)}`}>{teamA?.name ?? <span className="italic text-gray-500">TBD</span>}</p>
            <p className="text-3xl font-bold tabular-nums">
              {match.status === 'completed' && !match.is_forfeit
                ? `${match.score_a ?? '-'} : ${match.score_b ?? '-'}`
                : <span className="text-gray-500 text-xl">vs</span>}
            </p>
            <p className={`text-2xl font-bold ${teamClass(teamB?.id)}`}>{teamB?.name ?? <span className="italic text-gray-500">TBD</span>}</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-3 text-sm">
            <span className="text-gray-300">{formatDateTime(match.scheduled_at)}</span>
            {match.status === 'live' && (
              <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-2 py-0.5 rounded-full font-bold text-xs">LIVE</span>
            )}
            {match.status === 'completed' && winnerName && (
              <span className="text-[#00d2ff] font-semibold">
                {winnerName} won{match.is_forfeit ? ' by forfeit' : ''}
              </span>
            )}
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>}

        <CheckinSection
          match={match}
          windowMinutes={tournament.checkin_window_minutes}
          teamA={teamA}
          teamB={teamB}
          checkins={checkins}
          isStaff={isStaff}
          myTeamId={myTeamId}
          now={now}
          onChanged={() => setReloadCount((n) => n + 1)}
        />

        <ResultSection
          match={match}
          teamA={teamA}
          teamB={teamB}
          submissions={submissions}
          isStaff={isStaff}
          myTeamId={myTeamId}
          now={now}
          onChanged={() => setReloadCount((n) => n + 1)}
        />

        {isStaff && (
          <p className="text-sm text-gray-400">
            To change the time, status or score directly, use{' '}
            <Link href={`/tournaments/${tournament.id}/matches`} className="text-[#00d2ff] underline">Manage Matches</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
