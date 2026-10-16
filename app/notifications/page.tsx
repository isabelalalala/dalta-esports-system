'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import {
  fetchNotifications, markAllAsRead, markAsRead, notificationIcons, type AppNotification,
} from '@/utils/notifications';
import PageLoading from '@/components/PageLoading';

const PAGE_SIZE = 30;

// Full notification history (the bell in the header shows only the latest).
export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  // Increase this to load the first page again
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

  const handleMarkRead = async (n: AppNotification) => {
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

  if (loading) return <PageLoading />;

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Notifications</h1>
            <button onClick={handleMarkAll} className="border border-gold text-gold px-4 py-2 font-bold hover:bg-gold/10">
              Mark all as read
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              onClick={() => setUnreadOnly(value)}
              className={`px-4 py-2 font-bold border ${unreadOnly === value
                ? 'bg-gold text-black border-gold'
                : 'border-brownlight text-gray-300 hover:bg-gold/10'}`}
            >
              {value ? 'Unread' : 'All'}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}

        {items.length === 0 ? (
          <p className="text-gray-400 text-center py-12">
            {unreadOnly ? 'You have no unread notifications.' : 'No notifications yet.'}
          </p>
        ) : (
          <ul className="bg-sitecard border border-brown divide-y divide-brown">
            {items.map((n) => (
              <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.is_read ? 'opacity-60' : ''}`}>
                <span className="text-xl leading-none mt-0.5">{notificationIcons[n.type]}</span>
                <button onClick={() => handleOpen(n)} className="flex-1 min-w-0 text-left">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{n.title}</span>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-gold" aria-label="unread" />}
                  </span>
                  <span className="block text-gray-300 text-sm">{n.message}</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    {new Date(n.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </button>
                {!n.is_read && (
                  <button onClick={() => handleMarkRead(n)} className="text-xs text-gold hover:underline self-center shrink-0">
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="border border-gold text-gold px-6 py-2 font-bold hover:bg-gold/10 disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
