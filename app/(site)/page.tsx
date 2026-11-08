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

// Home page of the public website:
// - Hero Slideshow background
// - Campaigns with 4-item carousel and Left/Right navigation arrows
// - Featured event (pinned or next upcoming) as a big card above the events carousel, plus a
//   small ribbon about it above the hero
// - Events with 4-item carousel and Left/Right navigation arrows
// - Official Partnership infinite loop ticker
// - "Live now" strip on top (live scores or the next match; loads in the browser, so it is never
//   stale even though this page is cached). Sections below the hero fade in as they scroll in.
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

      {/* DALTA in numbers: counters that count up when they scroll into view */}
      <SiteStats />

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
