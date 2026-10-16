'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { ACTIVE_REGISTRATION_STATUSES } from '@/utils/types';
import type { Registration, RegistrationStatus, Team, Tournament } from '@/utils/types';
import ExportButtons from '@/components/ExportButtons';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';

const statusStyles: Record<RegistrationStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/50',
  approved: 'bg-green-500/15 text-green-300 border-green-500/50',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/50',
  cancelled: 'bg-gray-500/15 text-gray-400 border-gray-500/50',
};

export default function RegistrationsPage() {
  usePageTitle('Tournament registrations');
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: tournamentData, error: tournError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();

        if (tournError) throw tournError;
        setTournament(tournamentData);

        // Registrations with their team, the team's game, member count and captain.
        // The captain's name is only readable by admin/staff (profiles RLS).
        // members: each member's verification, for the "x / y verified" count.
        const { data: regsData, error: regsError } = await supabase
          .from('tournament_registrations')
          .select('*, teams(*, games(*), team_members(count), captain:profiles(full_name, email), members:team_members(profiles(is_verified)))')
          .eq('tournament_id', id)
          .order('registered_at', { ascending: false });

        if (regsError) throw regsError;
        setRegistrations(regsData || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load registrations'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, supabase]);

  const handleSetStatus = async (registrationId: string, status: RegistrationStatus) => {
    setBusyId(registrationId);
    setError('');

    try {
      // .select() returns the changed rows. If RLS blocked the change,
      // Supabase gives no error but an empty list, so check for that.
      const { data, error: updateError } = await supabase
        .from('tournament_registrations')
        .update({ status })
        .eq('id', registrationId)
        .select('id');

      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error('You don\'t have permission to change this registration.');

      setRegistrations((current) =>
        current.map((r) => (r.id === registrationId ? { ...r, status } : r))
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update registration'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (registrationId: string) => {
    if (!confirm('Are you sure you want to remove this registration?')) return;

    setBusyId(registrationId);
    setError('');

    try {
      const { data, error: deleteError } = await supabase
        .from('tournament_registrations')
        .delete()
        .eq('id', registrationId)
        .select('id');

      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('You don\'t have permission to remove this registration.');

      setRegistrations((current) => current.filter((r) => r.id !== registrationId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete registration'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <PageLoading label="Loading registrations..." />;
  }

  // Only pending + approved registrations take up a slot
  const activeCount = registrations.filter((r) => ACTIVE_REGISTRATION_STATUSES.includes(r.status)).length;

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <Link href={`/tournaments/${id}`} className="inline-block text-gold hover:underline mb-6">
          ← Back to Tournament
        </Link>

        <div className="mb-8">
          <div>
            <h1 className="font-pixel text-lg sm:text-2xl leading-relaxed text-gold break-words">{tournament?.name}</h1>
            <p className="text-gray-400 text-lg mt-2">Tournament Registrations</p>
          </div>
        </div>

        {/* Downloads (built on the server, which checks the role and logs each export) */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6">
          <ExportButtons type="registrations" label="Registrations" params={{ tournament: id }} />
          <ExportButtons type="rosters" label="Team rosters" params={{ tournament: id }} />
        </div>

        {error && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3">
            {error}
          </div>
        )}

        {/* A failed load shows the error above, not "nothing here" */}
        {registrations.length === 0 && error ? null : registrations.length === 0 ? (
          <div className="text-center bg-sitecard border border-brown p-12">
            <p className="text-gray-400">No registrations yet.</p>
          </div>
        ) : (
          <div className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] overflow-hidden">
            {/* Header */}
            <div className="bg-gold text-black font-bold px-6 py-4 hidden md:grid grid-cols-12 gap-4">
              <div className="col-span-3">Team</div>
              <div className="col-span-3">Captain</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Date</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-brown">
              {registrations.map((reg) => {
                const captain = reg.teams?.captain;
                const busy = busyId === reg.id;

                return (
                  <div key={reg.id} className="px-4 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:bg-sitebg/50 transition">
                    <div className="md:col-span-3 font-semibold text-white">
                      {/* Older registrations have no team, only the typed team_name */}
                      {reg.teams?.name || reg.team_name || 'Unnamed Team'}
                      {reg.teams && (
                        <span className="block text-gray-400 text-sm font-normal">
                          {reg.teams.team_members?.[0]?.count || 0} / {reg.teams.games?.max_players} players
                          {tournament?.requires_verification && <VerifiedCount team={reg.teams} />}
                        </span>
                      )}
                    </div>
                    <div className="md:col-span-3 text-gray-300 text-sm break-all md:break-normal">
                      {captain ? captain.full_name || captain.email : '—'}
                    </div>
                    <div className="md:col-span-2">
                      <span className={`inline-block px-3 py-1 rounded-full border text-xs font-bold uppercase ${statusStyles[reg.status]}`}>
                        {reg.status}
                      </span>
                    </div>
                    <div className="md:col-span-1 text-gray-400 text-sm">
                      {new Date(reg.registered_at).toLocaleDateString()}
                    </div>
                    <div className="md:col-span-3 flex md:justify-end gap-2 flex-wrap">
                      {reg.status !== 'approved' && (
                        <button
                          onClick={() => handleSetStatus(reg.id, 'approved')}
                          disabled={busy}
                          className="bg-green-700 hover:bg-green-800 text-white px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {reg.status !== 'rejected' && (
                        <button
                          onClick={() => handleSetStatus(reg.id, 'rejected')}
                          disabled={busy}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(reg.id)}
                        disabled={busy}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="bg-sitebg px-4 sm:px-6 py-4 border-t border-brown">
              <p className="text-gray-400">
                Participants (pending + approved): <span className="text-gold font-bold">{activeCount}</span> /{' '}
                <span className="text-gray-300">{tournament?.max_participants || '∞'}</span>
                <span className="ml-4 text-gray-400 text-sm">{registrations.length} registrations in total</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// "· 3 / 5 verified" for tournaments that only accept verified students
function VerifiedCount({ team }: { team: Team }) {
  const members = team.members ?? [];
  const verified = members.filter((m) => m.profiles?.is_verified).length;
  return (
    <span className={verified === members.length ? 'text-[#8fbcf2]' : 'text-yellow-300'}>
      {' · '}{verified} / {members.length} verified
    </span>
  );
}
