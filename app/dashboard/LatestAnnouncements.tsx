'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Announcement } from '@/utils/types';
import AnnouncementCard from '@/components/AnnouncementCard';

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
    <div className="mt-8 bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-[#00d2ff]">📢 Latest Announcements</h2>
        <Link href="/announcements" className="text-sm text-[#00d2ff] hover:underline">View all →</Link>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : error ? (
        <p className="text-red-300">{error}</p>
      ) : announcements.length === 0 ? (
        <p className="text-gray-400">No announcements yet.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} compact />
          ))}
        </div>
      )}
    </div>
  );
}
