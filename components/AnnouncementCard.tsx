import Link from 'next/link';
import type { ReactNode } from 'react';
import { Pin } from 'lucide-react';
import type { Announcement } from '@/utils/types';

// One announcement. Used on /announcements, the tournament page and the dashboard.
// `compact` shortens the text to 3 lines; `actions` holds admin buttons (Edit / Delete).
export default function AnnouncementCard({
  announcement,
  compact = false,
  showTournament = true,
  actions,
}: {
  announcement: Announcement;
  compact?: boolean;
  showTournament?: boolean;
  actions?: ReactNode;
}) {
  const a = announcement;
  // More than a minute between posting and the last change counts as "edited"
  const edited = new Date(a.updated_at).getTime() - new Date(a.created_at).getTime() > 60_000;

  return (
    <article
      className="rounded-2xl border border-stone-200/90 bg-stone-50/60 p-5 sm:p-6 shadow-2xs hover:bg-white hover:border-amber-500/40 hover:shadow-xs transition-all space-y-3 uppercase"
    >
      <div className="flex flex-wrap items-center gap-2">
        {a.pinned && (
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 border border-amber-500/30">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}
        {showTournament && a.tournaments && (
          <Link
            href={`/tournaments/${a.tournaments.id}`}
            className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            {a.tournaments.name}
          </Link>
        )}
        {showTournament && !a.tournament_id && (
          <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            General
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base sm:text-lg font-black text-stone-950 tracking-wide">{a.title}</h3>
        <p className="text-xs text-stone-500 font-semibold tracking-wider mt-1">
          {new Date(a.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          {edited && ' · edited'}
        </p>
      </div>

      <p className={`text-stone-700 text-xs sm:text-sm font-medium tracking-wide leading-relaxed whitespace-pre-wrap ${compact ? 'line-clamp-3' : ''}`}>
        {a.body}
      </p>

      {actions && <div className="mt-4 pt-3 border-t border-stone-200/60 flex gap-4 text-xs font-black">{actions}</div>}
    </article>
  );
}
