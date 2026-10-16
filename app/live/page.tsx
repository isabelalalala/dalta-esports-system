'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Stream } from '@/utils/types';
import { streamStatusStyles } from '@/utils/streams';
import PageLoading from '@/components/PageLoading';

// "Watch live stream" (use case, Audience): every stream, live ones first
export default function LiveStreamsPage() {
  const supabase = createClient();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error: streamsError } = await supabase
          .from('streams')
          .select('*, tournaments(id, name, game)')
          .order('updated_at', { ascending: false });
        if (streamsError) throw streamsError;
        setStreams(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load streams'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const section = (title: string, list: Stream[], emptyText: string) => (
    <section>
      <h2 className="text-2xl font-bold mb-3">{title}</h2>
      {list.length === 0 ? (
        <p className="text-gray-500">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {list.map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              className={`block bg-sitecard border p-4 hover:border-gold transition ${
                s.status === 'live' ? 'border-red-500/70' : 'border-brownlight'
              }`}
            >
              <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase mb-2 ${streamStatusStyles[s.status]}`}>
                {s.status === 'live' ? '● Live' : s.status === 'ended' ? 'Replay' : 'Scheduled'}
              </span>
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="text-sm text-gray-400">
                {s.tournaments?.name} · {s.tournaments?.game}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  if (loading) return <PageLoading />;

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-10">
        <div>
          <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Live Streams</h1>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}

        {section('🔴 Live now', streams.filter((s) => s.status === 'live'), 'Nothing is live right now.')}
        {section('Upcoming', streams.filter((s) => s.status === 'scheduled'), 'No streams scheduled.')}
        {section('Replays', streams.filter((s) => s.status === 'ended'), 'No replays yet.')}
      </div>
    </div>
  );
}
