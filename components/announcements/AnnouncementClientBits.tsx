'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useViewer } from '@/utils/use-viewer';
import { useBreadcrumbName } from '@/utils/breadcrumb-names';
import { can } from '@/utils/permissions';
import { markRead } from '@/utils/announcements-data';
import { FEED_URL_KEY } from '@/components/announcements/AnnouncementFeed';

// "Back to announcements" with the filters the reader had on the feed (saved in sessionStorage)
export function BackToFeed({ className = '' }: { className?: string }) {
  const [href, setHref] = useState('/announcements');
  useEffect(() => {
    // After hydration (the server doesn't know the saved filters)
    const timer = setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(FEED_URL_KEY);
        // Only our own query string (?filter=...), never a full address
        if (saved && saved.startsWith('?')) setHref(`/announcements${saved}`);
      } catch { /* storage blocked: plain link */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink/70 px-3.5 text-xs font-black uppercase tracking-wider text-gold backdrop-blur-sm hover:bg-ink ${className}`}>
      <ArrowLeft className="size-4" aria-hidden="true" /> Back to announcements
    </Link>
  );
}

// Marks the post as read for a logged-in user (NEW badge) and names the breadcrumb
export function ReadTracker({ id, title }: { id: string; title: string }) {
  const viewer = useViewer();
  useBreadcrumbName(title);
  useEffect(() => {
    if (viewer.status === 'ready' && viewer.userId) markRead(createClient(), [id]);
  }, [id, viewer.status, viewer.userId]);
  return null;
}

// Edit button for admins (opens the editor on the feed)
export function EditAnnouncementLink({ id }: { id: string }) {
  const viewer = useViewer();
  if (!can(viewer.role, 'announcement.post')) return null;
  return (
    <Link href={`/announcements?edit=${id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/30 px-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-gold hover:border-gold hover:text-stone-950 transition-colors">
      <Pencil className="size-4" aria-hidden="true" /> Edit
    </Link>
  );
}
