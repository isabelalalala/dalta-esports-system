'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { ACTIVE_REGISTRATION_STATUSES } from '@/utils/types';
import { formatDate, getTournamentStatus, statusLabels, statusStyles } from '@/utils/tournaments';
import type { Profile, Tournament } from '@/utils/types';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';

// Match tournament game to official game asset logo
function getGameLogo(game: string, gameId?: string | null): string | null {
  const g = (game || '').toLowerCase().trim();
  const id = (gameId || '').toLowerCase().trim();

  if (g.includes('mlbb') || g.includes('mobile legends') || id.includes('mlbb')) {
    return '/MLBB LOGO.png';
  }
  if (g.includes('valo') || g.includes('valorant') || id.includes('valo')) {
    return '/VALO LOGO.png';
  }
  if (g.includes('tekken') || id.includes('tekken')) {
    return '/TEKKEMN 8 LOGO.png';
  }
  if (g.includes('codm') || g.includes('call of duty') || id.includes('cod')) {
    return '/CODM LOGO.png';
  }
  return null;
}

export default function TournamentsPage() {
  usePageTitle('Tournaments');
  const supabase = createClient();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Pick<Profile, 'id' | 'role'> | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/login');
          return;
        }

        // Get user profile for role check
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);

        // Fetch tournaments with a count of their active registrations
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
    return <PageLoading label="Loading tournaments..." />;
  }

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with dynamic background (Matching Events Layout) */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Tournaments Banner" />

        {/* Action Bar inside Hero: Back link & optional Create Tournament button */}
        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>

          {(profile?.role === 'admin' || profile?.role === 'staff') && (
            <Link
              href="/tournaments/create"
              className="bg-gold text-stone-950 px-5 py-2.5 rounded-xl font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs"
            >
              + Create Tournament
            </Link>
          )}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Tournaments
          </h1>
          <p
            className="animate-hero-tagline text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Official championships, brackets, and match schedules.
          </p>
        </div>
      </section>

      {/* Error Notice */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-700 text-sm font-bold uppercase tracking-wider"
        >
          {error}
        </div>
      )}

      {/* 2. Tournaments Grid / Empty State (Matching Events Layout) */}
      {tournaments.length === 0 && !error ? (
        <div className="animate-stagger-1 w-full rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-14 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
          <p className="font-black text-stone-900 text-base uppercase tracking-wider">
            No tournaments published yet.
          </p>
          {(profile?.role === 'admin' || profile?.role === 'staff') ? (
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wide">
              Click &quot;+ Create Tournament&quot; above to launch a new competition.
            </p>
          ) : (
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wide">
              Check back soon or read our announcements for upcoming schedules.
            </p>
          )}
        </div>
      ) : (
        <div className="animate-stagger-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 w-full">
          {tournaments.map((tournament) => {
            const registeredCount = tournament.tournament_registrations?.[0]?.count || 0;
            const status = getTournamentStatus(tournament);
            const logo = getGameLogo(tournament.game, tournament.game_id);

            return (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.id}`}
                className="group flex flex-col rounded-2xl border border-stone-200/90 bg-white shadow-xs hover:shadow-lg hover:-translate-y-1 hover:border-amber-500/50 transition-all duration-300 overflow-hidden relative"
              >
                {/* Visual Header Aspect-Video (Matching PostCard Layout in Events) */}
                <div className="relative aspect-video bg-gradient-to-br from-stone-900 via-stone-950 to-amber-950/40 overflow-hidden flex items-center justify-center border-b border-stone-100">
                  {logo ? (
                    <div className="relative w-28 h-28 group-hover:scale-105 transition-transform duration-300">
                      <Image
                        src={logo}
                        alt={tournament.game}
                        fill
                        sizes="120px"
                        className="object-contain p-2"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <span className="font-black text-amber-500/90 text-lg uppercase tracking-widest">
                        {tournament.game}
                      </span>
                    </div>
                  )}

                  {/* Status Badge in Corner */}
                  <div className="absolute top-3.5 right-3.5 z-10">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase shadow-xs ${statusStyles[status]}`}
                    >
                      {statusLabels[status]}
                    </span>
                  </div>
                </div>

                {/* Card Content Area */}
                <div className="p-5 sm:p-6 flex flex-col flex-1 justify-between space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-amber-700 text-xs font-black tracking-widest uppercase">
                      {tournament.game}
                    </p>
                    <h3 className="text-xl sm:text-2xl font-black text-stone-950 leading-tight uppercase tracking-wide group-hover:text-amber-700 transition-colors">
                      {tournament.name}
                    </h3>
                    {tournament.description && (
                      <p className="text-xs sm:text-sm text-stone-600 font-medium uppercase tracking-wide line-clamp-2">
                        {tournament.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 pt-2">
                    {/* Participants Progress Stats */}
                    <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/80">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-stone-600 text-[10px] font-black uppercase tracking-wider">
                          Participants
                        </span>
                        <span className="text-stone-950 text-xs sm:text-sm font-black">
                          {registeredCount} / {tournament.max_participants || '∞'}
                        </span>
                      </div>
                      <progress
                        value={Math.min(
                          registeredCount,
                          tournament.max_participants || registeredCount
                        )}
                        max={tournament.max_participants || 1}
                        aria-label="Teams registered"
                        className="w-full h-2 block appearance-none rounded-full overflow-hidden bg-stone-200 [&::-webkit-progress-bar]:bg-stone-200 [&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500"
                      />
                    </div>

                    {/* Tournament Key Dates */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                          Start Date
                        </p>
                        <p className="text-stone-950 font-bold">
                          {formatDate(tournament.start_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                          Deadline
                        </p>
                        <p className="text-stone-950 font-bold">
                          {tournament.registration_deadline
                            ? formatDate(tournament.registration_deadline)
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* View Details Action Link */}
                  <div className="pt-2">
                    <span className="block text-center w-full py-3 rounded-xl border border-amber-400 bg-gold text-stone-950 font-black group-hover:bg-golddark transition-all uppercase text-xs tracking-widest shadow-xs">
                      View Tournament Details →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
