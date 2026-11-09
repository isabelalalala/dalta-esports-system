'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, TriangleAlert, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { urgentToShow } from '@/utils/announcements';

const DISMISSED_KEY = 'dalta:urgent-dismissed';
// Urgent posts older than this stop showing in the banner (they stay in the feed)
const BANNER_DAYS = 7;

interface UrgentRow { id: string; title: string; publish_at: string }

function readDismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// Site-wide strip under the header for the newest urgent announcement (schedule changes,
// cancellations). Each visitor can dismiss it; the choice is remembered in this browser only.
// Loads after the page (nothing on the server), so it never delays or changes the first paint.
export default function UrgentBanner() {
  const [rows, setRows] = useState<UrgentRow[]>([]);
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - BANNER_DAYS * 86_400_000).toISOString();
    const { data } = await createClient()
      .from('announcements')
      .select('id, title, publish_at')
      .or('is_urgent.eq.true,category.eq.urgent')
      .eq('is_draft', false)
      .lte('publish_at', new Date().toISOString())
      .gte('publish_at', since)
      .order('publish_at', { ascending: false })
      .limit(5);
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDismissed(readDismissed());
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  useRealtimeRefresh('urgent-banner', [{ table: 'announcements' }], load, 1500);

  const post = dismissed ? urgentToShow(rows, dismissed) : null;
  if (!post) return null;

  const dismiss = () => {
    // Keep only recent ids so the list doesn't grow forever
    const next = [post.id, ...(dismissed ?? [])].slice(0, 30);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setDismissed(next);
  };

  return (
    <div className="urgent-banner border-b-2 border-red-600 bg-ink text-white shadow-sm print:hidden" role="region" aria-label="Urgent announcement">
      <div className="flex items-center gap-3 px-4 sm:px-8 py-2 text-xs sm:text-sm font-bold">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-widest">
          <TriangleAlert className="size-3.5" aria-hidden="true" /> Urgent
        </span>
        <span className="min-w-0 flex-1 truncate">{post.title}</span>
        <Link href={`/announcements/${post.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-black uppercase tracking-wider hover:bg-white/20">
          Read <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <button type="button" onClick={dismiss} aria-label="Dismiss the urgent announcement" className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-white/15 cursor-pointer">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
