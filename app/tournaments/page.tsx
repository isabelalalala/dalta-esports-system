'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { ACTIVE_REGISTRATION_STATUSES } from '@/utils/types';
import { getTournamentStatus, statusLabels, statusStyles } from '@/utils/tournaments';
import type { Profile, Tournament } from '@/utils/types';

export default function TournamentsPage() {
  const supabase = createClient();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/login');
          return;
        }

        // Get user profile for role check
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);

        // Fetch tournaments with a count of their registrations.
        // Only pending + approved registrations count (the filter applies to the counted rows).
        const { data, error: tourError } = await supabase
          .from('tournaments')
          .select(`
            *,
            tournament_registrations (count)
          `)
          .in('tournament_registrations.status', ACTIVE_REGISTRATION_STATUSES)
          .order('created_at', { ascending: false });

        if (tourError) throw tourError;
        setTournaments(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load tournaments'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center font-sans">
        <p className="animate-pulse">Loading tournaments...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col gap-2">
            <Link href="/dashboard" className="text-[#00d2ff] hover:underline text-sm flex items-center gap-1">
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Tournaments</h1>
          </div>

          {(profile?.role === 'admin' || profile?.role === 'staff') && (
            <Link href="/tournaments/create">
              <button className="bg-[#00d2ff] text-black px-6 py-3 rounded-md font-bold hover:bg-[#00b8e6] transition skew-x-[-10deg]">
                <span className="inline-block skew-x-[10deg]">+ CREATE TOURNAMENT</span>
              </button>
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 p-4 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Tournaments Grid */}
        {tournaments.length === 0 ? (
          <div className="text-center text-gray-500 py-20 border-2 border-dashed border-[#1a1a2e] rounded-xl">
            <p>No tournaments yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tournaments.map((tournament) => {
              // Extract the count from the joined table
              const registeredCount = tournament.tournament_registrations?.[0]?.count || 0;
              const status = getTournamentStatus(tournament);

              return (
                <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
                  <div className="group bg-[#111116] border border-[#00d2ff]/30 rounded-lg overflow-hidden hover:border-[#00d2ff] transition-all duration-300 relative">
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded border uppercase ${statusStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
                    </div>

                    <div className="p-6">
                      <p className="text-[#00d2ff] text-xs font-bold tracking-widest mb-1 uppercase">
                        {tournament.game}
                      </p>
                      <h3 className="text-2xl font-black text-white mb-4 leading-tight group-hover:text-[#00d2ff] transition-colors">
                        {tournament.name}
                      </h3>

                      <div className="space-y-4">
                        {/* Participants Stats */}
                        <div className="bg-[#0a0a0c] p-3 rounded border border-[#1a1a2e]">
                          <div className="flex justify-between items-end mb-1">
                            <span className="text-gray-500 text-[10px] font-bold uppercase">Participants</span>
                            <span className="text-white text-sm font-bold">
                              {registeredCount} / {tournament.max_participants || '∞'}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-[#1a1a2e] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#00d2ff] h-full transition-all duration-500" 
                              style={{ width: `${Math.min((registeredCount / (tournament.max_participants || 1)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-gray-500 text-[10px] font-bold uppercase">Start Date</p>
                            <p className="text-white text-sm font-medium">
                              {new Date(tournament.start_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-[10px] font-bold uppercase">Deadline</p>
                            <p className="text-white text-sm font-medium">
                              {tournament.registration_deadline ? new Date(tournament.registration_deadline).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button className="w-full mt-6 py-3 border border-[#00d2ff] text-[#00d2ff] font-bold rounded hover:bg-[#00d2ff] hover:text-black transition-all uppercase text-sm tracking-tighter">
                        View Tournament Details
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
