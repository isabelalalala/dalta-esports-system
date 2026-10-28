'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Announcement } from '@/utils/types';
import AnnouncementCard from '@/components/AnnouncementCard';
import { SectionLoading } from '@/components/PageLoading';
import { Megaphone } from 'lucide-react';

// The 3 newest announcements (pinned first), shown on every role's dashboard
export default function LatestAnnouncements() {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error: annError } = await supabase
          .from('announcements')
          .select('*, tournaments(id, name)')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(3);
        if (annError) throw annError;
        setAnnouncements(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load announcements'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  return (
    <section className="w-full rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6 uppercase">
      <div className="flex justify-between items-center pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider">
              Latest Announcements
            </h2>
            <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
              News and updates from tournament organizers
            </p>
          </div>
        </div>
        <Link
          href="/announcements"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-black text-amber-700 hover:text-amber-800 hover:bg-amber-50/50 tracking-wider shadow-2xs transition-all"
        >
          <span>View all</span>
          <span>→</span>
        </Link>
      </div>

      {loading ? (
        <SectionLoading />
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold tracking-wider" role="alert">
          {error}
        </div>
      ) : announcements.length === 0 ? (
        <div className="p-8 rounded-2xl bg-stone-50/70 border border-stone-200/80 text-center">
          <p className="text-stone-500 text-xs font-bold tracking-wider">No announcements posted yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} compact />
          ))}
        </div>
      )}
    </section>
  );
}
