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
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href={`/tournaments/${id}`} className="inline-block text-gold hover:underline">← {name}</Link>
        <div>
          <h1 className="font-pixel text-lg sm:text-2xl leading-relaxed text-gold break-words">Pick&apos;em Leaderboard</h1>
          <p className="text-gray-400 mt-2">
            Ranked by correct picks; with the same number, fewer decided picks (better accuracy) ranks higher. Picks
            close when a match starts. Make yours in the bracket on the{' '}
            <Link href={`/tournaments/${id}`} className="text-gold underline">tournament page</Link>.
          </p>
        </div>
        <PickemLeaderboard tournamentId={id} />
      </div>
    </main>
  );
}
