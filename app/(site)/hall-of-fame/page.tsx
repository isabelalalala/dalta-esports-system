import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Trophy } from 'lucide-react';
import { getDivisions, getHallOfFame, getSiteContent } from '@/utils/site-data';
import { heroBannerUrl } from '@/utils/site';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import HallOfFameBoard, { HallOfFameWithUrl } from '@/components/site/HallOfFameBoard';
import HallOfFameConfetti from '@/components/site/HallOfFameConfetti';

// Tab title = the menu label (utils/navigation.ts)
export const metadata: Metadata = {
  title: 'Hall of Fame',
  description: 'Every DALTA Esports tournament champion, season after season: MLBB, Valorant, Tekken 8, League of Legends and CODM.',
};

export const instant = false;

// Hall of Fame (202611101100_hall_of_fame): every tournament's champion, kept after each season.
// Cached like the rest of the public site (utils/site-data.ts, tag `site`): a new champion shows up
// within a few minutes. Visitors see team names and logos; logged-in viewers also get the roster
// IGNs and the MVP (privacy choice b), loaded in the browser by HallOfFameBoard.
export default async function HallOfFamePage() {
  'use cache';
  const [entries, divisions, content] = await Promise.all([getHallOfFame(), getDivisions(), getSiteContent()]);
  const games = divisions
    .filter((d) => d.is_published)
    .map((d) => ({ id: d.game_id, name: d.games?.name ?? d.game_id }));

  return (
    <div className="w-full space-y-8">
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-golddark/60 bg-ink shadow-md p-8 sm:p-14 @5xl:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        {/* The photo and its shine are clipped to the rounded box; the confetti may fly outside it */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl m-0!" aria-hidden="true">
          <PageHeroBackground src={heroBannerUrl(content)} alt="" />
          <div className="absolute inset-0 bg-logo-stage opacity-80" />
        </div>
        <HallOfFameConfetti />
        <span className="relative z-10 animate-trophy-reveal inline-flex">
          <Trophy className="size-12 sm:size-14 text-gold drop-shadow-[0_0_18px_rgba(255,204,55,0.6)]" aria-hidden="true" />
        </span>
        <div className="relative z-10 max-w-4xl mx-auto space-y-3">
          <h1 className="animate-hero-title text-page-hero font-black tracking-wider uppercase leading-tight text-white">
            Hall of <span className="text-gold text-glow-gold">Fame</span>
          </h1>
          <p className="animate-hero-tagline text-base sm:text-lg font-medium leading-relaxed text-white">
            Every champion, season after season.
          </p>
        </div>
      </section>

      {/* Filters live in the address; until it's read, the same board without filters (full list in the HTML) */}
      <Suspense fallback={<HallOfFameBoard entries={entries} games={games} />}>
        <HallOfFameWithUrl entries={entries} games={games} />
      </Suspense>
    </div>
  );
}
