import Link from 'next/link';
import type { ReactNode } from 'react';
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
      className={`bg-[#1a1a2e] border rounded-lg p-4 ${a.pinned ? 'border-yellow-500/60' : 'border-[#00d2ff]/30'}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        {a.pinned && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/50">
            📌 Pinned
          </span>
        )}
        {showTournament && a.tournaments && (
          <Link
            href={`/tournaments/${a.tournaments.id}`}
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#00d2ff]/15 text-[#00d2ff] border border-[#00d2ff]/50 hover:bg-[#00d2ff]/25"
          >
            {a.tournaments.name}
          </Link>
        )}
        {showTournament && !a.tournament_id && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-300 border border-gray-500/50">
            General
          </span>
        )}
      </div>

      <h3 className="text-lg font-bold text-white">{a.title}</h3>
      <p className="text-xs text-gray-500 mb-2">
        {new Date(a.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        {edited && ' · edited'}
      </p>
      <p className={`text-gray-300 whitespace-pre-wrap ${compact ? 'line-clamp-3' : ''}`}>{a.body}</p>

      {actions && <div className="mt-3 flex gap-4 text-sm font-semibold">{actions}</div>}
    </article>
  );
}
