import type { ReactNode } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import type { Match } from '@/utils/types';
import { formatDateTime, isBye, roundLabel } from '@/utils/tournaments';

// Public single-elimination bracket: one column per round.
// On small screens the columns scroll sideways, so each match card keeps a readable width.
export default function Bracket({
  matches,
  teamNames,
  timeZone,
  matchHref,
  renderBelow,
}: {
  matches: Match[];
  teamNames: Record<string, string>;
  // Set on server-rendered pages ('Asia/Manila'); otherwise the viewer's time zone
  timeZone?: string;
  // Makes each match a link (the public match page)
  matchHref?: (match: Match) => string;
  // Extra content under each match box (the pick'em picker), outside the match link
  renderBelow?: (match: Match) => ReactNode;
}) {
  const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  const final = matches.find((m) => m.round === roundCount);
  const champion = final?.winner_team_id ? teamNames[final.winner_team_id] : null;

  return (
    <div className="w-full">
      {champion && (
        <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-400/80 text-amber-950 px-5 py-3.5 text-center font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs">
          <Trophy className="h-5 w-5 text-amber-600" /> Champion: {champion}
        </div>
      )}

      <div className="overflow-x-auto pb-4 -mx-2 px-2 snap-x">
        <div className="flex gap-4 sm:gap-6 min-w-max">
          {rounds.map((round) => (
            <div key={round} className="w-60 shrink-0 snap-start flex flex-col">
              <h3 className="text-center text-xs font-black uppercase text-stone-500 tracking-widest mb-3">
                {roundLabel(round, roundCount)}
              </h3>
              {/* justify-around spaces later rounds out so they line up between the matches feeding them */}
              <div className="flex flex-col justify-around gap-4 grow">
                {matches
                  .filter((m) => m.round === round)
                  .map((match) => (
                    <div key={match.id} className="space-y-1.5">
                      {matchHref && !isBye(match) ? (
                        <Link href={matchHref(match)} className="block hover:-translate-y-0.5 transition-transform">
                          <MatchBox match={match} teamNames={teamNames} timeZone={timeZone} />
                        </Link>
                      ) : (
                        <MatchBox match={match} teamNames={teamNames} timeZone={timeZone} />
                      )}
                      {renderBelow?.(match)}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchBox({ match, teamNames, timeZone }: { match: Match; teamNames: Record<string, string>; timeZone?: string }) {
  const bye = isBye(match);

  // One row per team: name, score, and whether it won
  const rows = [
    { teamId: match.team_a_id, score: match.score_a },
    { teamId: match.team_b_id, score: match.score_b },
  ];

  return (
    <div
      className={`rounded-2xl border text-xs sm:text-sm overflow-hidden shadow-2xs transition-all bg-white ${
        match.status === 'live'
          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
          : 'border-stone-200/90 hover:border-amber-400/80 hover:shadow-xs'
      }`}
    >
      {rows.map(({ teamId, score }, i) => {
        const won = teamId !== null && match.winner_team_id === teamId;
        const lost = match.status === 'completed' && !won;
        const name = teamId ? teamNames[teamId] ?? 'Unknown team' : bye ? 'BYE' : 'TBD';

        return (
          <div
            key={i}
            className={`flex justify-between items-center gap-2 px-3.5 py-2.5 ${i === 0 ? 'border-b border-stone-100' : ''} ${
              won
                ? 'text-[#5B271E] font-black bg-amber-500/5'
                : lost
                ? 'text-stone-400 font-semibold'
                : 'text-stone-900 font-bold'
            } ${teamId === null ? 'italic text-stone-400' : ''}`}
          >
            <span className="truncate uppercase">{name}</span>
            <span className="tabular-nums font-black">{won && match.is_forfeit ? 'FF' : score ?? ''}</span>
          </div>
        );
      })}
      <div className="px-3.5 py-1.5 bg-stone-50 border-t border-stone-100 text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase flex justify-between gap-2 tracking-wider">
        <span>{bye ? 'Advances automatically' : formatDateTime(match.scheduled_at, timeZone)}</span>
        {match.status === 'live' && <span className="text-emerald-600 font-black animate-pulse">LIVE</span>}
      </div>
    </div>
  );
}
