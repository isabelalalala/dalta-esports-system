'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, Tv } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { LiveTag, ScoreBoard, VersusBadge, VersusRow } from '@/components/MatchVersus';
import Countdown from '@/components/site/Countdown';

interface LiveNowMatch {
  id: string;
  tournament_id: string;
  tournament_name: string;
  scheduled_at: string | null;
  score_a: number | null;
  score_b: number | null;
  team_a: string;
  team_b: string;
}

// Dashboard side column (everyone): matches being played right now (get_live_now(), the same data
// as the homepage strip) in a narrow layout, else the next match with a countdown. Reloads when a
// match changes (Realtime) and every minute.
export default function LiveNowCard() {
  const [data, setData] = useState<{ live: LiveNowMatch[]; next: LiveNowMatch[] } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      const { data: result, error } = await supabase.rpc('get_live_now');
      if (!cancelled && !error && result) setData(result as unknown as { live: LiveNowMatch[]; next: LiveNowMatch[] });
    };
    const reloadSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 800);
    };
    load();
    const channel = supabase
      .channel('dashboard-live-now')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, reloadSoon)
      .subscribe();
    const minute = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(minute);
      supabase.removeChannel(channel);
    };
  }, []);

  const live = data?.live ?? [];
  const next = data?.next[0];

  return (
    <section aria-labelledby="live-now-title" className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="live-now-title" className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-stone-950">
          <Radio className="size-4 text-red-600" aria-hidden="true" /> Live now
        </h2>
        <Link href="/live" className="text-xs font-black uppercase tracking-wider text-maroon hover:underline">Watch →</Link>
      </div>
      {live.length > 0 ? (
        <ul className="space-y-3">
          {live.map((m) => (
            <li key={m.id}>
              <Link href={`/t/${m.tournament_id}/match/${m.id}`} className="block space-y-1.5 rounded-2xl border border-red-200 p-3 hover:bg-stone-50 transition-colors">
                <span className="flex items-center justify-between gap-2">
                  <LiveTag />
                  <span className="min-w-0 truncate text-[11px] font-bold text-stone-500">{m.tournament_name}</span>
                </span>
                <VersusRow size="sm" teamA={m.team_a} teamB={m.team_b} middle={<ScoreBoard size="sm" a={m.score_a} b={m.score_b} />} />
              </Link>
            </li>
          ))}
        </ul>
      ) : next ? (
        <Link href={`/t/${next.tournament_id}/match/${next.id}`} className="block space-y-2 rounded-2xl border border-stone-200/90 p-3 hover:bg-stone-50 transition-colors">
          <span className="block text-[11px] font-black uppercase tracking-widest text-stone-500">Nothing live · next up</span>
          <VersusRow size="sm" teamA={next.team_a} teamB={next.team_b} middle={<VersusBadge size="sm" />} />
          {next.scheduled_at && (
            <span className="flex justify-center">
              <Countdown target={next.scheduled_at} prefix="Starts in" size="sm" tone="light" startedText="Starting now" />
            </span>
          )}
        </Link>
      ) : (
        <div className="space-y-3 text-sm text-stone-600">
          <p>No match is live or scheduled right now.</p>
          <Link href="/schedule" className="btn btn-secondary">
            <Tv className="size-4" aria-hidden="true" /> Schedule & results
          </Link>
        </div>
      )}
    </section>
  );
}
