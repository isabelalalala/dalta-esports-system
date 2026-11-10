'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatMomentDate } from '@/utils/tournaments';
import GameBadge from '@/components/GameBadge';

interface Title { tournament_id: string; tournament_name: string; game_id: string; team_name: string; decided_at: string }

// "Champion" achievement chips on your own profile: every tournament you won (you were on the
// champion's roster when the final was decided; get_my_titles(), Hall of Fame). Nothing when you
// have no titles yet (or before the migration has run).
export default function MyTitles() {
  const [titles, setTitles] = useState<Title[]>([]);

  useEffect(() => {
    let cancelled = false;
    createClient().rpc('get_my_titles').then(({ data, error }) => {
      if (!cancelled && !error && data) setTitles(data as Title[]);
    });
    return () => { cancelled = true; };
  }, []);

  if (titles.length === 0) return null;

  return (
    <section className="bg-white border border-gold/60 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4" aria-labelledby="titles-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titles-title" className="inline-flex items-center gap-2 text-lg font-black uppercase tracking-wider text-stone-950">
          <Trophy className="size-5 text-gold" aria-hidden="true" /> Achievements
        </h2>
        <Link href="/hall-of-fame" className="text-xs font-black uppercase tracking-widest text-maroon hover:underline">Hall of Fame →</Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {titles.map((t) => (
          <li key={t.tournament_id}>
            <Link
              href={`/t/${t.tournament_id}`}
              className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-gold/15 py-1 pl-1 pr-3 text-xs font-bold text-stone-950 hover:bg-gold/25"
              title={`${t.team_name} · ${formatMomentDate(t.decided_at)}`}
            >
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-gold text-ink" aria-hidden="true">
                <Trophy className="size-3.5" />
              </span>
              <span className="font-black uppercase tracking-wider text-amber-800">Champion</span>
              <GameBadge game={t.game_id} size="xs" />
              <span className="break-words">{t.tournament_name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
