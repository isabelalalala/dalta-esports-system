'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { NeedsAttentionItem } from '@/utils/types';
import { formatDateTime, roundLabel } from '@/utils/tournaments';
import { SectionLoading } from '@/components/PageLoading';

// What each kind of item is called, in the order they're shown (most urgent first)
const kindLabels: Record<string, string> = {
  result_disputed: 'Disputed result',
  result_confirmed: 'Result ready to approve',
  result_pending: 'Waiting for the other captain',
  no_checkin: 'No check-in',
};
const kindOrder = Object.keys(kindLabels);

const kindStyles: Record<string, string> = {
  result_disputed: 'border-red-500/60 text-red-300',
  result_confirmed: 'border-green-500/60 text-green-300',
  result_pending: 'border-gray-500/60 text-gray-300',
  no_checkin: 'border-yellow-500/60 text-yellow-300',
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
    <section className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6 mt-8 space-y-3">
      <h2 className="text-xl font-bold text-gold">⚠️ Needs attention {items.length > 0 && `(${items.length})`}</h2>
      {!loaded && <SectionLoading />}
      {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
      {loaded && !error && items.length === 0 && <p className="text-gray-400 text-sm">Nothing needs attention right now.</p>}
      {items.length > 0 && (
        <ul className="divide-y divide-brown">
          {items.map((item) => (
            <li key={`${item.kind}-${item.match_id}`}>
              <Link href={`/matches/${item.match_id}`} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-white/5 px-2 -mx-2">
                <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase ${kindStyles[item.kind] ?? 'border-gray-500 text-gray-300'}`}>
                  {kindLabels[item.kind] ?? item.kind}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-white truncate">
                    {item.team_a ?? 'TBD'} vs {item.team_b ?? 'TBD'}
                  </span>
                  <span className="block text-sm text-gray-400">
                    {item.tournament_name} · {roundLabel(item.round, item.round_count)} · {item.detail}
                  </span>
                </span>
                <span className="text-xs text-gray-400 shrink-0">{formatDateTime(item.since)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
