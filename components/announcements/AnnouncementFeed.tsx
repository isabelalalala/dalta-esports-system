'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CheckCheck, Megaphone, Plus, Search, SearchX, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useViewer } from '@/utils/use-viewer';
import { can } from '@/utils/permissions';
import { getErrorMessage } from '@/utils/errors';
import { useUrlState, setUrlParams, readUrlParam } from '@/utils/url-state';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { deleteSiteImage } from '@/utils/site-images';
import { refreshSite } from '@/app/admin/website/actions';
import {
  FEED_FILTERS, FEED_FILTER_IDS, isNewAnnouncement, matchesFeedQuery, pickFeatured, sortFeed,
  type FeedAnnouncement, type FeedFilterId, type ReactionCounts,
} from '@/utils/announcements';
import { loadAnnouncements, loadReactions, loadReadIds, markRead } from '@/utils/announcements-data';
import AnnouncementFeedCard from '@/components/announcements/AnnouncementFeedCard';
import AnnouncementHero from '@/components/announcements/AnnouncementHero';
import AnnouncementEditor from '@/components/announcements/AnnouncementEditor';
import GameFilterChips from '@/components/GameFilterChips';
import Reveal from '@/components/Reveal';
import AutoUpdateBadge from '@/components/AutoUpdateBadge';
import { useConfirm } from '@/components/useConfirm';
import { toast } from '@/components/Toaster';
import { useNow } from '@/components/site/Countdown';

// Remembered so "Back to announcements" on a post returns to the same filters
export const FEED_URL_KEY = 'dalta:announcements-feed';

const grid = 'grid gap-5 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))]';

