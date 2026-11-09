import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getFeaturedEvent, getHeroImages, getPosts, getSiteContent } from '@/utils/site-data';
import { formatDate } from '@/utils/tournaments';
import FeaturedEventCard from '@/components/site/FeaturedEventCard';
import LiveNowStrip from '@/components/site/LiveNowStrip';
import Reveal from '@/components/Reveal';
import SiteStats from '@/components/site/SiteStats';
import HeroSlideshow from '@/components/site/HeroSlideshow';
import PartnershipSection from '@/components/site/PartnershipSection';
import PostSectionCarousel from '@/components/site/PostSectionCarousel';
import MatchTicker from '@/components/site/MatchTicker';
import DarkBand from '@/components/site/DarkBand';
import GameTiles from '@/components/site/GameTiles';

// Home page of the public website:
// - Hero Slideshow background
// - Campaigns with 4-item carousel and Left/Right navigation arrows
// - Featured event (pinned or next upcoming) as a big card above the events carousel, plus a
//   small ribbon about it above the hero
// - Events with 4-item carousel and Left/Right navigation arrows
// - Official Partnership infinite loop ticker
// - "Live now" strip on top (live scores or the next match; loads in the browser, so it is never
//   stale even though this page is cached). Sections below the hero fade in as they scroll in.
// - Phase 10: a results ticker above everything, and a full-width dark band with slanted edges
//   (numbers + "Choose your game" tiles) between Campaigns and Events, so the page alternates
//   dark hero / white / dark / white instead of one long white column.
export const instant = false;

export default async function HomePage() {
  'use cache';
  const [content, heroImages, campaigns, allEvents, featured] = await Promise.all([
    getSiteContent(),
    getHeroImages(),
    getPosts('campaigns', 12),
    getPosts('events', 13),
    getFeaturedEvent(),
  ]);
  // The featured event has its own card, so the carousel leaves it out
  const events = allEvents.filter((e) => e.id !== featured?.id).slice(0, 12);

  return (
    <div className="w-full space-y-12 sm:space-y-16">
      {/* Ribbon about the featured event, right above the hero */}
      <div className="space-y-3">
      <MatchTicker />
      <LiveNowStrip />
      {featured && (
        <Link
          href={`/events/${featured.id}`}
          className="group flex items-center justify-center gap-2 rounded-2xl border border-gold/60 bg-gold/15 px-4 py-2.5 text-center text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-950 hover:bg-gold/25 transition-colors min-w-0"
        >
          <span className="truncate">
            {featured.title}
            <span className="text-maroon"> · {featured.event_date ? formatDate(featured.event_date) : 'Coming soon'}</span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 text-maroon">
            View details <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* Hero Slideshow Background with dark overlay & high-contrast CTA */}
      <HeroSlideshow
        title={content.hero_title}
        tagline={content.hero_tagline}
        images={heroImages}
        content={content}
      />
      </div>

      {/* Campaigns Section with 4-item view and Prev/Next arrows */}
      <Reveal>
        <PostSectionCarousel
          title="Campaigns"
          moreHref="/campaigns"
          baseHref="/campaigns"
          emptyText="No campaigns published yet."
          posts={campaigns}
        />
      </Reveal>

      {/* Dark band: DALTA in numbers (count up on scroll) + one tile per game division */}
      <DarkBand label="Compete with DALTA Esports">
        <Reveal className="flex flex-col items-center gap-4 text-center @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:text-left">
          <div className="space-y-2">
            <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] text-gold">Collegiate esports · UPHSD Molino</p>
            <h2 className="text-3xl sm:text-4xl @5xl:text-5xl font-black uppercase leading-none tracking-tight text-white">
              Choose your <span className="text-gold text-glow-gold">game</span>
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/auth/register"
              className="px-6 py-3 rounded-xl bg-gold text-ink font-black text-xs uppercase tracking-widest border border-golddark shadow-md hover:bg-golddark transition-colors"
            >
              Join DALTA Esports
            </Link>
            <Link
              href="/divisions"
              className="px-6 py-3 rounded-xl border border-white/30 bg-white/10 text-white font-extrabold text-xs uppercase tracking-widest hover:bg-white/20 transition-colors"
            >
              All divisions
            </Link>
          </div>
        </Reveal>
        <GameTiles />
        <SiteStats plain />
      </DarkBand>

      {/* Events Section with 4-item view and Prev/Next arrows */}
      <Reveal>
        <PostSectionCarousel
          showDateTba
          featured={featured ? <FeaturedEventCard event={featured} /> : null}
          title="Events"
          moreHref="/events"
          baseHref="/events"
          emptyText="No upcoming events scheduled yet."
          posts={events}
        />
      </Reveal>

      {/* Official Partnership Loop Slider (Below Events, before Footer) */}
      <Reveal>
        <PartnershipSection />
      </Reveal>
    </div>
  );
}
