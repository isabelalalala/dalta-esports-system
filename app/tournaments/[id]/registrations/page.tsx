'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Registration, Tournament } from '@/utils/types';

export default function RegistrationsPage() {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tournament
        const { data: tournamentData, error: tournError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();

        if (tournError) throw tournError;
        setTournament(tournamentData);

        // Fetch registrations with their team, the team's game and its member count
        const { data: regsData, error: regsError } = await supabase
          .from('tournament_registrations')
          .select('*, teams(*, games(*), team_members(count))')
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

  const handleDelete = async (registrationId: string) => {
    if (!confirm('Are you sure you want to remove this registration?')) return;

    setDeletingId(registrationId);
    try {
      const { error: deleteError } = await supabase
        .from('tournament_registrations')
        .delete()
        .eq('id', registrationId);

      if (deleteError) throw deleteError;

      setRegistrations(registrations.filter((r) => r.id !== registrationId));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete registration'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center">
        <p>Loading registrations...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <Link href={`/tournaments/${id}`} className="inline-block text-[#00d2ff] hover:underline mb-6">
          ← Back to Tournament
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-[#00d2ff]">{tournament?.name}</h1>
            <p className="text-gray-400 text-lg mt-2">Tournament Registrations</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {registrations.length === 0 ? (
          <div className="text-center bg-[#1a1a2e] border border-[#00d2ff]/20 rounded-xl p-12">
            <p className="text-gray-400">No registrations yet.</p>
          </div>
        ) : (
          <div className="bg-[#1a1a2e] border border-[#00d2ff] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-[#00d2ff] text-black font-bold px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>#</div>
              <div>Team Name</div>
              <div>Registered At</div>
              <div className="text-right">Action</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#00d2ff]/20">
              {registrations.map((reg, idx) => (
                <div key={reg.id} className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center hover:bg-[#0a0a0c]/50 transition">
                  <div className="text-gray-400">{idx + 1}</div>
                  <div className="font-semibold text-white">
                    {/* Older registrations have no team, only the typed team_name */}
                    {reg.teams?.name || reg.team_name || 'Unnamed Team'}
                    {reg.teams && (
                      <span className="block text-gray-500 text-sm font-normal">
                        {reg.teams.team_members?.[0]?.count || 0} / {reg.teams.games?.max_players} players
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {new Date(reg.registered_at).toLocaleDateString()}
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => handleDelete(reg.id)}
                      disabled={deletingId === reg.id}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                    >
                      {deletingId === reg.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-[#0a0a0c] px-6 py-4 border-t border-[#00d2ff]/20">
              <p className="text-gray-400">
                Total Registrations: <span className="text-[#00d2ff] font-bold">{registrations.length}</span> /{' '}
                <span className="text-gray-300">{tournament?.max_participants || '∞'}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
