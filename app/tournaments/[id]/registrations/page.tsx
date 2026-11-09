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
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { AlertCircle, Users } from 'lucide-react';
import { can } from '@/utils/permissions';
import { useConfirm } from '@/components/useConfirm';
import { toast } from '@/components/Toaster';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatMomentDate } from '@/utils/tournaments';

const statusStyles: Record<RegistrationStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-800 border-amber-500/40',
  approved: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/40',
  rejected: 'bg-rose-500/15 text-rose-800 border-rose-500/40',
  cancelled: 'bg-stone-500/15 text-stone-600 border-stone-300',
};

export default function RegistrationsPage() {
  const [confirmDialog, ask] = useConfirm();
  usePageTitle('Tournament registrations');
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Only admin/staff review registrations (RLS enforces it too)
  const [role, setRole] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Reject dialog: which registration, and the optional reason the captain will see
  const [rejecting, setRejecting] = useState<{ id: string; team: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (!can(myRole, 'registration.review')) return;

        const { data: tournamentData, error: tournError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();

        if (tournError) throw tournError;
        setTournament(tournamentData as Tournament);

        const { data: regsData, error: regsError } = await supabase
          .from('tournament_registrations')
          .select('*, teams(*, games(*), team_members(count), captain:profiles!teams_captain_id_fkey(full_name, email), members:team_members(profiles(is_verified)))')
          .eq('tournament_id', id)
          .order('registered_at', { ascending: false });

        if (regsError) throw regsError;
        setRegistrations((regsData || []) as Registration[]);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load registrations'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, supabase]);

  // reason: only for a rejection (optional; clean_registration_reason() clears it on other statuses)
  const handleSetStatus = async (registrationId: string, status: RegistrationStatus, reason?: string) => {
    setBusyId(registrationId);
    setError('');

    try {
      const { data, error: updateError } = await supabase
        .from('tournament_registrations')
        .update(status === 'rejected' ? { status, rejection_reason: reason?.trim() || null } : { status })
        .eq('id', registrationId)
        .select('id');

      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error('You don\'t have permission to change this registration.');

      setRegistrations((current) =>
        current.map((r) => (r.id === registrationId
          ? { ...r, status, rejection_reason: status === 'rejected' ? reason?.trim() || null : null }
          : r))
      );
      toast.success(status === 'approved' ? 'Registration approved. The captain is notified.' : 'Registration rejected. The captain is notified.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update registration'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (registrationId: string) => {
    if (!(await ask({ title: 'Remove registration?', message: 'The team is taken off this tournament and its captain is notified.', confirmLabel: 'Remove', tone: 'danger' }))) return;

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
      toast.success('Registration removed.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete registration'));
    } finally {
      setBusyId(null);
    }
  };

  // Approve every pending registration, oldest first. Pending ones already count towards the
  // team limit, so approving them can't overfill the tournament; a team that fails a check
  // (e.g. an unverified member) is skipped and listed afterwards.
  const handleApproveAll = async () => {
    const pending = registrations
      .filter((r) => r.status === 'pending')
      .sort((a, b) => a.registered_at.localeCompare(b.registered_at));
    const ok = await ask({
      title: `Approve ${pending.length} pending registrations?`,
      message: 'Every pending team is approved and its captain is notified. Teams that fail a check (for example an unverified member) stay pending.',
      confirmLabel: 'Approve all',
    });
    if (!ok) return;
    setBusyId('all');
    setError('');
    const approved: string[] = [];
    const skipped: string[] = [];
    for (const reg of pending) {
      const { data, error: updateError } = await supabase
        .from('tournament_registrations')
        .update({ status: 'approved' })
        .eq('id', reg.id)
        .select('id');
      if (updateError || !data?.length) skipped.push(`${reg.teams?.name ?? 'A team'}: ${updateError ? getErrorMessage(updateError, 'not allowed') : 'not allowed'}`);
      else approved.push(reg.id);
    }
    setRegistrations((current) => current.map((r) => (approved.includes(r.id) ? { ...r, status: 'approved' } : r)));
    setBusyId(null);
    if (approved.length) toast.success(`${approved.length} registration${approved.length === 1 ? '' : 's'} approved.`);
    if (skipped.length) setError(`Still pending: ${skipped.join(' · ')}`);
  };

  if (loading) {
    return <PageLoading label="Loading registrations..." />;
  }
  if (role && !can(role, 'registration.review')) {
    return <PageError message="Only organizers can review registrations." backHref={`/tournaments/${id}`} backLabel="Back to the tournament" />;
  }
  if (!tournament) {
    return <PageError message={error || 'Tournament not found'} backHref="/tournaments" backLabel="Back to Tournaments" />;
  }

  const activeCount = registrations.filter((r) => ACTIVE_REGISTRATION_STATUSES.includes(r.status)).length;
  const pendingCount = registrations.filter((r) => r.status === 'pending').length;

  return (
    <>
    {confirmDialog}
    {rejecting && (
      <ConfirmDialog
        title={`Reject ${rejecting.team}?`}
        confirmLabel="Reject"
        tone="danger"
        busy={busyId === rejecting.id}
        busyLabel="Rejecting..."
        onConfirm={async () => {
          await handleSetStatus(rejecting.id, 'rejected', rejectReason);
          setRejecting(null);
        }}
        onClose={() => setRejecting(null)}
      >
        <p>The captain is notified. A reason helps them fix the problem and register again.</p>
        <label className="block text-sm font-bold text-stone-800">
          Reason (optional, the captain will see it)
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="e.g. Two players aren't verified yet."
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm font-medium text-stone-950 shadow-xs outline-none focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/25"
          />
        </label>
      </ConfirmDialog>
    )}
    <div className="w-full space-y-8 text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 @5xl:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
          >
            ← Back to Tournament
          </Link>
          <span className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-gold" /> Team Registrations
          </span>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-display font-black tracking-wider uppercase leading-tight text-white"
          >
            {tournament?.name}
          </h1>
          <p
            className="animate-hero-tagline text-xs sm:text-sm font-semibold leading-relaxed text-white"
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
        <div className="flex flex-wrap items-center gap-3">
          {pendingCount > 1 && (
            <button type="button" onClick={handleApproveAll} disabled={busyId !== null} className="btn btn-primary">
              {busyId === 'all' ? 'Approving...' : `Approve all pending (${pendingCount})`}
            </button>
          )}
          <div className="text-xs font-black text-stone-600 uppercase tracking-wider">
            Active: <span className="text-maroon font-black">{activeCount}</span> / {tournament?.max_participants || '∞'} Teams
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-red-700 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Registrations Table Card */}
      {registrations.length === 0 && !error ? (
        <div className="rounded-3xl border border-stone-200/90 bg-white p-12 text-center shadow-xs">
          <p className="text-stone-500 text-sm font-black">No registrations yet.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-stone-200/90 bg-white overflow-hidden shadow-xs">
          {/* Header */}
          <div className="bg-stone-50 border-b border-stone-200/90 text-stone-600 text-xs font-black uppercase tracking-wider px-6 py-4 hidden @3xl:grid grid-cols-12 gap-4">
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
                <div key={reg.id} className="px-6 py-4 grid grid-cols-1 @3xl:grid-cols-12 gap-4 items-center hover:bg-stone-50/70 transition-colors">
                  <div className="@3xl:col-span-3 font-black text-stone-950 text-xs sm:text-sm tracking-wide">
                    {reg.teams?.name || reg.team_name || 'Unnamed Team'}
                    {reg.teams && (
                      <span className="block text-stone-500 text-[11px] font-semibold tracking-wider mt-0.5">
                        {reg.teams.team_members?.[0]?.count || 0} / {reg.teams.games?.max_players} players
                        {tournament?.requires_verification && <VerifiedCount team={reg.teams} />}
                      </span>
                    )}
                  </div>
                  <div className="@3xl:col-span-3 text-stone-600 text-xs font-bold break-all @3xl:break-normal">
                    {captain ? captain.full_name || captain.email : '—'}
                  </div>
                  <div className="@3xl:col-span-2">
                    <span className={`inline-block px-3 py-1 rounded-md border text-[10px] font-black uppercase shadow-2xs ${statusStyles[reg.status]}`}>
                      {reg.status}
                    </span>
                    {reg.status === 'rejected' && reg.rejection_reason && (
                      <span className="mt-1 block text-[11px] font-medium text-stone-600 break-words">Reason: {reg.rejection_reason}</span>
                    )}
                  </div>
                  <div className="@3xl:col-span-2 text-stone-500 text-xs font-semibold">
                    {formatMomentDate(reg.registered_at)}
                  </div>
                  <div className="@3xl:col-span-2 flex @3xl:justify-end gap-2 flex-wrap">
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
                        onClick={() => {
                          setRejectReason('');
                          setRejecting({ id: reg.id, team: reg.teams?.name || reg.team_name || 'this team' });
                        }}
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
          <div className="bg-stone-50/80 px-6 py-4 border-t border-stone-200/90 text-xs font-bold text-stone-500 flex flex-wrap justify-between items-center gap-2">
            <span>
              Total active slots: <strong className="text-stone-950">{activeCount}</strong> / {tournament?.max_participants || '∞'}
            </span>
            <span>{registrations.length} registrations total</span>
          </div>
        </div>
      )}
    </div>
    </>
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
