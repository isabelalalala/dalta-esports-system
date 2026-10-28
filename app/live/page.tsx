'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Stream } from '@/utils/types';
import { streamStatusStyles } from '@/utils/streams';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';

export default function LiveStreamsPage() {
  const supabase = createClient();
  usePageTitle('Live Streams');
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

  const section = (title: ReactNode, list: Stream[], emptyText: string) => (
    <section className="space-y-4">
      <div className="pb-2 border-b border-stone-200/80">
        <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider uppercase">{title}</h2>
      </div>
      {list.length === 0 ? (
        <p className="text-stone-500 font-bold py-6">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {list.map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              className={`block bg-white border rounded-2xl p-6 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all text-stone-950 ${
                s.status === 'live' ? 'border-red-500/80 ring-2 ring-red-500/10' : 'border-stone-200/90 hover:border-stone-300'
              }`}
            >
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-black uppercase mb-3 ${streamStatusStyles[s.status]}`}>
                {s.status === 'live' ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                    <span>Live Now</span>
                  </>
                ) : s.status === 'ended' ? (
                  'Replay'
                ) : (
                  'Scheduled'
                )}
              </span>
              <h3 className="text-base sm:text-lg font-black text-stone-950 tracking-wide uppercase">{s.title}</h3>
              <p className="text-xs sm:text-sm text-stone-500 font-semibold tracking-wider mt-1">
                {s.tournaments?.name} · {s.tournaments?.game}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  if (loading) return <PageLoading />;

  const live = streams.filter((s) => s.status === 'live');
  const scheduled = streams.filter((s) => s.status === 'scheduled');
  const ended = streams.filter((s) => s.status === 'ended');

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Live Streams Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Live Streams
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Watch real-time matches, scheduled tournament streams, and full game replays.
          </p>
        </div>
      </section>

      {/* 2. Streams Feed */}
      <div className="space-y-8 text-stone-950">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}

        {section('Live Broadcasts', live, 'No matches are broadcasting live right now.')}
        {section('Upcoming Streams', scheduled, 'No upcoming match streams scheduled at the moment.')}
        {section('Past Broadcasts & Replays', ended, 'No past stream replays available.')}
      </div>
    </div>
  );
}
