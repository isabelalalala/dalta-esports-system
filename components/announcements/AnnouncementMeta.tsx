'use client';

import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { useNow } from '@/components/site/Countdown';
import { formatDateTime, formatMomentDate } from '@/utils/tournaments';
import { isNewAnnouncement, relativeTime } from '@/utils/announcements';
import { DEFAULT_LOGO } from '@/utils/site';

// "2 hours ago"; hovering (or a long press) shows the full date and time in PH time. Before the
// page is hydrated it shows the date, so server and browser HTML match.
export function RelativeTime({ value, className = '' }: { value: string; className?: string }) {
  const now = useNow();
  return (
    <time dateTime={value} title={formatDateTime(value)} className={className}>
      {now === null ? formatMomentDate(value) : relativeTime(value, now)}
    </time>
  );
}

// Gold "NEW" badge: last 48 hours, or unread for logged-in users (readIds)
export function NewBadge({ publishAt, id, readIds }: { publishAt: string; id: string; readIds: ReadonlySet<string> | null }) {
  const now = useNow();
  if (now === null || !isNewAnnouncement({ id, publish_at: publishAt }, readIds, now)) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-ink shadow-xs">
      <Sparkles className="size-3" aria-hidden="true" />
      New
    </span>
  );
}

// Every post is signed by the organization (the activity log still records which admin posted)
export function AuthorLine({ time, tone = 'light', className = '' }: { time?: string; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-gold/60 bg-ink p-1">
        <Image src={DEFAULT_LOGO} alt="" width={32} height={32} className="size-full object-contain" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={`block truncate text-xs font-black ${tone === 'dark' ? 'text-white' : 'text-stone-950'}`}>DALTA Esports</span>
        {time && (
          <RelativeTime
            value={time}
            className={`block text-[11px] font-semibold ${tone === 'dark' ? 'text-stone-300' : 'text-stone-600'}`}
          />
        )}
      </span>
    </div>
  );
}
