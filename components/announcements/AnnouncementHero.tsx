'use client';

import Link from 'next/link';
import { ArrowRight, Pin, TriangleAlert } from 'lucide-react';
import AnnouncementCover from '@/components/announcements/AnnouncementCover';
import CategoryBadge from '@/components/announcements/CategoryBadge';
import { AuthorLine, NewBadge, RelativeTime } from '@/components/announcements/AnnouncementMeta';
import GameIcon from '@/components/GameIcon';
import { excerptOf, isUrgent, type FeedAnnouncement } from '@/utils/announcements';

// Featured posts on top of the feed: the first is a big photo card (cover or the game-themed
// gradient behind a dark fade, white text), up to two more sit beside it on wide screens and
// below it on phones.
export default function AnnouncementHero({
  featured, readIds, gameNames,
}: {
  featured: FeedAnnouncement[];
  readIds: ReadonlySet<string> | null;
  gameNames: Record<string, string>;
}) {
  if (featured.length === 0) return null;
  const [lead, ...rest] = featured;
  return (
    <section aria-label="Featured announcements" className={`grid gap-4 ${rest.length ? '@4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
      <HeroCard a={lead} readIds={readIds} gameName={lead.game_id ? gameNames[lead.game_id] : null} big />
      {rest.length > 0 && (
        <div className={`grid gap-4 ${rest.length > 1 ? '@xl:grid-cols-2' : ''} @4xl:grid-cols-1`}>
          {rest.map((a) => (
            <HeroCard key={a.id} a={a} readIds={readIds} gameName={a.game_id ? gameNames[a.game_id] : null} />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroCard({ a, readIds, gameName, big = false }: {
  a: FeedAnnouncement; readIds: ReadonlySet<string> | null; gameName: string | null; big?: boolean;
}) {
  const urgent = isUrgent(a);
  return (
    <article
      className={`group relative isolate flex overflow-hidden rounded-3xl border bg-ink text-white shadow-md card-interactive has-[.card-link:focus-visible]:ring-4 has-[.card-link:focus-visible]:ring-gold/60 ${
        urgent ? 'border-red-500/70' : 'border-stone-800/80'
      } ${big ? 'min-h-[24rem] @3xl:min-h-[28rem]' : 'min-h-[13rem]'}`}
    >
      <AnnouncementCover
        coverPath={a.cover_path} category={a.category} gameId={a.game_id} priority={big}
        sizes={big ? '(min-width: 1024px) 66vw, 100vw' : '(min-width: 1024px) 33vw, 100vw'}
        className="absolute inset-0 -z-10"
      />
      {/* Dark fade so white text reads on any cover */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/75 to-ink/10" />
      {urgent && <span className="absolute inset-x-0 top-0 h-1.5 bg-red-600" aria-hidden="true" />}

      <div className={`mt-auto flex w-full flex-col gap-3 ${big ? 'p-5 sm:p-8 @5xl:p-10' : 'p-5'}`}>
        <div className="pointer-events-none flex flex-wrap items-center gap-1.5">
          {a.pinned && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gold backdrop-blur-sm">
              <Pin className="size-3" aria-hidden="true" /> Featured
            </span>
          )}
          <CategoryBadge category={a.category} />
          <NewBadge id={a.id} publishAt={a.publish_at} readIds={readIds} />
          {a.game_id && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-sm">
              <GameIcon gameId={a.game_id} name={gameName} size="xs" /> {gameName ?? a.game_id}
            </span>
          )}
        </div>
        <h2
          className={`font-black leading-tight tracking-tight break-words text-white drop-shadow ${
            big ? 'line-clamp-3 text-2xl sm:text-3xl @5xl:text-4xl' : 'line-clamp-2 text-lg'
          }`}
        >
          {urgent && <TriangleAlert className={`mr-2 inline text-red-400 ${big ? 'size-7 -translate-y-1' : 'size-5 -translate-y-0.5'}`} aria-label="Urgent" />}
          <Link href={`/announcements/${a.id}`} className="card-link outline-none after:absolute after:inset-0 after:content-['']">
            {a.title}
          </Link>
        </h2>
        {big && (
          <p className="line-clamp-3 max-w-prose text-sm sm:text-base leading-relaxed text-stone-200">{excerptOf(a.body, 260)}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {big ? <AuthorLine time={a.publish_at} tone="dark" /> : (
            <RelativeTime value={a.publish_at} className="text-xs font-semibold text-stone-300" />
          )}
          <span
            aria-hidden="true"
            className={`inline-flex items-center gap-1.5 rounded-xl bg-gold font-black uppercase tracking-widest text-ink transition-colors group-hover:bg-golddark ${
              big ? 'px-5 py-2.5 text-xs' : 'px-3 py-1.5 text-[10px]'
            }`}
          >
            Read more <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </div>
      </div>
    </article>
  );
}
