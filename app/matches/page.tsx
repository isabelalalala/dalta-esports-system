'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Profile, Tournament } from '@/utils/types';
import { formatDate, getTournamentStatus, statusLabels, statusStyles } from '@/utils/tournaments';
import ExportButtons from '@/components/ExportButtons';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';

// Tournament with the number of matches in its bracket
type TournamentWithMatches = Tournament & { matches: { count: number }[] };

export default function MatchesOverviewPage() {
  const supabase = createClient();
  const [tournaments, setTournaments] = useState<TournamentWithMatches[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
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

  // Hiding the page is only for convenience; the database refuses changes from other roles.
  if (!profile && error) return <PageError message={error} />;
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
    return (
      <div className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only organizers can manage matches.{' '}
        <Link href="/dashboard" className="text-gold underline">Back to the dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
          ← Back to Dashboard
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold mb-4">Match Management</h1>
        <div className="mb-8">
          <ExportButtons type="rosters" label="All team rosters" />
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>
        )}

        {/* A failed load shows the error above, not "nothing here" */}
        {tournaments.length === 0 && error ? null : tournaments.length === 0 ? (
          <p className="text-gray-400">No tournaments yet.</p>
        ) : (
          <ul className="space-y-3">
            {tournaments.map((t) => {
              const matchCount = t.matches?.[0]?.count || 0;
              const status = getTournamentStatus(t);

              return (
                <li
                  key={t.id}
                  className="bg-sitecard border border-brownlight p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-lg">{t.name}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {t.game} · {formatDate(t.start_date)} – {formatDate(t.end_date)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {matchCount > 0 ? (
                      <Link
                        href={`/tournaments/${t.id}/matches`}
                        className="bg-gold text-black px-4 py-2 font-bold hover:bg-golddark transition text-center"
                      >
                        Manage {matchCount} matches
                      </Link>
                    ) : (
                      <Link href={`/tournaments/${t.id}`} className="text-gray-400 text-sm hover:text-white">
                        No bracket yet. Generate it on the tournament page →
                      </Link>
                    )}
                    <Link href={`/tournaments/${t.id}/streams`} className="text-red-300 text-sm font-semibold hover:underline">
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
