import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import { getLatestAnnouncements } from '@/utils/site-data';
import { sortFeed } from '@/utils/announcements';
import AnnouncementFeedCard from '@/components/announcements/AnnouncementFeedCard';
import Reveal from '@/components/Reveal';

// Homepage "Latest news": the newest announcements as news cards (cached with the site, refreshed
// when an admin saves an announcement). Hidden when there are none yet.
export default async function LatestNews() {
  const { rows, games } = await getLatestAnnouncements(4);
  if (rows.length === 0) return null;
  const list = sortFeed(rows);
  return (
    <section className="space-y-6" aria-labelledby="latest-news-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] text-maroon">
            <Megaphone className="size-4" aria-hidden="true" /> Newsroom
          </p>
          <h2 id="latest-news-title" className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-stone-950">Latest news</h2>
        </div>
        <Link href="/announcements" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-maroon hover:underline underline-offset-4">
          All announcements <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-5 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
        {list.map((a, i) => (
          <Reveal key={a.id} delay={(i % 4) as 0 | 1 | 2 | 3} variant="card" className="h-full">
            <AnnouncementFeedCard a={a} readIds={null} gameName={a.game_id ? games[a.game_id] : null} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
