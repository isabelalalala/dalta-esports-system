'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { NeedsAttentionItem } from '@/utils/types';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import { SectionLoading } from '@/components/PageLoading';
import { TriangleAlert } from 'lucide-react';

// What each kind of item is called, in the order they're shown (most urgent first)
const kindLabels: Record<string, string> = {
  result_disputed: 'Disputed result',
  result_confirmed: 'Result ready to approve',
  result_pending: 'Waiting for the other captain',
  no_checkin: 'No check-in',
};
const kindOrder = Object.keys(kindLabels);

const kindStyles: Record<string, string> = {
  result_disputed: 'bg-red-50 text-red-700 border-red-200',
  result_confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  result_pending: 'bg-amber-50 text-amber-800 border-amber-200',
  no_checkin: 'bg-stone-100 text-stone-700 border-stone-200',
};

// Staff dashboard: matches that need an organizer (from get_needs_attention()).
export default function NeedsAttention() {
  const supabase = createClient();
  const [items, setItems] = useState<NeedsAttentionItem[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('get_needs_attention');
        if (loadError) throw loadError;
        const rows = (data || []) as NeedsAttentionItem[];
        rows.sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));
        setItems(rows);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load matches that need attention'));
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [supabase]);

  return (
    <section className="w-full rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6 uppercase">
      <div className="flex items-center justify-between pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center">
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider">
              Needs Attention {items.length > 0 && <span className="ml-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-black">({items.length})</span>}
            </h2>
            <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
              Urgent matches and disputes requiring staff intervention
            </p>
          </div>
        </div>
      </div>

      {!loaded && <SectionLoading />}
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold tracking-wider">
          {error}
        </div>
      )}
      {loaded && !error && items.length === 0 && (
        <div className="p-8 rounded-2xl bg-stone-50/70 border border-stone-200/80 text-center">
          <p className="text-stone-500 text-xs font-bold tracking-wider">Nothing needs attention right now.</p>
        </div>
      )}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={`${item.kind}-${item.match_id}`}
              href={`/matches/${item.match_id}`}
              className="group rounded-2xl border border-stone-200/80 bg-stone-50/60 hover:bg-white hover:border-amber-500/40 hover:shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
                <span className={`shrink-0 px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${kindStyles[item.kind] ?? 'bg-stone-100 text-stone-700 border-stone-200'}`}>
                  {kindLabels[item.kind] ?? item.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block font-black text-stone-950 text-sm sm:text-base truncate group-hover:text-amber-700 transition-colors">
                    {item.team_a ?? 'TBD'} vs {item.team_b ?? 'TBD'}
                  </span>
                  <span className="block text-xs text-stone-500 font-medium mt-0.5">
                    {item.tournament_name} · {roundLabel(item.round, item.round_count)} · {item.detail}
                  </span>
                </div>
              </div>
              <span className="text-xs text-stone-500 font-semibold shrink-0">
                {formatDateTime(item.since)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
