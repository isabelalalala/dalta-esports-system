'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { Bell, Check, CheckCheck, ChevronRight } from 'lucide-react';
import {
  fetchNotifications, markAllAsRead, markAsRead, notificationIcons, type AppNotification,
} from '@/utils/notifications';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';

const PAGE_SIZE = 30;

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  usePageTitle('Notifications');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const page = await fetchNotifications(supabase, { limit: PAGE_SIZE, unreadOnly });
        setItems(page);
        setHasMore(page.length === PAGE_SIZE);
        setError('');
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load notifications'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, unreadOnly, reloadCount]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchNotifications(supabase, { offset: items.length, limit: PAGE_SIZE, unreadOnly });
      setItems((current) => [...current, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load more notifications'));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpen = async (n: AppNotification) => {
    try {
      if (!n.is_read) await markAsRead(supabase, n.id);
    } catch {
      // Still open the link
    }
    if (n.link) router.push(n.link);
    else setReloadCount((c) => c + 1);
  };

  const handleMarkRead = async (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    try {
      await markAsRead(supabase, n.id);
      setReloadCount((c) => c + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark as read'));
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead(supabase);
      setReloadCount((c) => c + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark all as read'));
    }
  };

  if (loading) return <PageLoading label="Loading notifications..." />;

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Notifications Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Notifications
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Match alerts, tournament registrations, verification updates, and organizer notices.
          </p>
        </div>
      </section>

      {/* 2. Controls & Actions Bar */}
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs"
          >
            {error}
          </div>
        )}

        <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: false, label: 'All Notifications' },
              { id: true, label: `Unread Only (${unreadCount})`, highlight: unreadCount > 0 },
            ].map(({ id, label, highlight }) => (
              <button
                key={String(id)}
                onClick={() => setUnreadOnly(id)}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer ${
                  unreadOnly === id
                    ? 'bg-gold text-stone-950 border border-amber-400 shadow-xs'
                    : highlight
                    ? 'bg-stone-50 text-[#5B271E] border border-[#5B271E]/20 hover:bg-[#FFCC37]/15'
                    : 'bg-stone-100 text-stone-700 hover:text-[#5B271E] hover:bg-stone-200/80 border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="rounded-xl border border-stone-300 hover:border-[#FFCC37] bg-white text-stone-800 hover:text-[#5B271E] font-bold px-4 py-2 text-xs tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs hover:-translate-y-0.5"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#5B271E]" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Notifications List */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-12 text-center text-stone-500 font-bold tracking-wider text-xs">
            {unreadOnly ? 'You have no unread notifications.' : 'No notifications yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const Icon = notificationIcons[n.type] ?? Bell;
              const isUnread = !n.is_read;

              return (
                <div
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={`rounded-2xl p-5 border transition-all cursor-pointer flex items-start gap-4 ${
                    isUnread
                      ? 'bg-white border-amber-400/90 shadow-xs ring-1 ring-amber-400/20 hover:border-amber-500'
                      : 'bg-white/80 border-stone-200/90 shadow-2xs hover:bg-white hover:border-stone-300'
                  }`}
                >
                  {/* Icon badge */}
                  <div
                    className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                      isUnread
                        ? 'bg-[#5B271E]/10 text-[#5B271E] border border-[#5B271E]/20'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Body content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm ${isUnread ? 'font-black text-stone-950' : 'font-bold text-stone-800'}`}>
                        {n.title}
                      </p>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-[#FFCC37]" />
                      )}
                    </div>

                    <p className="text-xs text-stone-600 font-medium normal-case leading-relaxed">
                      {n.message}
                    </p>

                    <p className="text-[11px] font-semibold text-stone-400 tracking-wider pt-1">
                      {new Date(n.created_at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="shrink-0 flex items-center gap-2 self-center">
                    {isUnread && (
                      <button
                        onClick={(e) => handleMarkRead(e, n)}
                        title="Mark as read"
                        className="p-2 rounded-xl text-stone-400 hover:text-[#5B271E] hover:bg-[#FFCC37]/20 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {n.link && (
                      <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="text-center pt-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-800 font-black px-6 py-2.5 text-xs tracking-wider transition-all shadow-xs hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? 'Loading more...' : 'Load more notifications'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
