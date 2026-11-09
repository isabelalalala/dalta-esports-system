import type { Metadata } from 'next';
import { Megaphone } from 'lucide-react';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import AnnouncementFeed from '@/components/announcements/AnnouncementFeed';

export const metadata: Metadata = {
  title: 'Announcements',
  description: 'Tournament news, match updates, results, events and streams from DALTA Esports.',
  alternates: { canonical: '/announcements' },
};

// Public news feed (Phase 14): published announcements are readable by everyone, also logged out
// (RLS). The feed itself loads in the browser (filters in the address, reactions, read state,
// Realtime), so this page is static.
export default function AnnouncementsPage() {
  return (
    <div className="w-full space-y-8">
      <section className="relative w-full overflow-hidden rounded-3xl border border-stone-800/80 bg-stone-950 p-6 sm:p-12 @5xl:p-14 text-white shadow-md">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports announcements banner" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <p className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] text-gold">
            <Megaphone className="size-4" aria-hidden="true" /> DALTA Esports newsroom
          </p>
          <h1 className="text-[1.7rem] sm:text-page-hero font-black uppercase leading-tight tracking-wide sm:tracking-wider text-white">Announcements</h1>
          <p className="text-base sm:text-lg font-medium leading-relaxed text-white">
            Tournament news, match updates, results, events and streams, as they happen.
          </p>
        </div>
      </section>
      <AnnouncementFeed />
    </div>
  );
}