// The announcements news feed: featured posts, filter chips (category + game), search, and a
// card grid. New posts arrive through Realtime and wait behind a "1 new post · Show" pill, so
// the page doesn't jump while someone reads. Admins get the editor (?edit=<id> opens a post).
export default function AnnouncementFeed() {
  const supabase = createClient();
  const viewer = useViewer();
  const now = useNow();
  const [confirmDialog, ask] = useConfirm();
  const canPost = can(viewer.role, 'announcement.post');
  const loggedIn = !!viewer.userId;

  const [rows, setRows] = useState<FeedAnnouncement[]>([]);
  const [pending, setPending] = useState<FeedAnnouncement[] | null>(null);
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [readIds, setReadIds] = useState<Set<string> | null>(null);
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FeedAnnouncement | 'new' | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<FeedAnnouncement[]>([]);

  const [filter, setFilter] = useUrlState<FeedFilterId>('filter', 'all', FEED_FILTER_IDS);
  const [game, setGame] = useUrlState<string>('game', '');
  const [q, setQ] = useUrlState<string>('q', '');

  // Remember this view (filters) for the Back link on a post
  useEffect(() => {
    try { sessionStorage.setItem(FEED_URL_KEY, window.location.search); } catch { /* private mode */ }
  }, [filter, game, q]);

  const loadExtras = useCallback(async (list: FeedAnnouncement[], withReads: boolean) => {
    const ids = list.map((a) => a.id);
    const [r, reads] = await Promise.all([
      loadReactions(supabase, ids),
      withReads ? loadReadIds(supabase, ids) : Promise.resolve(null),
    ]);
    setReactions((prev) => ({ ...prev, ...r }));
    setReadIds(reads);
  }, [supabase]);

  // First load (waits for the viewer, so the read state and organizer rows are right)
  useEffect(() => {
    if (viewer.status !== 'ready') return;
    let cancelled = false;
    (async () => {
      try {
        const [list, gameRes] = await Promise.all([
          loadAnnouncements(supabase),
          supabase.from('games').select('id, name').order('name'),
        ]);
        if (cancelled) return;
        rowsRef.current = list;
        setRows(list);
        setGames(gameRes.data ?? []);
        await loadExtras(list, !!viewer.userId);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load announcements'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, viewer.status, viewer.userId, loadExtras]);

  // Organizers: tournaments for the editor, and ?edit=<id> from a post's Edit button
  useEffect(() => {
    if (!canPost) return;
    supabase.from('tournaments').select('id, name').order('start_date', { ascending: false })
      .then(({ data }) => setTournaments(data ?? []));
  }, [canPost, supabase]);
  useEffect(() => {
    if (!canPost || loading) return;
    const id = readUrlParam('edit');
    if (!id) return;
    const found = id === 'new' ? 'new' : rows.find((a) => a.id === id) ?? null;
    if (found) setTimeout(() => setEditing(found), 0);
  }, [canPost, loading, rows]);

  const reload = useCallback(async (showNow: boolean) => {
    try {
      const list = await loadAnnouncements(supabase);
      const known = new Set(rowsRef.current.map((a) => a.id));
      const fresh = list.filter((a) => !known.has(a.id));
      if (!showNow && fresh.length > 0 && rowsRef.current.length > 0) {
        // New posts wait behind the pill; edits and deletions of visible posts apply right away
        setPending(list);
        const next = rowsRef.current
          .filter((a) => list.some((b) => b.id === a.id))
          .map((a) => list.find((b) => b.id === a.id)!);
        rowsRef.current = next;
        setRows(next);
      } else {
        rowsRef.current = list;
        setRows(list);
        setPending(null);
      }
      await loadExtras(list, loggedIn);
    } catch {
      // Keep the current list; the next change tries again
    }
  }, [supabase, loadExtras, loggedIn]);

  useRealtimeRefresh('announcements-feed', [{ table: 'announcements' }], () => reload(false), 800);

  const showPending = () => {
    if (!pending) return;
    rowsRef.current = pending;
    setRows(pending);
    setPending(null);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const openEditor = (target: FeedAnnouncement | 'new') => {
    setEditing(target);
    setUrlParams({ edit: target === 'new' ? 'new' : target.id });
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start' }));
  };
  const closeEditor = () => {
    setEditing(null);
    setUrlParams({ edit: null });
  };

  const handleDelete = async (a: FeedAnnouncement) => {
    if (!(await ask({ title: 'Delete announcement?', message: `"${a.title}" will be removed for everyone, with its reactions.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    const { data, error: deleteError } = await supabase.from('announcements').delete().eq('id', a.id).select('id');
    if (deleteError || !data || data.length === 0) {
      toast.error(deleteError ? getErrorMessage(deleteError, 'Failed to delete the announcement') : 'Only admins can delete announcements.');
      return;
    }
    await deleteSiteImage(supabase, a.cover_path);
    await refreshSite().catch(() => undefined);
    toast.success('Announcement deleted.');
    reload(true);
  };

  const markAllRead = async () => {
    const unread = rows.filter((a) => readIds && now !== null && isNewAnnouncement(a, readIds, now)).map((a) => a.id);
    await markRead(supabase, unread);
    setReadIds(new Set([...(readIds ?? []), ...unread]));
  };

  const gameNames = useMemo(() => Object.fromEntries(games.map((g) => [g.id, g.name])), [games]);
  const sorted = useMemo(() => sortFeed(rows), [rows]);
  const unfiltered = filter === 'all' && !game && !q.trim();
  const visible = useMemo(() => sorted.filter((a) => matchesFeedQuery(a, { filter, game, q })), [sorted, filter, game, q]);
  const featured = unfiltered ? pickFeatured(visible) : [];
  const gridRows = visible.filter((a) => !featured.includes(a));
  const unreadCount = readIds && now !== null ? rows.filter((a) => isNewAnnouncement(a, readIds, now)).length : 0;
  const newCount = pending ? pending.filter((a) => !rows.some((b) => b.id === a.id)).length : 0;

  if (loading) return <FeedSkeleton />;

  const actionsFor = (a: FeedAnnouncement) => canPost ? (
    <div className="flex items-center gap-4 text-xs font-black uppercase tracking-wider">
      <button type="button" onClick={() => openEditor(a)} className="text-maroon underline underline-offset-2 cursor-pointer">Edit</button>
      <button type="button" onClick={() => handleDelete(a)} className="text-red-700 underline underline-offset-2 cursor-pointer">Delete</button>
    </div>
  ) : undefined;

  const chip = (on: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
      on ? 'border-ink bg-ink text-gold shadow-xs' : 'border-stone-200 bg-white text-stone-700 hover:border-gold hover:text-stone-950'
    }`;

  return (
    <div className="space-y-6">
      {confirmDialog}

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}

      {canPost && !editing && (
        <div className="flex justify-end">
          <button type="button" onClick={() => openEditor('new')} className="btn btn-primary"><Plus className="size-4" aria-hidden="true" /> New announcement</button>
        </div>
      )}
      <div ref={editorRef} className="scroll-mt-24">
        {canPost && editing && (
          <AnnouncementEditor
            key={editing === 'new' ? 'new' : editing.id}
            existing={editing === 'new' ? undefined : editing}
            games={games}
            tournaments={tournaments}
            onCancel={closeEditor}
            onSaved={() => { closeEditor(); reload(true); }}
          />
        )}
      </div>

      {/* Filters: category chips, game chips, search */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 @5xl:flex-row @5xl:items-center @5xl:justify-between">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" role="group" aria-label="Category">
            {FEED_FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={chip(filter === f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative w-full @5xl:w-80 shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" aria-hidden="true" />
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search announcements"
              aria-label="Search announcements"
              className="h-11 w-full rounded-full border border-stone-300 bg-white pl-10 pr-10 text-sm font-medium text-stone-950 shadow-xs outline-none placeholder:text-stone-500 focus:border-amber-600 focus:bg-surface focus:ring-2 focus:ring-amber-500/20"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-600 hover:bg-stone-100 cursor-pointer" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GameFilterChips games={games} value={game} onChange={setGame} />
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-maroon cursor-pointer hover:underline">
                <CheckCheck className="size-4" aria-hidden="true" /> Mark {unreadCount} as read
              </button>
            )}
            <AutoUpdateBadge />
          </div>
        </div>
      </div>

      {/* "1 new post · Show" pill (Realtime) */}
      {newCount > 0 && (
        <div className="sticky top-20 z-30 flex justify-center" aria-live="polite">
          <button type="button" onClick={showPending} className="new-post-pill inline-flex items-center gap-2 rounded-full border border-golddark bg-gold px-5 py-2.5 text-xs font-black uppercase tracking-widest text-ink shadow-lg cursor-pointer hover:bg-golddark">
            <ArrowUp className="size-4" aria-hidden="true" /> {newCount} new post{newCount === 1 ? '' : 's'} · Show
          </button>
        </div>
      )}

      {rows.length === 0 && !error ? (
        <EmptyState />
      ) : visible.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <SearchX className="size-10 text-stone-500" aria-hidden="true" />
          <p className="font-black text-stone-950">No posts match these filters.</p>
          <button type="button" className="btn btn-secondary" onClick={() => { setFilter('all'); setGame(''); setQ(''); }}>Clear filters</button>
        </div>
      ) : (
        <>
          <AnnouncementHero featured={featured} readIds={readIds} gameNames={gameNames} />
          {gridRows.length > 0 && (
            <div className={grid}>
              {gridRows.map((a, i) => (
                <Reveal key={a.id} delay={(i % 4) as 0 | 1 | 2 | 3} className="h-full">
                  <AnnouncementFeedCard
                    a={a} readIds={readIds} gameName={a.game_id ? gameNames[a.game_id] : null}
                    reactions={reactions[a.id]} actions={actionsFor(a)} priority={i < 3}
                  />
                </Reveal>
              ))}
            </div>
          )}
          {canPost && featured.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-stone-200 bg-white p-4 text-xs">
              <span className="font-black uppercase tracking-wider text-stone-700">Featured:</span>
              {featured.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-3">
                  <span className="max-w-56 truncate font-semibold text-stone-950">{a.title}</span>
                  {actionsFor(a)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Friendly empty state with an illustration made of icons
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-stone-200/90 bg-white px-6 py-16 text-center shadow-xs">
      <div className="relative grid size-28 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-gold/15" />
        <span className="absolute inset-4 rounded-full bg-gold/25" />
        <span className="relative grid size-16 place-items-center rounded-2xl bg-ink text-gold shadow-md -rotate-6">
          <Megaphone className="size-8" />
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-lg font-black text-stone-950">No announcements yet.</p>
        <p className="text-sm text-stone-600">Check back soon! Tournament news, match updates and results will show up here.</p>
      </div>
    </div>
  );
}

export function FeedSkeleton({ hero = true, count = 6 }: { hero?: boolean; count?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading announcements">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-10 w-28 shrink-0 rounded-full bg-stone-200 shimmer-light" />)}
      </div>
      {hero && <div className="h-96 rounded-3xl bg-stone-200 shimmer-light" />}
      <div className={grid}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs shimmer-light">
            <div className="aspect-video bg-stone-100" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-20 rounded-md bg-stone-200" />
              <div className="h-5 w-4/5 rounded-md bg-stone-200" />
              <div className="h-3.5 w-full rounded-md bg-stone-100" />
              <div className="h-3.5 w-2/3 rounded-md bg-stone-100" />
              <div className="flex items-center gap-2 border-t border-stone-100 pt-3">
                <span className="size-8 rounded-full bg-stone-200" />
                <span className="h-3.5 w-24 rounded-md bg-stone-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
