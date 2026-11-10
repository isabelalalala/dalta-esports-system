'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Radio, Swords, Tv } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Countdown from './Countdown';
import { ScoreBoard, VersusBadge, VersusRow } from '@/components/MatchVersus';
import GameBadge from '@/components/GameBadge';
import LivePulse from '@/components/LivePulse';

// One match as returned by get_live_now() (202611091100_live_now): team and tournament NAMES only
interface LiveNowMatch {
  id: string;
  tournament_id: string;
  tournament_name: string;
  game: string;
  status: 'scheduled' | 'live';
  scheduled_at: string | null;
  score_a: number | null;
  score_b: number | null;
  team_a: string;
  team_b: string;
  has_stream: boolean;
}

interface LiveNow {
  live: LiveNowMatch[];
  next: LiveNowMatch[];
}

// Homepage strip: matches being played right now with their scores (updating live), or, when
// nothing is live, the next scheduled match with a countdown. Renders nothing when there is
// neither. Reloads when any match changes (Realtime; visitors may read matches) and every minute
// (streams going live and the "next" list don't send Realtime events to visitors).
export default function LiveNowStrip() {
  const [data, setData] = useState<LiveNow | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const { data: result, error } = await supabase.rpc('get_live_now');
      // Before the migration has run (or offline) the strip just stays hidden
      if (!cancelled && !error && result) setData(result as unknown as LiveNow);
    };
    // A winner moving forward changes several matches at once: reload once for all of them
    const reloadSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 800);
    };

    load();
    const channel = supabase
      .channel('home-live-now')
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

  if (!data) return null;
  if (data.live.length > 0) return <LiveMatches matches={data.live} />;
  if (data.next.length > 0) return <NextMatch match={data.next[0]} />;
  return null;
}

function LiveMatches({ matches }: { matches: LiveNowMatch[] }) {
  return (
    <section aria-label="Live now" className="animate-section-reveal rounded-2xl border border-red-200 bg-white shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2">
        <LivePulse size="md" />
        <h2 className="text-xs font-black uppercase tracking-widest text-red-700">
          Live now · {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </h2>
      </div>
      <ul className="divide-y divide-stone-100">
        {matches.map((m) => (
          <li key={m.id}>
            <Link
              href={`/t/${m.tournament_id}/match/${m.id}`}
              className="group flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 hover:bg-stone-50 transition-colors"
            >
              <span className="flex min-w-0 sm:w-48 shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-stone-500">
                <GameBadge name={m.game} size="xs" />
                <span className="min-w-0 truncate">{m.game} · {m.tournament_name}</span>
              </span>
              <span className="min-w-0 flex-1">
                {/* Digits flip when a score changes (FlipScore) */}
                <VersusRow size="sm" teamA={m.team_a} teamB={m.team_b} middle={<ScoreBoard a={m.score_a} b={m.score_b} />} />
              </span>
              <span className="shrink-0 inline-flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider text-maroon">
                {m.has_stream ? <Tv className="h-4 w-4" aria-hidden="true" /> : <Radio className="h-4 w-4" aria-hidden="true" />}
                {m.has_stream ? 'Watch' : 'Follow'}
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextMatch({ match }: { match: LiveNowMatch }) {
  return (
    <Link
      href={`/t/${match.tournament_id}/match/${match.id}`}
      aria-label={`Next match: ${match.team_a} versus ${match.team_b}, ${match.tournament_name}`}
      className="animate-section-reveal group flex flex-col gap-2 rounded-2xl border border-stone-200/90 bg-white px-4 py-3 shadow-xs hover:border-gold/60 hover:shadow-md transition-all sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-maroon">
        <Swords className="h-4 w-4" aria-hidden="true" /> Next match
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <VersusRow size="sm" teamA={match.team_a} teamB={match.team_b} middle={<VersusBadge size="sm" />} />
        <span className="block truncate text-center text-xs font-bold text-stone-600">{match.tournament_name}</span>
      </span>
      {match.scheduled_at && (
        <Countdown target={match.scheduled_at} prefix="Starts in" size="sm" tone="light" startedText="Starting now" />
      )}
    </Link>
  );
}
