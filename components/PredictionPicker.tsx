'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
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
    return <p className="text-xs sm:text-sm text-stone-500 font-medium uppercase tracking-wide">Picks open once both teams of this match are known.</p>;
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

  // Correct / Wrong once the match has a winner
  const verdict = mine && mine.is_correct !== null && (
    <span className={`inline-flex items-center gap-1 font-bold ${mine.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
      {mine.is_correct ? <><Check className="h-3.5 w-3.5" /> Correct</> : <><X className="h-3.5 w-3.5" /> Wrong</>}
    </span>
  );

  const buttonClass = (teamId: string) =>
    `min-w-0 flex-1 border font-black truncate rounded-xl transition-all disabled:opacity-50 uppercase tracking-wider ${compact ? 'px-2 py-1.5 text-[10px]' : 'px-3.5 py-2 text-xs'} ${
      mine?.predicted_winner_team_id === teamId
        ? 'border-amber-400 bg-gold text-stone-950 shadow-xs'
        : 'border-stone-200 bg-white text-stone-800 hover:border-amber-400 hover:bg-stone-50'
    }`;

  return (
    <div className={compact ? 'mt-1.5 space-y-1.5' : 'space-y-3'}>
      {/* Community split */}
      <div>
        {!compact && <p className="text-[11px] uppercase font-black text-stone-500 tracking-wider mb-1">Community Pick</p>}
        {split.total === 0 ? (
          <p className={`text-stone-400 font-semibold uppercase ${compact ? 'text-[10px]' : 'text-xs'}`}>No picks yet</p>
        ) : (
          <>
            <progress
              value={split.a}
              max={100}
              aria-label={`${split.a}% picked ${nameA}, ${split.b}% picked ${nameB}`}
              className={`w-full block appearance-none rounded-full overflow-hidden border border-stone-200 bg-stone-100 [&::-webkit-progress-bar]:bg-stone-100 [&::-webkit-progress-value]:bg-amber-400 [&::-moz-progress-bar]:bg-amber-400 ${compact ? 'h-1.5' : 'h-2.5'}`}
            />
            <p className={`flex justify-between gap-2 text-stone-600 font-bold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs mt-1'}`}>
              <span className="truncate">{split.a}%{compact ? '' : ` ${nameA}`}</span>
              {!compact && <span className="text-stone-400 shrink-0 font-medium">{split.total} {split.total === 1 ? 'pick' : 'picks'}</span>}
              <span className="truncate text-right">{split.b}%{compact ? '' : ` ${nameB}`}</span>
            </p>
          </>
        )}
      </div>

      {canPick && (
        <div className="flex gap-2">
          <button onClick={() => handlePick(teamA)} disabled={busy} className={buttonClass(teamA)} aria-pressed={mine?.predicted_winner_team_id === teamA}>
            {compact ? nameA : <>{mine?.predicted_winner_team_id === teamA && <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}{nameA} wins</>}
          </button>
          <button onClick={() => handlePick(teamB)} disabled={busy} className={buttonClass(teamB)} aria-pressed={mine?.predicted_winner_team_id === teamB}>
            {compact ? nameB : <>{mine?.predicted_winner_team_id === teamB && <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}{nameB} wins</>}
          </button>
        </div>
      )}

      {/* Your pick (also after the lock) and the result */}
      {mine && (
        <p className={`text-stone-600 font-semibold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Your pick: <span className="text-[#5B271E] font-black">{teamNames[mine.predicted_winner_team_id] ?? 'a team'}</span>
          {verdict && <> · {verdict}</>}
          {canPick && !compact && <span className="text-stone-400 font-medium"> (tap it again to remove it)</span>}
        </p>
      )}

      {note === 'login' ? (
        !compact && (
          <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
            <Link href="/auth/login" className="text-[#5B271E] font-black underline hover:text-[#FFCC37]">Log in</Link> to make your pick.
          </p>
        )
      ) : note && !compact ? (
        <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">{note}</p>
      ) : null}

      {error && <p role="alert" className={`text-red-600 font-bold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>{error}</p>}
    </div>
  );
}
