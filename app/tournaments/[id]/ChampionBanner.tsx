'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import ConfettiBurst from '@/components/ConfettiBurst';

// Champion banner above the bracket. The first time it scrolls into view (on page load, or when
// the final is decided while the page is open, since it then appears), the trophy pops in, a
// light sweeps across and a short confetti burst plays. Once per page view; still with reduced
// motion (CSS).
export default function ChampionBanner({ champion }: { champion: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCelebrate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative mb-6 rounded-2xl border border-golddark bg-ink px-5 py-4 text-center shadow-md"
    >
      {/* The shine sits in its own clipped box, so the confetti can fly outside the banner */}
      <div className={`absolute inset-0 rounded-2xl overflow-hidden bg-logo-stage ${celebrate ? 'champion-shine' : ''}`} aria-hidden="true" />
      <div className="relative flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-3">
        <span className={celebrate ? 'animate-trophy-reveal' : 'inline-block'}>
          <Trophy className="size-7 text-gold drop-shadow-[0_0_12px_rgba(255,204,55,0.6)]" aria-hidden="true" />
        </span>
        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gold">Champion</span>
        <span className="min-w-0 break-words text-lg sm:text-2xl font-black uppercase tracking-wide text-white">{champion}</span>
      </div>
      {celebrate && <ConfettiBurst />}
    </div>
  );
}
