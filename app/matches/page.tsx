'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Profile, Tournament } from '@/utils/types';
import { formatDate, getTournamentStatus, statusLabels, statusStyles } from '@/utils/tournaments';
import { usePageTitle } from '@/utils/page-title';
import ExportButtons from '@/components/ExportButtons';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import PageHeroBackground from '@/components/site/PageHeroBackground';

type TournamentWithMatches = Tournament & { matches: { count: number }[] };

export default function MatchesOverviewPage() {
  const supabase = createClient();
  usePageTitle('Match Management');
  const [tournaments, setTournaments] = useState<TournamentWithMatches[]>([]);
  const [profile, setProfile] = useState<Pick<Profile, 'id' | 'role'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);

        const { data, error: tourError } = await supabase
          .from('tournaments')
          .select('*, matches(count)')
          .order('start_date', { ascending: false });
        if (tourError) throw tourError;
        setTournaments(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load tournaments'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  if (loading) return <PageLoading />;
  if (!profile && error) return <PageError message={error} />;
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only tournament organizers can manage matches.</p>
        <Link href="/dashboard" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Back to the dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Match Banner" />

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
            Match Management
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Schedule and manage match series, brackets, and live stream broadcasts.
          </p>
        </div>
      </section>

      {/* 2. Content & Tournament Match Cards */}
      <div className="space-y-6 text-stone-950">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ExportButtons type="rosters" label="All team rosters" />
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}

        {tournaments.length === 0 && error ? null : tournaments.length === 0 ? (
          <p className="text-stone-500 text-center py-12 font-bold tracking-wider">No tournaments active yet.</p>
        ) : (
          <ul className="space-y-4">
            {tournaments.map((t) => {
              const matchCount = t.matches?.[0]?.count || 0;
              const status = getTournamentStatus(t);

              return (
                <li
                  key={t.id}
                  className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs hover:border-stone-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-stone-950"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-black text-stone-950 text-base sm:text-lg tracking-wide">{t.name}</span>
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${statusStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
                    </div>
                    <p className="text-stone-500 font-medium text-xs tracking-wider">
                      {t.game} · {formatDate(t.start_date)} – {formatDate(t.end_date)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {matchCount > 0 ? (
                      <Link
                        href={`/tournaments/${t.id}/matches`}
                        className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-5 py-2.5 text-xs tracking-wider shadow-xs hover:-translate-y-0.5 border border-amber-400 transition-all text-center"
                      >
                        Manage {matchCount} Matches
                      </Link>
                    ) : (
                      <Link
                        href={`/tournaments/${t.id}`}
                        className="text-stone-600 hover:text-stone-950 text-xs font-bold underline"
                      >
                        Generate Bracket →
                      </Link>
                    )}
                    <Link
                      href={`/tournaments/${t.id}/streams`}
                      className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-800 font-bold px-4 py-2.5 text-xs tracking-wider transition-all"
                    >
                      Streams
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
