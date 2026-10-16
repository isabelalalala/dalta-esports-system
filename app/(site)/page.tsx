import type { ReactNode } from 'react';
import Link from 'next/link';
import { getHeroImages, getPosts, getSiteContent } from '@/utils/site-data';
import HeroCarousel from '@/components/site/HeroCarousel';
import PostCard from '@/components/site/PostCard';

// Home page of the public website (wireframe: hero, event photo carousel, Campaigns, Events).
// Content comes from /admin/website.
export default async function HomePage() {
  const [content, heroImages, campaigns, events] = await Promise.all([
    getSiteContent(),
    getHeroImages(),
    getPosts('campaigns', 6),
    getPosts('events', 6),
  ]);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="border-2 border-gold bg-sitecard shadow-[6px_6px_0_var(--color-brown)] px-6 py-12 text-center space-y-6">
        <h1 className="font-pixel text-gold text-2xl sm:text-4xl leading-relaxed">{content.hero_title}</h1>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto">{content.hero_tagline}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/auth/register" className="px-6 py-3 border-2 border-gold bg-gold text-sitebg font-bold shadow-[4px_4px_0_var(--color-brown)] hover:translate-y-px">
            Join DALTA Esports
          </Link>
          <Link href="/divisions" className="px-6 py-3 border-2 border-gold text-gold font-bold hover:bg-gold/10">
            Explore Our Team
          </Link>
        </div>
      </section>

      <HeroCarousel images={heroImages} />

      <PostSection title="Campaigns" moreHref="/campaigns" emptyText="No campaigns yet.">
        {campaigns.map((c) => <PostCard key={c.id} post={c} href={`/campaigns/${c.id}`} />)}
      </PostSection>

      <PostSection title="Events" moreHref="/events" emptyText="No events yet.">
        {events.map((e) => <PostCard key={e.id} post={e} href={`/events/${e.id}`} />)}
      </PostSection>
    </div>
  );
}

function PostSection({ title, moreHref, emptyText, children }: {
  title: string;
  moreHref: string;
  emptyText: string;
  children: ReactNode[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-pixel text-gold text-base sm:text-lg">{title}</h2>
        {children.length > 0 && <Link href={moreHref} className="text-sm text-gold hover:underline">See all →</Link>}
      </div>
      {children.length === 0 ? (
        <p className="text-gray-400 border-2 border-dashed border-brown p-6 text-center">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">{children}</div>
      )}
    </section>
  );
}
