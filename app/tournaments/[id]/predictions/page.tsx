'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import PickemLeaderboard from '../PickemLeaderboard';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Target } from 'lucide-react';

// Pick'em leaderboard of one tournament (logged-in users; names are "first name + initial")
export default function PredictionsLeaderboardPage() {
  usePageTitle('Tournament predictions');
  const supabase = createClient();
  const params = useParams();
  const id = params?.id as string;
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.from('tournaments').select('name').eq('id', id).single();
        if (loadError) throw loadError;
        setName(data.name);
      } catch (err) {
        setError(getErrorMessage(err, 'Tournament not found. It may have been deleted.'));
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [supabase, id]);

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} backHref="/tournaments" backLabel="Back to Tournaments" />;

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to {name || 'Tournament'}
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-4 h-4 text-[#FFCC37]" /> Community Predictions
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Pick&apos;em Leaderboard
          </h1>
          <p
            className="text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Ranked by correct picks across matches. Higher accuracy ranks higher.
          </p>
        </div>
      </section>

      {/* 2. Leaderboard Container */}
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Standings</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
              Prediction Rankings
            </h2>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider mt-1">
              Picks close when each match begins. Make yours on the{' '}
              <Link href={`/tournaments/${id}`} className="text-[#5B271E] font-black underline hover:text-[#FFCC37]">
                tournament bracket
              </Link>
              .
            </p>
          </div>

          <PickemLeaderboard tournamentId={id} />
        </div>
      </div>
    </div>
  );
}
