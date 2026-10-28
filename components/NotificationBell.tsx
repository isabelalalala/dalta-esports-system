'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import {
  fetchNotifications, fetchUnreadCount, markAllAsRead, markAsRead, notificationIcons, timeAgo,
  type AppNotification,
} from '@/utils/notifications';

// Bell with the unread count (kept up to date with Supabase Realtime) and a dropdown
// with the latest notifications. Shown in the header (components/site/SiteAuthButtons.tsx).
export default function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  // Increase this to load the count (and the list, when open) again
  const [reloadCount, setReloadCount] = useState(0);

  // Any change to my notifications (new one, marked as read) -> reload.
  // The filter is a convenience; RLS already only sends this user's rows.
  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => setReloadCount((n) => n + 1)
      )
      .subscribe();

    // Stop listening when logging out or leaving the app
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    const load = async () => {
      try {
        setUnread(await fetchUnreadCount(supabase));
        if (open) setItems(await fetchNotifications(supabase, { limit: 10 }));
      } catch {
        // The bell is not important enough to show an error; it tries again on the next change
      }
    };
    load();
  }, [supabase, open, reloadCount]);

  // Escape closes the dropdown (the invisible overlay only covers pointer users)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleClick = async (n: AppNotification) => {
    setOpen(false);
    if (!n.is_read) {
      try {
        await markAsRead(supabase, n.id);
      } catch {
        // Still open the link even if marking as read failed
      }
    }
    if (n.link) router.push(n.link);
    setReloadCount((c) => c + 1);
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead(supabase);
      setReloadCount((c) => c + 1);
    } catch {
      // Ignored; the count stays as it was
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 text-stone-700 hover:text-stone-950 shadow-xs transition-all"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold grid place-items-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Clicking anywhere outside closes the list */}
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close notifications" />

          {/* Phones: a full-width panel under the header (the bell isn't at the screen edge, so a
              dropdown anchored to it would stick out on the left). Larger screens: under the bell. */}
          <div className="fixed inset-x-4 top-20 z-50 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[22rem] bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden uppercase">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50/80">
              <span className="font-extrabold text-stone-950 text-xs tracking-wider">Notifications</span>
              <button onClick={handleMarkAll} disabled={unread === 0} className="text-xs text-amber-700 hover:text-amber-900 font-bold uppercase tracking-wider disabled:opacity-40 disabled:no-underline">
                Mark all as read
              </button>
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-stone-500 font-medium tracking-wider">No notifications yet.</p>
            ) : (
              <ul className="max-h-[60vh] sm:max-h-96 overflow-y-auto divide-y divide-stone-100">
                {items.map((n) => {
                  // The DB may hold a type this build doesn't know yet — fall back instead of crashing
                  const Icon = notificationIcons[n.type] ?? Bell;
                  return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-amber-50/60 transition-colors ${n.is_read ? 'opacity-60' : ''}`}
                    >
                      <Icon className="h-4 w-4 mt-1 shrink-0 text-amber-700" />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-extrabold text-stone-950 text-xs sm:text-sm min-w-0 break-words">{n.title}</span>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" role="img" aria-label="unread" />}
                        </span>
                        <span className="block text-xs text-stone-600 line-clamp-2 mt-0.5 normal-case">{n.message}</span>
                        <span className="block text-[10px] text-stone-400 mt-1">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm text-gold py-3 border-t border-brown hover:bg-gold/5"
            >
              See all →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
