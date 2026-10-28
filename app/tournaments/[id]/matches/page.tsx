'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Match, MatchStatus, Profile, Tournament } from '@/utils/types';
import { formatDateTime, fromDateTimeInput, isBye, roundLabel, toDateTimeInput } from '@/utils/tournaments';
import ExportButtons from '@/components/ExportButtons';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { AlertCircle, Calendar, CheckCircle2, ChevronRight, Swords } from 'lucide-react';

const inputClass =
  'w-full border border-stone-300 bg-stone-50 px-3 py-2 text-stone-950 font-bold text-xs uppercase rounded-xl outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 transition-all';

export default function MatchManagementPage() {
  usePageTitle('Tournament matches');
  const supabase = createClient();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);

        const [tournRes, matchesRes] = await Promise.all([
          supabase.from('tournaments').select('*').eq('id', id).single(),
          supabase.from('matches').select('*').eq('tournament_id', id).order('round').order('match_number'),
        ]);
        if (tournRes.error) throw tournRes.error;
        setTournament(tournRes.data);
        const matchesData = matchesRes.data;
        if (matchesRes.error) throw matchesRes.error;
        setMatches(matchesData || []);

        const bracketTeamIds = new Set<string>();
        for (const m of matchesData || []) {
          if (m.team_a_id) bracketTeamIds.add(m.team_a_id);
          if (m.team_b_id) bracketTeamIds.add(m.team_b_id);
        }
        if (bracketTeamIds.size > 0) {
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', [...bracketTeamIds]);
          if (teamsError) throw teamsError;
          setTeamNames(Object.fromEntries((teamsData || []).map((t) => [t.id, t.name])));
        }

        if (tournRes.data.checkin_window_minutes > 0 && (matchesData || []).length > 0) {
          const matchIds = (matchesData || []).map((m) => m.id);
          const { data: checkinRows } = await supabase
            .from('match_checkins')
            .select('match_id')
            .in('match_id', matchIds);
          const counts: Record<string, number> = {};
          for (const row of checkinRows || []) {
            counts[row.match_id] = (counts[row.match_id] || 0) + 1;
          }
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

  if (loading) return <PageLoading label="Loading matches..." />;
  if (!tournament) {
    return <PageError message={error || 'Tournament not found'} backHref="/tournaments" backLabel="Back to Tournaments" />;
  }

  const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Tournament
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-[#FFCC37]" /> Match Management
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            {tournament.name} Matches
          </h1>
          <p
            className="text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Schedule fixtures, record official match scores, and declare advancing winners.
          </p>
        </div>
      </section>

      {/* 2. Controls & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ExportButtons type="matches" label="Schedule & results" params={{ tournament: id }} />
        <span className="text-xs font-black text-stone-600 uppercase tracking-wider">
          {matches.length} Total Matches · {roundCount} Rounds
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {matches.length === 0 && !error ? (
        <div className="rounded-3xl border border-stone-200/90 bg-white p-12 text-center shadow-xs">
          <p className="text-stone-500 text-sm font-black uppercase tracking-wider">
            No bracket generated yet. Generate it from the Organizer Panel on the tournament page.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {rounds.map((round) => (
            <section key={round} className="space-y-4">
              <div className="border-b border-stone-200/90 pb-3">
                <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Playoff Stage</span>
                <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
                  {roundLabel(round, roundCount)}
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                {matches
                  .filter((m) => m.round === round)
                  .map((match) => (
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
  );
}

function MatchCard({
  match,
  teamNames,
  checkinCount,
  onSaved,
}: {
  match: Match;
  teamNames: Record<string, string>;
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
      <div className="rounded-2xl border border-stone-200/90 bg-stone-50/70 p-5 text-stone-500 shadow-2xs space-y-1">
        <p className="text-[11px] uppercase font-black tracking-widest text-[#5B271E]">Match {match.match_number} · Bye</p>
        <p className="text-xs sm:text-sm font-black text-stone-950 uppercase tracking-wide">
          <span>{team ? teamNames[team] : 'Unknown team'}</span> advances automatically.
        </p>
      </div>
    );
  }

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
      if (!data || data.length === 0) throw new Error('Only admin and staff can update matches.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save match'));
      setSaving(false);
    }
  };

  const statusBorder =
    match.status === 'live'
      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
      : match.status === 'completed'
      ? 'border-stone-200/90 bg-stone-50/40'
      : 'border-stone-200/90 bg-white';

  return (
    <form onSubmit={handleSave} className={`rounded-3xl border p-5 sm:p-6 space-y-4 shadow-xs transition-all ${statusBorder}`}>
      <div className="flex justify-between items-center gap-2 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black tracking-widest text-stone-600 uppercase">
            Match {match.match_number}
          </span>
          {match.is_forfeit && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 border border-amber-500/30">
              Forfeit
            </span>
          )}
          {match.status === 'live' && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 animate-pulse">
              LIVE
            </span>
          )}
        </div>
        <p className="text-xs text-stone-500 font-bold">{formatDateTime(match.scheduled_at)}</p>
      </div>

      <div className="flex justify-between items-center gap-2 text-xs">
        {checkinCount !== null && bothTeamsKnown && match.status !== 'completed' ? (
          <span className={`font-bold tracking-wider ${checkinCount === 2 ? 'text-emerald-700' : 'text-stone-500'}`}>
            Check-in: {checkinCount} / 2
          </span>
        ) : <span />}
        <Link href={`/matches/${match.id}`} className="text-xs font-black text-[#5B271E] hover:text-[#FFCC37] uppercase tracking-wider inline-flex items-center gap-1">
          <span>Open Match</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Teams and scores */}
      <div className="grid grid-cols-[1fr_5rem] gap-3 items-center">
        <span className={`font-black text-xs sm:text-sm uppercase tracking-wide truncate ${match.winner_team_id === match.team_a_id && match.team_a_id ? 'text-[#5B271E]' : 'text-stone-950'}`}>
          {nameA}
        </span>
        <input
          type="number"
          min="0"
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value)}
          placeholder="Score"
          disabled={!bothTeamsKnown}
          className={inputClass}
          aria-label={`Score for ${nameA}`}
        />
        <span className={`font-black text-xs sm:text-sm uppercase tracking-wide truncate ${match.winner_team_id === match.team_b_id && match.team_b_id ? 'text-[#5B271E]' : 'text-stone-950'}`}>
          {nameB}
        </span>
        <input
          type="number"
          min="0"
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value)}
          placeholder="Score"
          disabled={!bothTeamsKnown}
          className={inputClass}
          aria-label={`Score for ${nameB}`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-[11px] font-black uppercase text-stone-600 tracking-wider sm:col-span-3">
          Date and Time
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-[11px] font-black uppercase text-stone-600 tracking-wider">
          Status
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as MatchStatus)}
            disabled={!bothTeamsKnown}
            className={`${inputClass} mt-1`}
          >
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="text-[11px] font-black uppercase text-stone-600 tracking-wider sm:col-span-2">
          Winner
          <select
            value={winner}
            onChange={(e) => changeWinner(e.target.value)}
            disabled={!bothTeamsKnown}
            className={`${inputClass} mt-1`}
          >
            <option value="">No winner yet</option>
            {match.team_a_id && <option value={match.team_a_id}>{nameA}</option>}
            {match.team_b_id && <option value={match.team_b_id}>{nameB}</option>}
          </select>
        </label>
      </div>

      {!bothTeamsKnown && (
        <p className="text-[11px] text-stone-500 font-semibold tracking-wider">
          Waiting for feeder match results. You can already schedule date and time.
        </p>
      )}

      {error && <p role="alert" className="text-xs font-bold text-red-600 uppercase tracking-wider">{error}</p>}

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Match'}
        </button>
      </div>
    </form>
  );
}
