import { getHeroImages, getPosts, getSiteContent } from '@/utils/site-data';
import HeroSlideshow from '@/components/site/HeroSlideshow';
import PartnershipSection from '@/components/site/PartnershipSection';
import PostSectionCarousel from '@/components/site/PostSectionCarousel';

// Home page of the public website:
// - Hero Slideshow background
// - Campaigns with 4-item carousel and Left/Right navigation arrows
// - Events with 4-item carousel and Left/Right navigation arrows
// - Official Partnership infinite loop ticker
export const instant = false;

export default async function HomePage() {
  'use cache';
  const [content, heroImages, campaigns, events] = await Promise.all([
    getSiteContent(),
    getHeroImages(),
    getPosts('campaigns', 12),
    getPosts('events', 12),
  ]);

  return (
    <div className="w-full space-y-12 sm:space-y-16 uppercase">
      {/* Hero Slideshow Background with dark overlay & high-contrast CTA */}
      <HeroSlideshow
        title={content.hero_title}
        tagline={content.hero_tagline}
        images={heroImages}
        content={content}
      />

      {/* Campaigns Section with 4-item view and Prev/Next arrows */}
      <div className="animate-section-campaigns">
        <PostSectionCarousel
          title="Campaigns"
          moreHref="/campaigns"
          baseHref="/campaigns"
          emptyText="No campaigns published yet."
          posts={campaigns}
        />
      </div>

      {/* Events Section with 4-item view and Prev/Next arrows */}
      <div className="animate-section-events">
        <PostSectionCarousel
          title="Events"
          moreHref="/events"
          baseHref="/events"
          emptyText="No upcoming events scheduled yet."
          posts={events}
        />
      </div>

      {/* Official Partnership Loop Slider (Below Events, before Footer) */}
      <div className="animate-section-partnerships">
        <PartnershipSection />
      </div>
    </div>
  );
}
