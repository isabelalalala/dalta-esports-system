'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { useViewer } from '@/utils/use-viewer';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { isNewAnnouncement, sortFeed, type FeedAnnouncement, type ReactionCounts } from '@/utils/announcements';
import { loadReactions, loadReadIds } from '@/utils/announcements-data';
import AnnouncementFeedCard from '@/components/announcements/AnnouncementFeedCard';
import { useNow } from '@/components/site/Countdown';

// Dashboard "Latest Announcements": the top post as a news card and the next three as compact
// rows, with NEW badges for posts this user hasn't opened. Drafts and scheduled posts stay on the
// Announcements page (organizers manage them there).
export default function LatestAnnouncements() {
  const supabase = createClient();
  const viewer = useViewer();
  const now = useNow();
  const [rows, setRows] = useState<FeedAnnouncement[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [readIds, setReadIds] = useState<Set<string> | null>(null);
  const [games, setGames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [{ data, error: annError }, gameRes] = await Promise.all([
        supabase.from('announcements').select('*')
          .eq('is_draft', false).lte('publish_at', new Date().toISOString())
          .order('pinned', { ascending: false }).order('publish_at', { ascending: false }).limit(4),
        supabase.from('games').select('id, name'),
      ]);
      if (annError) throw annError;
      const list = sortFeed((data ?? []) as FeedAnnouncement[]);
      const ids = list.map((a) => a.id);
      const [r, reads] = await Promise.all([loadReactions(supabase, ids), loadReadIds(supabase, ids)]);
      setRows(list);
      setReactions(r);
      setReadIds(reads);
      setGames(Object.fromEntries((gameRes.data ?? []).map((g) => [g.id, g.name])));
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load announcements'));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (viewer.status !== 'ready') return;
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [viewer.status, load]);
  useRealtimeRefresh('dashboard-announcements', [{ table: 'announcements' }], load, 800);

  const unread = readIds && now !== null ? rows.filter((a) => isNewAnnouncement(a, readIds, now)).length : 0;
  const [lead, ...rest] = rows;

  return (
    <section className="w-full rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-gold">
            <Megaphone className="size-5" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white" aria-label={`${unread} unread`}>
                {unread}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black tracking-wider text-stone-950">Latest Announcements</h2>
            <p className="text-xs font-medium tracking-wide text-stone-600">News, match updates and results from the organizers</p>
          </div>
        </div>
        <Link href="/announcements" className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-maroon shadow-2xs transition-colors hover:bg-gold/15 min-h-10">
          View all <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" aria-busy="true">
          <div className="h-80 rounded-3xl bg-stone-100 shimmer-light" />
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-3xl bg-stone-100 shimmer-light" />)}</div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold tracking-wider text-red-700" role="alert">{error}</div>
      ) : !lead ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 text-center">
          <Megaphone className="size-8 text-stone-500" aria-hidden="true" />
          <p className="text-sm font-bold text-stone-600">No announcements yet. Check back soon!</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${rest.length ? '@3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]' : ''}`}>
          <AnnouncementFeedCard a={lead} readIds={readIds} gameName={lead.game_id ? games[lead.game_id] : null} reactions={reactions[lead.id]} />
          {rest.length > 0 && (
            <div className="flex flex-col gap-3">
              {rest.map((a) => (
                <AnnouncementFeedCard key={a.id} a={a} readIds={readIds} gameName={a.game_id ? games[a.game_id] : null} variant="row" />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
