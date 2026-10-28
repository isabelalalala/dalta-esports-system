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
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { AlertCircle, CheckCircle2, ShieldCheck, Users, XCircle } from 'lucide-react';

const statusStyles: Record<RegistrationStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-800 border-amber-500/40',
  approved: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/40',
  rejected: 'bg-rose-500/15 text-rose-800 border-rose-500/40',
  cancelled: 'bg-stone-500/15 text-stone-600 border-stone-300',
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

  const activeCount = registrations.filter((r) => ACTIVE_REGISTRATION_STATUSES.includes(r.status)).length;

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Tournament
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#FFCC37]" /> Team Registrations
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            {tournament?.name}
          </h1>
          <p
            className="animate-hero-tagline text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Manage team registrations, verify student eligibility, and configure slots.
          </p>
        </div>
      </section>

      {/* 2. Controls & Downloads */}
      <div className="animate-stagger-1 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <ExportButtons type="registrations" label="Registrations" params={{ tournament: id }} />
          <ExportButtons type="rosters" label="Team rosters" params={{ tournament: id }} />
        </div>
        <div className="text-xs font-black text-stone-600 uppercase tracking-wider">
          Active: <span className="text-[#5B271E] font-black">{activeCount}</span> / {tournament?.max_participants || '∞'} Teams
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Registrations Table Card */}
      {registrations.length === 0 && !error ? (
        <div className="rounded-3xl border border-stone-200/90 bg-white p-12 text-center shadow-xs">
          <p className="text-stone-500 text-sm font-black uppercase tracking-wider">No registrations yet.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-stone-200/90 bg-white overflow-hidden shadow-xs">
          {/* Header */}
          <div className="bg-stone-50 border-b border-stone-200/90 text-stone-600 text-xs font-black uppercase tracking-wider px-6 py-4 hidden md:grid grid-cols-12 gap-4">
            <div className="col-span-3">Team</div>
            <div className="col-span-3">Captain</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Registered Date</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-stone-100">
            {registrations.map((reg) => {
              const captain = reg.teams?.captain;
              const busy = busyId === reg.id;

              return (
                <div key={reg.id} className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:bg-stone-50/70 transition-colors">
                  <div className="md:col-span-3 font-black text-stone-950 text-xs sm:text-sm tracking-wide">
                    {reg.teams?.name || reg.team_name || 'Unnamed Team'}
                    {reg.teams && (
                      <span className="block text-stone-500 text-[11px] font-semibold tracking-wider mt-0.5">
                        {reg.teams.team_members?.[0]?.count || 0} / {reg.teams.games?.max_players} players
                        {tournament?.requires_verification && <VerifiedCount team={reg.teams} />}
                      </span>
                    )}
                  </div>
                  <div className="md:col-span-3 text-stone-600 text-xs font-bold break-all md:break-normal">
                    {captain ? captain.full_name || captain.email : '—'}
                  </div>
                  <div className="md:col-span-2">
                    <span className={`inline-block px-3 py-1 rounded-md border text-[10px] font-black uppercase shadow-2xs ${statusStyles[reg.status]}`}>
                      {reg.status}
                    </span>
                  </div>
                  <div className="md:col-span-2 text-stone-500 text-xs font-semibold">
                    {new Date(reg.registered_at).toLocaleDateString()}
                  </div>
                  <div className="md:col-span-2 flex md:justify-end gap-2 flex-wrap">
                    {reg.status !== 'approved' && (
                      <button
                        onClick={() => handleSetStatus(reg.id, 'approved')}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    {reg.status !== 'rejected' && (
                      <button
                        onClick={() => handleSetStatus(reg.id, 'rejected')}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-[11px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(reg.id)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="bg-stone-50/80 px-6 py-4 border-t border-stone-200/90 text-xs font-bold text-stone-500 uppercase flex flex-wrap justify-between items-center gap-2">
            <span>
              Total active slots: <strong className="text-stone-950">{activeCount}</strong> / {tournament?.max_participants || '∞'}
            </span>
            <span>{registrations.length} registrations total</span>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifiedCount({ team }: { team: Team }) {
  const members = team.members ?? [];
  const verified = members.filter((m) => m.profiles?.is_verified).length;
  return (
    <span className={verified === members.length ? 'text-sky-700 font-bold' : 'text-amber-700 font-bold'}>
      {' · '}{verified} / {members.length} verified
    </span>
  );
}
