'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Match, MatchStatus, Profile, Tournament } from '@/utils/types';
import { formatDateTime, fromDateTimeInput, isBye, roundLabel, toDateTimeInput } from '@/utils/tournaments';

const inputClass =
  'w-full rounded border border-[#00d2ff]/40 bg-[#0a0a0c] px-3 py-2 text-white outline-none focus:border-[#00d2ff] disabled:opacity-50';

export default function MatchManagementPage() {
  const supabase = createClient();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  // Team id -> team name, for the teams that appear in the bracket
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  // Match id -> how many teams checked in
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Increase this to make the effect below load everything again
  const [reloadCount, setReloadCount] = useState(0);

  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);

        const { data: tournamentData, error: tournError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();
        if (tournError) throw tournError;
        setTournament(tournamentData);

        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', id)
          .order('round')
          .order('match_number');
        if (matchesError) throw matchesError;
        setMatches(matchesData || []);

        // Look up the names of every team in the bracket in one query
        const teamIds = new Set<string>();
        for (const m of matchesData || []) {
          if (m.team_a_id) teamIds.add(m.team_a_id);
          if (m.team_b_id) teamIds.add(m.team_b_id);
        }
        if (teamIds.size > 0) {
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', [...teamIds]);
          if (teamsError) throw teamsError;
          setTeamNames(Object.fromEntries((teamsData || []).map((t) => [t.id, t.name])));
        }

        const matchIds = (matchesData || []).map((m) => m.id);
        if (matchIds.length > 0) {
          const { data: checkinsData, error: checkinsError } = await supabase
            .from('match_checkins')
            .select('match_id')
            .in('match_id', matchIds);
          if (checkinsError) throw checkinsError;
          const counts: Record<string, number> = {};
          for (const c of checkinsData || []) counts[c.match_id] = (counts[c.match_id] || 0) + 1;
          setCheckinCounts(counts);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load matches'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, supabase, reloadCount]);

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;
  if (!tournament) {
    return <div className="min-h-screen bg-[#0a0a0c] text-red-500 p-10 text-center">{error || 'Tournament not found.'}</div>;
  }

  // Hiding the page is only for convenience; the database refuses changes from other roles.
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">
        Only organizers can manage matches.{' '}
        <Link href={`/tournaments/${id}`} className="text-[#00d2ff] underline">Back to the tournament</Link>
      </div>
    );
  }

  const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <Link href={`/tournaments/${id}`} className="inline-block text-[#00d2ff] hover:underline mb-6">
          ← Back to Tournament
        </Link>

        <h1 className="text-4xl font-bold text-[#00d2ff]">{tournament.name}</h1>
        <p className="text-gray-400 text-lg mt-2 mb-8">Match Management</p>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>
        )}

        {matches.length === 0 ? (
          <div className="text-center bg-[#1a1a2e] border border-[#00d2ff]/20 rounded-xl p-12 text-gray-400">
            No bracket yet. Generate it from the Admin Panel on the tournament page.
          </div>
        ) : (
          <div className="space-y-10">
            {rounds.map((round) => (
              <section key={round}>
                <h2 className="text-2xl font-bold mb-4">{roundLabel(round, roundCount)}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {matches
                    .filter((m) => m.round === round)
                    .map((match) => (
                      // updated_at in the key resets the card's form after every save
                      <MatchCard
                        key={`${match.id}-${match.updated_at}`}
                        match={match}
                        teamNames={teamNames}
                        checkinCount={tournament.checkin_window_minutes > 0 ? checkinCounts[match.id] ?? 0 : null}
                        onSaved={() => setReloadCount((n) => n + 1)}
                      />
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One match with its own form. Saves schedule, status, scores and winner together.
function MatchCard({
  match,
  teamNames,
  checkinCount,
  onSaved,
}: {
  match: Match;
  teamNames: Record<string, string>;
  // Teams checked in (0-2), or null when the tournament has no check-in
  checkinCount: number | null;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [scheduledAt, setScheduledAt] = useState(toDateTimeInput(match.scheduled_at));
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [scoreA, setScoreA] = useState(match.score_a?.toString() ?? '');
  const [scoreB, setScoreB] = useState(match.score_b?.toString() ?? '');
  const [winner, setWinner] = useState(match.winner_team_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nameA = match.team_a_id ? teamNames[match.team_a_id] ?? 'Unknown team' : 'TBD';
  const nameB = match.team_b_id ? teamNames[match.team_b_id] ?? 'Unknown team' : 'TBD';
  const bothTeamsKnown = match.team_a_id !== null && match.team_b_id !== null;

  if (isBye(match)) {
    const team = match.team_a_id ?? match.team_b_id;
    return (
      <div className="bg-[#1a1a2e] border border-[#00d2ff]/20 rounded-lg p-4 text-gray-400">
        <p className="text-xs uppercase font-bold mb-1">Match {match.match_number} · Bye</p>
        <p>
          <span className="text-white font-semibold">{team ? teamNames[team] : 'Unknown team'}</span> advances automatically.
        </p>
      </div>
    );
  }

  // Picking a winner means the match is over; going back from "completed" clears the winner.
  const changeWinner = (value: string) => {
    setWinner(value);
    if (value) setStatus('completed');
  };
  const changeStatus = (value: MatchStatus) => {
    setStatus(value);
    if (value !== 'completed') setWinner('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // The database checks the rules (winner needs "completed", higher score wins,
      // results lock once the next match starts) and moves the winner forward.
      const { data, error: updateError } = await supabase
        .from('matches')
        .update({
          scheduled_at: fromDateTimeInput(scheduledAt),
          status,
          score_a: scoreA === '' ? null : Number(scoreA),
          score_b: scoreB === '' ? null : Number(scoreB),
          winner_team_id: winner || null,
        })
        .eq('id', match.id)
        .select('id');

      if (updateError) throw updateError;
      // RLS blocks silently (no error, no rows), so check that something was saved
      if (!data || data.length === 0) throw new Error('Only admin and staff can update matches.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save match'));
      setSaving(false);
    }
  };

  const statusColor =
    match.status === 'live' ? 'border-green-500' : match.status === 'completed' ? 'border-gray-600' : 'border-[#00d2ff]/40';

  return (
    <form onSubmit={handleSave} className={`bg-[#1a1a2e] border rounded-lg p-4 space-y-3 ${statusColor}`}>
      <div className="flex justify-between items-center gap-2">
        <p className="text-xs uppercase font-bold text-gray-400">
          Match {match.match_number}
          {match.is_forfeit && <span className="ml-2 text-yellow-300">Forfeit</span>}
        </p>
        <p className="text-xs text-gray-400">{formatDateTime(match.scheduled_at)}</p>
      </div>
      <div className="flex justify-between items-center gap-2 text-xs">
        {checkinCount !== null && bothTeamsKnown && match.status !== 'completed' ? (
          <span className={checkinCount === 2 ? 'text-green-300' : 'text-gray-400'}>Check-in: {checkinCount} / 2</span>
        ) : <span />}
        <Link href={`/matches/${match.id}`} className="text-[#00d2ff] hover:underline font-semibold">Open match →</Link>
      </div>

      {/* Teams and scores */}
      <div className="grid grid-cols-[1fr_5rem] gap-2 items-center">
        <span className={`font-semibold truncate ${match.winner_team_id === match.team_a_id && match.team_a_id ? 'text-[#00d2ff]' : ''}`}>
          {nameA}
        </span>
        <input
          type="number" min="0" value={scoreA} onChange={(e) => setScoreA(e.target.value)}
          placeholder="Score" disabled={!bothTeamsKnown} className={inputClass} aria-label={`Score for ${nameA}`}
        />
        <span className={`font-semibold truncate ${match.winner_team_id === match.team_b_id && match.team_b_id ? 'text-[#00d2ff]' : ''}`}>
          {nameB}
        </span>
        <input
          type="number" min="0" value={scoreB} onChange={(e) => setScoreB(e.target.value)}
          placeholder="Score" disabled={!bothTeamsKnown} className={inputClass} aria-label={`Score for ${nameB}`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-xs text-gray-400 sm:col-span-3">
          Date and time
          <input
            type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs text-gray-400">
          Status
          <select
            value={status} onChange={(e) => changeStatus(e.target.value as MatchStatus)}
            disabled={!bothTeamsKnown} className={`${inputClass} mt-1`}
          >
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="text-xs text-gray-400 sm:col-span-2">
          Winner
          <select
            value={winner} onChange={(e) => changeWinner(e.target.value)}
            disabled={!bothTeamsKnown} className={`${inputClass} mt-1`}
          >
            <option value="">No winner yet</option>
            {match.team_a_id && <option value={match.team_a_id}>{nameA}</option>}
            {match.team_b_id && <option value={match.team_b_id}>{nameB}</option>}
          </select>
        </label>
      </div>

      {!bothTeamsKnown && (
        <p className="text-xs text-gray-500">Waiting for earlier matches. You can already set the time.</p>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit" disabled={saving}
        className="bg-[#00d2ff] text-black px-4 py-2 rounded font-bold hover:bg-[#00b8e6] transition disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
