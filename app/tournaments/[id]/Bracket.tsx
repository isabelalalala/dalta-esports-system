import type { Match } from '@/utils/types';
import { formatDateTime, isBye, roundLabel } from '@/utils/tournaments';

// Public single-elimination bracket: one column per round.
// On small screens the columns scroll sideways, so each match card keeps a readable width.
export default function Bracket({
  matches,
  teamNames,
}: {
  matches: Match[];
  teamNames: Record<string, string>;
}) {
  const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  const final = matches.find((m) => m.round === roundCount);
  const champion = final?.winner_team_id ? teamNames[final.winner_team_id] : null;

  return (
    <div>
      {champion && (
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500 text-yellow-300 px-4 py-3 rounded-lg text-center font-bold">
          🏆 Champion: {champion}
        </div>
      )}

      <div className="overflow-x-auto pb-2 -mx-2 px-2 snap-x">
        <div className="flex gap-4 min-w-max">
          {rounds.map((round) => (
            <div key={round} className="w-56 shrink-0 snap-start flex flex-col">
              <h3 className="text-center text-sm font-bold uppercase text-gray-400 mb-3">
                {roundLabel(round, roundCount)}
              </h3>
              {/* justify-around spaces later rounds out so they line up between the matches feeding them */}
              <div className="flex flex-col justify-around gap-3 grow">
                {matches
                  .filter((m) => m.round === round)
                  .map((match) => (
                    <MatchBox key={match.id} match={match} teamNames={teamNames} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchBox({ match, teamNames }: { match: Match; teamNames: Record<string, string> }) {
  const bye = isBye(match);

  // One row per team: name, score, and whether it won
  const rows = [
    { teamId: match.team_a_id, score: match.score_a },
    { teamId: match.team_b_id, score: match.score_b },
  ];

  return (
    <div
      className={`bg-[#0a0a0c] rounded-lg border text-sm overflow-hidden ${
        match.status === 'live' ? 'border-green-500' : 'border-[#00d2ff]/30'
      }`}
    >
      {rows.map(({ teamId, score }, i) => {
        const won = teamId !== null && match.winner_team_id === teamId;
        const lost = match.status === 'completed' && !won;
        const name = teamId ? teamNames[teamId] ?? 'Unknown team' : bye ? 'BYE' : 'TBD';

        return (
          <div
            key={i}
            className={`flex justify-between items-center gap-2 px-3 py-2 ${i === 0 ? 'border-b border-[#00d2ff]/15' : ''} ${
              won ? 'text-[#00d2ff] font-bold' : lost ? 'text-gray-500' : 'text-white'
            } ${teamId === null ? 'italic text-gray-500' : ''}`}
          >
            <span className="truncate">{name}</span>
            <span className="tabular-nums">{won && match.is_forfeit ? 'FF' : score ?? ''}</span>
          </div>
        );
      })}
      <div className="px-3 py-1 bg-[#1a1a2e] text-[11px] text-gray-400 flex justify-between gap-2">
        <span>{bye ? 'Advances automatically' : formatDateTime(match.scheduled_at)}</span>
        {match.status === 'live' && <span className="text-green-400 font-bold">LIVE</span>}
      </div>
    </div>
  );
}
