'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePredictions } from '@/components/PredictionsProvider';
import { canBePicked, picksOpen, splitPercents, type PickMatch } from '@/utils/predictions';

// Pick'em for one match: the community split (e.g. 62% / 38%) and, for logged-in audience
// members, two buttons to pick the winner. Must be inside <PredictionsProvider>.
// compact = the small version under each bracket box.
export default function PredictionPicker({
  match,
  teamNames,
  compact = false,
}: {
  match: PickMatch;
  teamNames: Record<string, string>;
  compact?: boolean;
}) {
  const state = usePredictions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!state || !canBePicked(match)) {
    if (compact) return null;
    return <p className="text-sm text-gray-400">Picks open once both teams of this match are known.</p>;
  }

  const teamA = match.team_a_id!;
  const teamB = match.team_b_id!;
  const nameA = teamNames[teamA] ?? 'Team A';
  const nameB = teamNames[teamB] ?? 'Team B';
  const split = splitPercents(state.splits[match.id], teamA, teamB);
  const mine = state.myPicks[match.id];
  const open = state.loaded && state.now > 0 && picksOpen(match, state.now);
  const ownMatch = state.myTeamIds.includes(teamA) || state.myTeamIds.includes(teamB);
  const canPick = open && state.loggedIn && !state.isOrganizer && !ownMatch;

  const handlePick = async (teamId: string) => {
    setBusy(true);
    setError('');
    const message = await state.pick(match.id, teamId);
    if (message) setError(message);
    setBusy(false);
  };

  // Why the buttons aren't shown (empty = they are)
  let note = '';
  if (!state.loaded) note = '';
  else if (!open) note = match.status === 'scheduled' ? 'Picks are closed (match time reached).' : 'Picks are closed.';
  else if (!state.loggedIn) note = 'login';
  else if (state.isOrganizer) note = "Organizers can't pick.";
  else if (ownMatch) note = "You can't pick your own team's match.";

  // ✓ / ✗ once the match has a winner
  const verdict = mine && mine.is_correct !== null && (
    <span className={mine.is_correct ? 'text-green-300 font-bold' : 'text-red-300 font-bold'}>
      {mine.is_correct ? '✓ Correct' : '✗ Wrong'}
    </span>
  );

  const buttonClass = (teamId: string) =>
    `min-w-0 flex-1 border-2 font-bold truncate disabled:opacity-50 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'} ${
      mine?.predicted_winner_team_id === teamId
        ? 'border-gold bg-gold text-black'
        : 'border-brownlight text-white hover:border-gold'
    }`;

  return (
    <div className={compact ? 'mt-1 space-y-1' : 'space-y-3'}>
      {/* Community split: gold = team A, brown = team B */}
      <div>
        {!compact && <p className="text-xs uppercase font-bold text-gray-400 mb-1">Community pick</p>}
        {split.total === 0 ? (
          <p className={`text-gray-400 ${compact ? 'text-[11px]' : 'text-sm'}`}>No picks yet</p>
        ) : (
          <>
            {/* A native progress bar (no inline styles): the gold part is team A's share */}
            <progress
              value={split.a}
              max={100}
              aria-label={`${split.a}% picked ${nameA}, ${split.b}% picked ${nameB}`}
              className={`w-full block appearance-none border border-brown bg-brownlight [&::-webkit-progress-bar]:bg-brownlight [&::-webkit-progress-value]:bg-gold [&::-moz-progress-bar]:bg-gold ${compact ? 'h-1.5' : 'h-3'}`}
            />
            <p className={`flex justify-between gap-2 text-gray-300 ${compact ? 'text-[11px]' : 'text-sm mt-1'}`}>
              <span className="truncate">{split.a}%{compact ? '' : ` ${nameA}`}</span>
              {!compact && <span className="text-gray-400 shrink-0">{split.total} {split.total === 1 ? 'pick' : 'picks'}</span>}
              <span className="truncate text-right">{split.b}%{compact ? '' : ` ${nameB}`}</span>
            </p>
          </>
        )}
      </div>

      {canPick && (
        <div className="flex gap-2">
          <button onClick={() => handlePick(teamA)} disabled={busy} className={buttonClass(teamA)} aria-pressed={mine?.predicted_winner_team_id === teamA}>
            {compact ? nameA : `${mine?.predicted_winner_team_id === teamA ? '✓ ' : ''}${nameA} wins`}
          </button>
          <button onClick={() => handlePick(teamB)} disabled={busy} className={buttonClass(teamB)} aria-pressed={mine?.predicted_winner_team_id === teamB}>
            {compact ? nameB : `${mine?.predicted_winner_team_id === teamB ? '✓ ' : ''}${nameB} wins`}
          </button>
        </div>
      )}

      {/* Your pick (also after the lock) and the result */}
      {mine && (
        <p className={`text-gray-300 ${compact ? 'text-[11px]' : 'text-sm'}`}>
          Your pick: <span className="text-gold font-semibold">{teamNames[mine.predicted_winner_team_id] ?? 'a team'}</span>
          {verdict && <> · {verdict}</>}
          {canPick && !compact && <span className="text-gray-400"> (tap it again to remove it)</span>}
        </p>
      )}

      {note === 'login' ? (
        !compact && (
          <p className="text-sm text-gray-400">
            <Link href="/auth/login" className="text-gold underline">Log in</Link> to make your pick.
          </p>
        )
      ) : note && !compact ? (
        <p className="text-sm text-gray-400">{note}</p>
      ) : null}

      {error && <p role="alert" className={`text-red-300 ${compact ? 'text-[11px]' : 'text-sm'}`}>{error}</p>}
    </div>
  );
}
