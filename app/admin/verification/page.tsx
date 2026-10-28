'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Profile, VerificationStatus } from '@/utils/types';
import { verificationLabels } from '@/utils/verification';
import { usePageTitle } from '@/utils/page-title';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import PageHeroBackground from '@/components/site/PageHeroBackground';

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

const TABS: VerificationStatus[] = ['pending', 'rejected', 'verified'];

export default function VerificationPage() {
  const supabase = createClient();
  usePageTitle('Student verification');
  const [role, setRole] = useState('');
  const [tab, setTab] = useState<VerificationStatus>('pending');
  const [players, setPlayers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (myRole !== 'admin' && myRole !== 'staff') return;

        const { data, error: listError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'player')
          .eq('verification_status', tab)
          .order('submitted_at', { ascending: true });
        if (listError) throw listError;
        setPlayers(data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load players'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, tab, reloadCount]);

  const review = async (player: Profile, verified: boolean) => {
    setBusyId(player.id);
    setError('');
    setMessage('');
    try {
      const { error: reviewError } = await supabase.rpc('review_student_verification', {
        target_user: player.id,
        verified,
        note: verified ? null : reason.trim() || null,
      });
      if (reviewError) throw reviewError;

      setMessage(
        verified
          ? `Verified ${player.full_name || player.email}. They can now join student-only tournaments.`
          : `${tab === 'verified' ? 'Revoked verification for' : 'Rejected'} ${player.full_name || player.email}.`
      );
      setRejectingId(null);
      setReason('');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save the review'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoading />;
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin' && role !== 'staff') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only tournament organizers can verify students.</p>
        <Link href="/dashboard" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visible = players.filter((p) =>
    !query ||
    [p.full_name, p.email, p.student_id, p.school, p.course_year].some((v) => (v || '').toLowerCase().includes(query))
  );

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Verification Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Student Verification
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Review player credentials against institutional records before verified tournament participation.
          </p>
        </div>
      </section>

      {/* 2. Controls & Verification Applications */}
      <div className="space-y-6 text-stone-950">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex flex-wrap gap-2" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setRejectingId(null); setMessage(''); }}
                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  tab === t
                    ? 'bg-amber-500/15 text-stone-950 border border-amber-500/30 shadow-2xs'
                    : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100/80 border border-transparent'
                }`}
              >
                {verificationLabels[t]}
              </button>
            ))}
          </div>

          <div className="sm:w-80">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, school..."
              aria-label="Search name, ID, school"
              className={inputClass}
            />
          </div>
        </div>

        {visible.length === 0 && error ? null : visible.length === 0 ? (
          <p className="text-stone-500 text-center py-12 font-bold tracking-wider">
            {tab === 'pending' ? 'No players are currently waiting for verification.' : 'No players found in this list.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {visible.map((p) => {
              const busy = busyId === p.id;
              return (
                <li key={p.id} className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4 text-stone-950">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-stone-100">
                    <div>
                      <h3 className="font-black text-stone-950 text-base tracking-wide">
                        {p.full_name || <span className="italic text-stone-400">Anonymous Player</span>}
                      </h3>
                      <p className="text-xs text-stone-500 font-medium normal-case tracking-wide mt-0.5">{p.email}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-800">
                        Status: {p.verification_status}
                      </span>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                      <span className="block text-stone-500 font-black text-xs tracking-wider uppercase">Student ID</span>
                      <span className="font-extrabold text-stone-900 tracking-wider break-all">{p.student_id || 'Not provided'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                      <span className="block text-stone-500 font-black text-xs tracking-wider uppercase">School / Campus</span>
                      <span className="font-extrabold text-stone-900 tracking-wider">{p.school || 'Not provided'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                      <span className="block text-stone-500 font-black text-xs tracking-wider uppercase">Course / Year</span>
                      <span className="font-extrabold text-stone-900 tracking-wider">{p.course_year || 'Not provided'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <p className="text-xs text-stone-500 font-medium">
                      {p.submitted_at && `Submitted ${new Date(p.submitted_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
                      {p.reviewed_at && ` · Reviewed ${new Date(p.reviewed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
                    </p>

                    {p.verification_note && (
                      <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg">
                        Reason: {p.verification_note}
                      </p>
                    )}
                  </div>

                  {rejectingId === p.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); review(p, false); }}
                      className="flex flex-col sm:flex-row gap-3 pt-2"
                    >
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={300}
                        placeholder="Reason, e.g. Student ID does not match records..."
                        aria-label="Reason for rejection"
                        className={`${inputClass} flex-1`}
                        autoFocus
                        required
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2.5 text-xs tracking-wider shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {tab === 'verified' ? 'Confirm Revoke' : 'Confirm Reject'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setReason(''); }}
                        className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-2.5 text-xs tracking-wider transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3 pt-2">
                      {tab !== 'verified' && (
                        <button
                          onClick={() => review(p, true)}
                          disabled={busy}
                          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 border border-amber-400 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Verify Player
                        </button>
                      )}
                      {tab !== 'rejected' && (
                        <button
                          onClick={() => { setRejectingId(p.id); setReason(''); }}
                          disabled={busy}
                          className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-black px-5 py-2.5 text-xs tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {tab === 'verified' ? 'Revoke Verification' : 'Reject'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
