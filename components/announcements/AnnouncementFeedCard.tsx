'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, FilePen, Pin, TriangleAlert } from 'lucide-react';
import AnnouncementCover from '@/components/announcements/AnnouncementCover';
import CategoryBadge from '@/components/announcements/CategoryBadge';
import AnnouncementReactions from '@/components/announcements/AnnouncementReactions';
import { AuthorLine, NewBadge, RelativeTime } from '@/components/announcements/AnnouncementMeta';
import GameIcon from '@/components/GameIcon';
import { useNow } from '@/components/site/Countdown';
import { excerptOf, isUrgent, type FeedAnnouncement, type ReactionCounts } from '@/utils/announcements';

export interface FeedCardProps {
  a: FeedAnnouncement;
  readIds: ReadonlySet<string> | null;
  gameName?: string | null;
  reactions?: ReactionCounts;
  // Organizer buttons (Edit / Delete), above the whole-card link
  actions?: ReactNode;
  // grid = news card with a cover on top; row = compact line with a thumbnail (dashboard, tournament page)
  variant?: 'grid' | 'row';
  priority?: boolean;
}

// One announcement in the feed. The whole card opens the post (the title link's overlay); the
// reaction and organizer buttons sit above that overlay. Long titles stop at 2 lines and the
// excerpt at 3, and the footer is pushed to the bottom, so cards in a row line up whatever the
// length of the post or whether it has a cover.
export default function AnnouncementFeedCard({
  a, readIds, gameName, reactions, actions, variant = 'grid', priority = false,
}: FeedCardProps) {
  const urgent = isUrgent(a);
  const href = `/announcements/${a.id}`;
  const card =
    'group relative isolate flex overflow-hidden rounded-3xl border bg-white shadow-xs card-interactive ' +
    'has-[.card-link:focus-visible]:ring-4 has-[.card-link:focus-visible]:ring-gold/60 ' +
    (urgent ? 'border-red-200' : 'border-stone-200/90');

  const title = (
    <Link href={href} className="card-link outline-none after:absolute after:inset-0 after:z-0 after:content-['']">
      {a.title}
    </Link>
  );

  if (variant === 'row') {
    return (
      <article className={`${card} items-stretch`}>
        {urgent && <span className="absolute inset-y-0 left-0 z-10 w-1 bg-red-600" aria-hidden="true" />}
        <AnnouncementCover
          coverPath={a.cover_path} category={a.category} gameId={a.game_id}
          sizes="112px" className="w-24 sm:w-28 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={a.category} />
            <NewBadge id={a.id} publishAt={a.publish_at} readIds={readIds} />
            <OrganizerChips a={a} />
          </div>
          <h3 className="line-clamp-2 text-sm sm:text-base font-black leading-snug text-stone-950 break-words">
            {urgent && <TriangleAlert className="mr-1 inline size-4 -translate-y-px text-red-600" aria-label="Urgent" />}
            {title}
          </h3>
          <p className="text-[11px] font-semibold text-stone-600">
            <RelativeTime value={a.publish_at} />
            {gameName && <> · {gameName}</>}
          </p>
          {actions && <div className="relative z-10 mt-1">{actions}</div>}
        </div>
      </article>
    );
  }

  const excerpt = excerptOf(a.body, 220);
  return (
    <article className={`${card} h-full flex-col`}>
      {urgent && <span className="absolute inset-x-0 top-0 z-10 h-1 bg-red-600" aria-hidden="true" />}
      <div className="relative">
        <AnnouncementCover
          coverPath={a.cover_path} category={a.category} gameId={a.game_id} priority={priority}
          sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-video"
        />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5 pr-10">
          <CategoryBadge category={a.category} />
          <NewBadge id={a.id} publishAt={a.publish_at} readIds={readIds} />
        </div>
        {a.pinned && (
          <span className="pointer-events-none absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-gold text-ink shadow-xs" title="Pinned">
            <Pin className="size-3.5" aria-label="Pinned" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 min-h-6">
          {a.game_id && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-stone-700">
              <GameIcon gameId={a.game_id} name={gameName} size="xs" />
              {gameName ?? a.game_id}
            </span>
          )}
          <OrganizerChips a={a} />
        </div>
        <h3 className="line-clamp-2 text-lg font-black leading-snug tracking-tight text-stone-950 break-words group-hover:text-maroon transition-colors">
          {urgent && <TriangleAlert className="mr-1.5 inline size-5 -translate-y-0.5 text-red-600" aria-label="Urgent" />}
          {title}
        </h3>
        {excerpt && <p className="line-clamp-3 text-sm leading-relaxed text-stone-700 break-words">{excerpt}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <AuthorLine time={a.publish_at} />
          {reactions && <AnnouncementReactions announcementId={a.id} initial={reactions} size="sm" />}
        </div>
        {actions && <div className="relative z-10">{actions}</div>}
      </div>
    </article>
  );
}

// Organizers see whether a post is a draft or still scheduled (others never get those rows)
function OrganizerChips({ a }: { a: FeedAnnouncement }) {
  const now = useNow();
  if (a.is_draft) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-stone-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-stone-700">
        <FilePen className="size-3" aria-hidden="true" /> Draft
      </span>
    );
  }
  if (now !== null && new Date(a.publish_at).getTime() > now) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-yellow-800">
        <CalendarClock className="size-3" aria-hidden="true" /> Scheduled
      </span>
    );
  }
  return null;
}
