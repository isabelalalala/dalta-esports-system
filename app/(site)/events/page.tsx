import { getPosts, getSiteContent } from '@/utils/site-data';
import { heroBannerUrl } from '@/utils/site';
import PostCard from '@/components/site/PostCard';
import { EmptyNote } from '@/components/site/SiteParts';
import PageHeroBackground from '@/components/site/PageHeroBackground';

// Events Page
export const instant = false;

export default async function EventsPage() {
  'use cache';
  const [events, content] = await Promise.all([getPosts('events'), getSiteContent()]);
  const heroBg = heroBannerUrl(content, 'events_hero_bg_path');

  return (
    <div className="w-full space-y-8 uppercase">
      {/* Main Hero Container with dynamic background */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4 animate-hero-entrance">
        <PageHeroBackground src={heroBg} alt="DALTA Esports Events Banner" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-3">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight animate-hero-title"
            style={{ color: '#ffffff' }}
          >
            Events
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed animate-hero-tagline"
            style={{ color: '#ffffff' }}
          >
            What&apos;s happening at DALTA Esports.
          </p>
        </div>
      </section>

      {/* Events List / Grid */}
      {events.length === 0 ? (
        <EmptyNote>Nothing here yet. Check back soon!</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 animate-stagger-1">
          {events.map((p) => (
            <PostCard key={p.id} post={p} href={`/events/${p.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
