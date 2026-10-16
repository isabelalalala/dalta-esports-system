'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Registration, RegistrationStatus, Tournament } from '@/utils/types';
import { formatDate } from '@/utils/tournaments';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';

type MyRegistration = Registration & {
  tournaments: Pick<Tournament, 'id' | 'name' | 'game' | 'start_date'> | null;
};

const statusStyles: Record<RegistrationStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/50',
  approved: 'bg-green-500/15 text-green-300 border-green-500/50',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/50',
  cancelled: 'bg-gray-500/15 text-gray-400 border-gray-500/50',
};

// Registrations of every team the player is on, as captain or member
export default function MyRegistrationsPage() {
  const supabase = createClient();
  usePageTitle('My registrations');
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: memberRows, error: membersError } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', session.user.id);
        if (membersError) throw membersError;

        const teamIds = (memberRows || []).map((r) => r.team_id as string);
        if (teamIds.length === 0) return;

        const { data, error: regsError } = await supabase
          .from('tournament_registrations')
          .select('*, teams(*), tournaments(id, name, game, start_date)')
          .in('team_id', teamIds)
          .order('registered_at', { ascending: false });
        if (regsError) throw regsError;
        setRegistrations(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load your registrations'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  // Withdraw = delete the pending registration, so the team can register again later.
  const handleWithdraw = async (reg: MyRegistration) => {
    if (!confirm(`Withdraw ${reg.teams?.name} from ${reg.tournaments?.name}?`)) return;
    setBusyId(reg.id);
    setError('');

    try {
      // RLS only allows the captain, and only while pending. A blocked delete
      // returns no error and no rows, so check that something was deleted.
      const { data, error: deleteError } = await supabase
        .from('tournament_registrations')
        .delete()
        .eq('id', reg.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) {
        throw new Error('Only the captain can withdraw, and only while the registration is pending.');
      }
      setRegistrations((current) => current.filter((r) => r.id !== reg.id));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to withdraw'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
          ← Back to Dashboard
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold mb-8">My Registrations</h1>

        {error && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>
        )}

        {/* A failed load shows the error above, not "nothing here" */}
        {registrations.length === 0 && error ? null : registrations.length === 0 ? (
          <div className="text-center bg-sitecard border border-brown p-12 text-gray-400">
            Your teams haven&apos;t registered for any tournament yet.{' '}
            <Link href="/tournaments" className="text-gold underline">Browse tournaments</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {registrations.map((reg) => {
              const isCaptain = reg.teams?.captain_id === userId;

              return (
                <li
                  key={reg.id}
                  className="bg-sitecard border border-brownlight p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/tournaments/${reg.tournament_id}`} className="font-bold text-lg hover:text-gold">
                        {reg.tournaments?.name}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusStyles[reg.status]}`}>
                        {reg.status}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {reg.teams?.name}
                      {isCaptain && <span className="text-yellow-400"> (you&apos;re captain)</span>}
                      {' · '}{reg.tournaments?.game} · starts {formatDate(reg.tournaments?.start_date)}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Registered {new Date(reg.registered_at).toLocaleDateString()}
                    </p>
                  </div>

                  {isCaptain && reg.status === 'pending' && (
                    <button
                      onClick={() => handleWithdraw(reg)}
                      disabled={busyId === reg.id}
                      className="border border-red-500 text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 font-semibold transition disabled:opacity-50"
                    >
                      {busyId === reg.id ? 'Withdrawing...' : 'Withdraw'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
