'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/tournaments';

// One match as returned by get_match_ticker() (202611091700_match_ticker): team NAMES only
interface TickerMatch {
  id: string;
  tournament_id: string;
  tournament_name: string;
  game: string;
  status: 'scheduled' | 'live' | 'completed';
  scheduled_at: string | null;
  score_a: number | null;
  score_b: number | null;
  is_forfeit?: boolean;
  team_a: string;
  team_b: string;
  winner?: 'a' | 'b' | null;
}

interface TickerData {
  live: TickerMatch[];
  results?: TickerMatch[];
  next: TickerMatch[];
}

// Scroll speed in CSS pixels per second (slow enough to read a whole item)
const SPEED_PX_PER_S = 45;
// Each track repeats the items until it has at least this many, so it is wider than the bar
const MIN_ITEMS = 8;

// Thin "sports TV" bar across the top of the homepage: live scores, the latest results and the
// next matches scroll from right to left. The loop is the same two-track trick as the partner
// marquee (CSS "Results ticker" in globals.css). It pauses on hover, keyboard focus and while it is
// off-screen; with reduced motion it is a still row that scrolls sideways by hand. Reloads when a
// match changes (Realtime) and every minute. Hidden when there is nothing to show.
export default function MatchTicker() {
  const [data, setData] = useState<TickerData | null>(null);
  // The first load has finished (with or without data): until then a same-height placeholder holds
  // the ticker's place, so the page doesn't jump down when it appears (layout shift on Lighthouse)
  const [loaded, setLoaded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const ticker = await supabase.rpc('get_match_ticker');
      if (cancelled) return;
      if (!ticker.error && ticker.data) {
        setData(ticker.data as unknown as TickerData);
        setLoaded(true);
        return;
      }
      // Before 202611091700 has run: live and next matches only (no results)
      const live = await supabase.rpc('get_live_now');
      if (cancelled) return;
      if (!live.error && live.data) setData(live.data as unknown as TickerData);
      setLoaded(true);
    };
    const reloadSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 800);
    };

    load();
    const channel = supabase
      .channel('home-match-ticker')
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

  const items = data ? [...data.live, ...(data.results ?? []), ...data.next] : [];

  // Duration from the track width (same speed whatever the number of items), and pause off-screen
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const update = () => {
      viewport.style.setProperty('--ticker-duration', `${Math.max(15, track.scrollWidth / SPEED_PX_PER_S)}s`);
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(track);
    const visible = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) viewport.removeAttribute('data-paused');
      else viewport.setAttribute('data-paused', '');
    });
    visible.observe(viewport);
    return () => {
      resize.disconnect();
      visible.disconnect();
    };
  }, [items.length]);

  // Same height as the real ticker (38px at every width); empty for screen readers
  if (!loaded) return <div aria-hidden="true" className="h-[38px] rounded-2xl border border-stone-800/80 bg-ink shadow-md" />;
  if (items.length === 0) return null;

  const repeat = Math.max(1, Math.ceil(MIN_ITEMS / items.length));
  const repeated = Array.from({ length: repeat }, () => items).flat();

  return (
    <section
      aria-label="Match ticker: live scores, latest results and next matches"
      className="animate-section-reveal flex items-stretch overflow-hidden rounded-2xl border border-stone-800/80 bg-ink text-white shadow-md"
    >
      <span className="relative z-10 flex shrink-0 items-center gap-1.5 bg-gold px-3 sm:px-4 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-ink">
        <Activity className="size-4" aria-hidden="true" />
        <span className="hidden min-[400px]:inline">Match center</span>
      </span>
      <div ref={viewportRef} className="ticker relative flex min-w-0 flex-1 overflow-hidden">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            ref={copy === 0 ? trackRef : undefined}
            aria-hidden={copy === 1 || undefined}
            className={`ticker-track ${copy === 1 ? 'ticker-copy' : ''}`}
          >
            {repeated.map((m, i) => {
              // Only the first set of the first track is real content (read out, focusable)
              const original = copy === 0 && i < items.length;
              return (
                <li key={`${copy}-${i}`} className={original ? '' : 'ticker-copy'} aria-hidden={!original || undefined}>
                  <TickerItem match={m} focusable={original} />
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </section>
  );
}

function TickerItem({ match: m, focusable }: { match: TickerMatch; focusable: boolean }) {
  const team = (name: string, side: 'a' | 'b') => (
    <span className={`max-w-[10rem] truncate ${m.status === 'completed' && m.winner && m.winner !== side ? 'text-stone-400' : 'text-white'}`}>
      {name}
    </span>
  );

  return (
    <Link
      href={`/t/${m.tournament_id}/match/${m.id}`}
      tabIndex={focusable ? undefined : -1}
      className="flex items-center gap-2 whitespace-nowrap border-r border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wide hover:bg-white/5 focus-visible:bg-white/10 transition-colors"
    >
      {m.status === 'live' ? (
        <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] tracking-widest text-white">
          <span className="size-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" /> Live
        </span>
      ) : m.status === 'completed' ? (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] tracking-widest text-stone-300">Final</span>
      ) : (
        <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[9px] tracking-widest text-gold">Next</span>
      )}
      {team(m.team_a, 'a')}
      {m.status === 'scheduled' || (m.status === 'completed' && m.score_a == null && m.score_b == null && !m.is_forfeit) ? (
        // Upcoming, or a result saved without scores (the winner's name stays white)
        <span className="text-gold italic">vs</span>
      ) : m.is_forfeit ? (
        <span className="text-stone-300">FF</span>
      ) : (
        <span className="rounded bg-white/10 px-1.5 tabular-nums text-gold">
          {m.score_a ?? 0}–{m.score_b ?? 0}
        </span>
      )}
      {team(m.team_b, 'b')}
      <span className="font-bold normal-case tracking-normal text-stone-400">
        {m.status === 'scheduled' && m.scheduled_at ? formatDateTime(m.scheduled_at) : m.game}
      </span>
    </Link>
  );
}
