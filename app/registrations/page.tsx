'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Registration, RegistrationStatus, Tournament } from '@/utils/types';
import { formatDate } from '@/utils/tournaments';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Trophy, Calendar, AlertCircle, Clock, CheckCircle2, XCircle, Shield } from 'lucide-react';

type MyRegistration = Registration & {
  tournaments: Pick<Tournament, 'id' | 'name' | 'game' | 'start_date'> | null;
};

const statusStyles: Record<RegistrationStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-800 border-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-800 border-emerald-400',
  rejected: 'bg-rose-500/15 text-rose-800 border-rose-400',
  cancelled: 'bg-stone-500/15 text-stone-600 border-stone-300',
};

const statusIcons: Record<RegistrationStatus, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle,
};

export default function MyRegistrationsPage() {
  const supabase = createClient();
  usePageTitle('My Registrations');
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
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

  const handleWithdraw = async (reg: MyRegistration) => {
    if (!confirm(`Withdraw ${reg.teams?.name} from ${reg.tournaments?.name}?`)) return;
    setBusyId(reg.id);
    setError('');

    try {
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

  if (loading) {
    return <PageLoading label="Loading your registrations..." />;
  }

  return (
    <main
      id="main-content"
      className="flex-1 w-full min-h-[calc(100vh-160px)] bg-white text-stone-950 px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-10 uppercase"
    >
      <div className="w-full max-w-6xl mx-auto space-y-8">
        {/* 1. Main Hero Container */}
        <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
          <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Registrations Banner" />

          {/* Action Bar inside Hero: Back link & Registration count */}
          <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
            >
              ← Back to Dashboard
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-black px-3.5 py-1 rounded-md border border-white/20 bg-white/10 text-stone-200 uppercase tracking-widest backdrop-blur-xs shadow-2xs">
                {registrations.length} {registrations.length === 1 ? 'Entry' : 'Entries'}
              </span>
              <Link
                href="/tournaments"
                className="bg-gold text-stone-950 px-4 py-1.5 rounded-xl font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs"
              >
                Browse Tournaments →
              </Link>
            </div>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
            <h1
              className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
              style={{ color: '#ffffff' }}
            >
              My Registrations
            </h1>
            <p
              className="animate-hero-tagline text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
              style={{ color: '#ffffff' }}
            >
              Active tournament entries, team registration statuses, and schedule records.
            </p>
          </div>
        </section>

        {/* Global Notifications */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!error && registrations.length === 0 && (
          <div className="animate-stagger-1 w-full rounded-3xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-14 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-stone-200/80 grid place-items-center text-stone-600 mb-1">
              <Trophy className="w-6 h-6" />
            </div>
            <p className="font-black text-stone-900 text-base uppercase tracking-wider">
              Your teams haven&apos;t registered for any tournament yet.
            </p>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide max-w-md">
              Find an upcoming competition on the official tournaments portal and sign up your squad.
            </p>
            <Link
              href="/tournaments"
              className="mt-2 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 transition-all"
            >
              View Tournaments
            </Link>
          </div>
        )}

        {/* Registrations List */}
        {registrations.length > 0 && (
          <div className="animate-stagger-1 space-y-4">
            {registrations.map((reg) => {
              const isCaptain = reg.teams?.captain_id === userId;
              const StatusIcon = statusIcons[reg.status] || Clock;

              return (
                <div
                  key={reg.id}
                  className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs hover:shadow-md hover:border-amber-400/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-3 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/tournaments/${reg.tournament_id}`}
                        className="text-lg sm:text-xl font-black text-stone-950 hover:text-[#5B271E] uppercase tracking-wide transition-colors truncate"
                      >
                        {reg.tournaments?.name}
                      </Link>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${statusStyles[reg.status]}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {reg.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-stone-600 uppercase">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#5B271E]" />
                        <span className="font-black text-stone-900">{reg.teams?.name}</span>
                        {isCaptain && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 border border-amber-300">
                            Captain
                          </span>
                        )}
                      </div>
                      <span>•</span>
                      <span className="text-[#5B271E] font-black">{reg.tournaments?.game}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        <span>Starts {formatDate(reg.tournaments?.start_date)}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-400 font-medium tracking-wide">
                      Registered on {new Date(reg.registered_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
                    <Link
                      href={`/tournaments/${reg.tournament_id}`}
                      className="rounded-xl border border-stone-300 hover:border-amber-400 bg-white text-stone-800 font-bold px-4 py-2.5 text-xs uppercase tracking-wider shadow-2xs hover:-translate-y-0.5 transition-all text-center"
                    >
                      Tournament Details
                    </Link>

                    {isCaptain && reg.status === 'pending' && (
                      <button
                        onClick={() => handleWithdraw(reg)}
                        disabled={busyId === reg.id}
                        className="rounded-xl border border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 px-4 py-2.5 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        {busyId === reg.id ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
