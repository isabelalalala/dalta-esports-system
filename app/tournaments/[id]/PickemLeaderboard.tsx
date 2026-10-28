'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { LeaderboardRow } from '@/utils/predictions';
import { SectionLoading } from '@/components/PageLoading';
import { Medal } from 'lucide-react';

// Gold, silver and bronze for the top three ranks
const medalColors = ['text-amber-500', 'text-stone-400', 'text-amber-700'];

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
  if (error) return <p role="alert" className="text-red-600 text-xs sm:text-sm font-bold uppercase">{error}</p>;
  if (rows.length === 0) {
    return <p className="text-stone-500 text-xs sm:text-sm font-medium uppercase tracking-wide">No picks yet. Pick the winners in the bracket to get on the board!</p>;
  }

  const top = limit ? rows.slice(0, limit) : rows;
  const me = rows.find((r) => r.is_me);
  const shown = me && !top.includes(me) ? [...top, me] : top;

  return (
    <ol className="divide-y divide-stone-100 border border-stone-200/90 rounded-2xl bg-white overflow-hidden shadow-2xs">
      {shown.map((r, i) => (
        <li
          key={`${r.rank}-${r.display_name}-${i}`}
          className={`flex items-center gap-3 px-4 py-3 uppercase tracking-wide transition-colors ${
            r.is_me ? 'bg-amber-500/10' : 'hover:bg-stone-50/70'
          } ${me === r && !top.includes(r) ? 'border-t-2 border-dashed border-stone-300' : ''}`}
        >
          <span className={`w-8 shrink-0 text-right font-black tabular-nums text-xs sm:text-sm ${r.rank <= 3 ? 'text-amber-600' : 'text-stone-400'}`}>
            {r.rank <= 3 ? <Medal className={`inline h-4 w-4 ${medalColors[r.rank - 1]}`} role="img" aria-label={`Rank ${r.rank}`} /> : `#${r.rank}`}
          </span>
          <span className="flex-1 min-w-0 truncate font-black text-xs sm:text-sm text-stone-900">
            {r.display_name}
            {r.is_me && <span className="ml-2 text-xs font-black text-[#5B271E]">(you)</span>}
          </span>
          <span className="shrink-0 text-right text-xs sm:text-sm">
            <span className="font-black text-stone-950 tabular-nums">{r.correct}</span>
            <span className="text-stone-500 font-semibold"> correct</span>
            <span className="block text-[11px] text-stone-400 font-bold tabular-nums">
              {r.decided > 0 ? `${Math.round((r.correct / r.decided) * 100)}% of ${r.decided}` : `${r.total} pending`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
