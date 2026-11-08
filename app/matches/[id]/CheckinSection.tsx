'use client';

import SectionHint from '@/components/SectionHint';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match, MatchCheckin, MatchTeam } from '@/utils/types';
import { formatCountdown, getCheckinState, getCheckinWindow } from '@/utils/checkin';
import { CircleCheck, Hourglass } from 'lucide-react';

interface Props {
  match: Match;
  windowMinutes: number;
  teamA: MatchTeam | null;
  teamB: MatchTeam | null;
  checkins: MatchCheckin[];
  isStaff: boolean;
  // The team in this match that the logged-in user captains, if any
  myTeamId: string | null;
  now: number;
  onChanged: () => void;
}

const timeFormat: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' };

// Check-in status for both teams, the captain's "Check in" button,
// and "Declare forfeit" for staff once the match time has passed.
export default function CheckinSection({ match, windowMinutes, teamA, teamB, checkins, isStaff, myTeamId, now, onChanged }: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forfeitWinner, setForfeitWinner] = useState('');

  const state = getCheckinState(match.scheduled_at, windowMinutes, now);
  const checkinWindow = getCheckinWindow(match.scheduled_at, windowMinutes);
  const checkedIn = (teamId: string | undefined) => checkins.find((c) => c.team_id === teamId);
  const iCheckedIn = !!myTeamId && !!checkedIn(myTeamId);

  // Staff can give a forfeit win once the match time has passed (the database checks the same)
  const canForfeit =
    isStaff && match.status !== 'completed' && !!teamA && !!teamB &&
    !!match.scheduled_at && now >= new Date(match.scheduled_at).getTime();
  // Suggest the team that checked in, when exactly one did
  const suggestedWinner =
    checkedIn(teamA?.id) && !checkedIn(teamB?.id) ? teamA?.id
      : checkedIn(teamB?.id) && !checkedIn(teamA?.id) ? teamB?.id
        : '';
  const chosenWinner = forfeitWinner || suggestedWinner || '';

  const handleCheckIn = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: checkinError } = await supabase.rpc('check_in_match', { p_match_id: match.id });
      if (checkinError) throw checkinError;
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Check-in failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleForfeit = async () => {
    const winner = chosenWinner === teamA?.id ? teamA : teamB;
    if (!winner || !confirm(`Give ${winner.name} the win by forfeit? The match will be completed and ${winner.name} advances.`)) return;
    setBusy(true);
    setError('');
    try {
      const { error: forfeitError } = await supabase.rpc('declare_forfeit', {
        p_match_id: match.id,
        p_winner_team_id: winner.id,
      });
      if (forfeitError) throw forfeitError;
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to declare the forfeit'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-6 space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-1.5">Check-in <SectionHint text="Check-in — captains confirm their team is ready before the match. It opens shortly before the match time and closes when the match starts." /></h2>

      {state === 'off' && <p className="text-stone-500 text-sm">This tournament doesn&apos;t use check-in.</p>}
      {state === 'no_time' && <p className="text-stone-500 text-sm">Check-in opens once the match has a time.</p>}
      {checkinWindow && (
        <p className="text-stone-700 text-sm">
          Opens {new Date(checkinWindow.opensAt).toLocaleString(undefined, timeFormat)}, closes at the match time{' '}
          {new Date(checkinWindow.closesAt).toLocaleString(undefined, timeFormat)}.{' '}
          {state === 'not_open' && <span className="text-yellow-700">Opens {formatCountdown(checkinWindow.opensAt - now)}.</span>}
          {state === 'open' && <span className="text-emerald-700 font-semibold">Open now, closes {formatCountdown(checkinWindow.closesAt - now)}.</span>}
          {state === 'closed' && <span className="text-stone-500">Closed.</span>}
        </p>
      )}

      {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-700 px-4 py-3">{error}</div>}

      {state !== 'off' && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[teamA, teamB].map((team, i) => {
            const row = checkedIn(team?.id);
            return (
              <li key={i} className={`border p-3 ${row ? 'border-green-500/60 bg-green-500/10' : 'border-stone-200'}`}>
                <p className="font-semibold">{team?.name ?? <span className="italic text-stone-500">TBD</span>}</p>
                <p className={`text-sm inline-flex items-center gap-1.5 ${row ? 'text-emerald-700' : 'text-stone-500'}`}>
                  {row ? <CircleCheck className="h-4 w-4" /> : <Hourglass className="h-4 w-4" />}
                  {row
                    ? `Checked in ${new Date(row.checked_in_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                    : 'Not checked in'}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Captain of one of the teams (the database checks the captain and the window again) */}
      {myTeamId && state === 'open' && match.status === 'scheduled' && !iCheckedIn && (
        <button
          onClick={handleCheckIn}
          disabled={busy}
          className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark disabled:opacity-50"
        >
          {busy ? 'Checking in...' : 'Check in my team'}
        </button>
      )}

      {canForfeit && (
        <div className="border-t border-stone-200 pt-4 space-y-2">
          <p className="text-sm font-semibold text-yellow-700">Staff: declare a forfeit</p>
          <p className="text-xs text-stone-500">
            Use this when a team didn&apos;t show up. The match is completed without a score and the winner advances.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={chosenWinner}
              onChange={(e) => setForfeitWinner(e.target.value)}
              className="border border-stone-300 bg-white rounded-xl px-3 py-2 text-stone-950"
              aria-label="Forfeit winner"
            >
              <option value="">Choose the winner</option>
              {[teamA, teamB].map((t) => t && (
                <option key={t.id} value={t.id}>{t.name}{checkedIn(t.id) ? ' (checked in)' : ''}</option>
              ))}
            </select>
            <button
              onClick={handleForfeit}
              disabled={busy || !chosenWinner}
              className="border border-yellow-500 text-yellow-700 px-4 py-2 font-bold hover:bg-yellow-500/10 disabled:opacity-50"
            >
              Declare forfeit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
