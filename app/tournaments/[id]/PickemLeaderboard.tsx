'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { LeaderboardRow } from '@/utils/predictions';
import { SectionLoading } from '@/components/PageLoading';

// Pick'em leaderboard of one tournament (get_prediction_leaderboard: top 20 + your own row).
// limit = show only the first rows (the preview on the tournament page); your own row is
// always added when you're further down.
export default function PickemLeaderboard({ tournamentId, limit }: { tournamentId: string; limit?: number }) {
  const supabase = createClient();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('get_prediction_leaderboard', { p_tournament_id: tournamentId });
        if (loadError) throw loadError;
        setRows(((data || []) as LeaderboardRow[]).map((r) => ({
          ...r, rank: Number(r.rank), correct: Number(r.correct), decided: Number(r.decided), total: Number(r.total),
        })));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the leaderboard'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, tournamentId]);

  if (loading) return <SectionLoading label="Loading leaderboard..." />;
  if (error) return <p role="alert" className="text-red-300 text-sm">{error}</p>;
  if (rows.length === 0) {
    return <p className="text-gray-500">No picks yet. Pick the winners in the bracket to get on the board!</p>;
  }

  const top = limit ? rows.slice(0, limit) : rows;
  const me = rows.find((r) => r.is_me);
  const shown = me && !top.includes(me) ? [...top, me] : top;

  return (
    <ol className="divide-y divide-brown border border-brown bg-sitebg">
      {shown.map((r, i) => (
        <li
          key={`${r.rank}-${r.display_name}-${i}`}
          className={`flex items-center gap-3 px-3 py-2 ${r.is_me ? 'bg-gold/10' : ''} ${me === r && !top.includes(r) ? 'border-t-2 border-dashed border-brownlight' : ''}`}
        >
          <span className={`w-8 shrink-0 text-right font-bold tabular-nums ${r.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
            {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}
          </span>
          <span className="flex-1 min-w-0 truncate font-semibold">
            {r.display_name}
            {r.is_me && <span className="ml-2 text-xs text-gold">(you)</span>}
          </span>
          <span className="shrink-0 text-right text-sm">
            <span className="font-bold text-white tabular-nums">{r.correct}</span>
            <span className="text-gray-400"> correct</span>
            <span className="block text-xs text-gray-500 tabular-nums">
              {r.decided > 0 ? `${Math.round((r.correct / r.decided) * 100)}% of ${r.decided}` : `${r.total} pending`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
