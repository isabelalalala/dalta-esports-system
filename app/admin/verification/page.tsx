'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Profile, VerificationStatus } from '@/utils/types';
import { verificationLabels } from '@/utils/verification';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';

const inputClass =
  'border border-brownlight bg-sitebg px-4 py-2 text-white outline-none focus:border-gold';

// The lists an organizer can switch between ('unsubmitted' players have nothing to review)
const TABS: VerificationStatus[] = ['pending', 'rejected', 'verified'];

// Student verification (admin/staff): check players' student details and verify or reject them.
export default function VerificationPage() {
  const supabase = createClient();
  const [role, setRole] = useState('');
  const [tab, setTab] = useState<VerificationStatus>('pending');
  const [players, setPlayers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  // The row being rejected/revoked, and the reason typed for it
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Increase this to load the list again
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

        // Oldest submissions first, so nobody waits too long
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

  // Verify (approve = true), or reject/revoke with a reason (approve = false)
  const review = async (player: Profile, approve: boolean) => {
    setBusyId(player.id);
    setError('');
    setMessage('');
    try {
      const { error: reviewError } = await supabase.rpc('review_student_verification', {
        p_user_id: player.id,
        p_approve: approve,
        p_note: approve ? null : reason,
      });
      if (reviewError) throw reviewError;
      const name = player.full_name || player.email;
      setMessage(approve ? `${name} is verified.` : `${name} was ${tab === 'verified' ? 'unverified' : 'rejected'}.`);
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

  // Hiding the page is only for convenience; RLS and review_student_verification() also check the role.
  // The role couldn't be loaded: show why, not "only admins"
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin' && role !== 'staff') {
    return (
      <div className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only organizers can verify students.{' '}
        <Link href="/dashboard" className="text-gold underline">Back to Dashboard</Link>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visible = players.filter((p) =>
    !query ||
    [p.full_name, p.email, p.student_id, p.school, p.course_year].some((v) => (v || '').toLowerCase().includes(query))
  );

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Student Verification</h1>
          <p className="text-gray-400 text-sm mt-2">
            Check each player&apos;s details against school records or their school ID before verifying.
            Only verified students can join tournaments marked &quot;Verified students only&quot;.
          </p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}
        {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setRejectingId(null); setMessage(''); }}
                className={`px-4 py-2 font-bold border ${tab === t
                  ? 'bg-gold text-black border-gold'
                  : 'border-brownlight text-gray-300 hover:bg-gold/10'}`}
              >
                {verificationLabels[t]}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, student ID, school"
            className={`${inputClass} flex-1`}
          />
        </div>

        {/* A failed load shows the error above, not "nothing here" */}
        {visible.length === 0 && error ? null : visible.length === 0 ? (
          <p className="text-gray-400 text-center py-12">
            {tab === 'pending' ? 'No players are waiting for verification.' : 'No players here.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => {
              const busy = busyId === p.id;
              return (
                <li key={p.id} className="bg-sitecard border border-brown p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="font-bold">{p.full_name || <span className="italic text-gray-500">No name</span>}</p>
                      <p className="text-sm text-gray-400 break-all">{p.email}</p>
                    </div>
                    {/* One column on phones, three side by side on larger screens */}
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                      <div><dt className="text-gray-500">Student ID</dt><dd className="font-semibold break-all">{p.student_id}</dd></div>
                      <div><dt className="text-gray-500">School</dt><dd>{p.school}</dd></div>
                      <div><dt className="text-gray-500">Course / Year</dt><dd>{p.course_year}</dd></div>
                    </dl>
                  </div>

                  <p className="text-xs text-gray-500">
                    {p.submitted_at && `Submitted ${new Date(p.submitted_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
                    {p.reviewed_at && ` · Reviewed ${new Date(p.reviewed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
                  </p>
                  {p.verification_note && <p className="text-sm text-red-300">Reason: {p.verification_note}</p>}

                  {rejectingId === p.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); review(p, false); }}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={300}
                        placeholder="Reason the player will see, e.g. Student ID doesn't match school records."
                        className={`${inputClass} flex-1`}
                        autoFocus
                        required
                      />
                      <button type="submit" disabled={busy}
                        className="bg-red-500 text-white px-4 py-2 font-bold hover:bg-red-600 disabled:opacity-50">
                        {tab === 'verified' ? 'Revoke' : 'Reject'}
                      </button>
                      <button type="button" onClick={() => { setRejectingId(null); setReason(''); }}
                        className="text-gray-400 px-4 py-2 hover:text-white">
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex gap-3 text-sm font-semibold">
                      {tab !== 'verified' && (
                        <button onClick={() => review(p, true)} disabled={busy}
                          className="bg-gold text-black px-4 py-2 hover:bg-golddark disabled:opacity-50">
                          Verify
                        </button>
                      )}
                      {tab !== 'rejected' && (
                        <button onClick={() => { setRejectingId(p.id); setReason(''); }} disabled={busy}
                          className="border border-red-500 text-red-300 px-4 py-2 hover:bg-red-500/10 disabled:opacity-50">
                          {tab === 'verified' ? 'Revoke verification' : 'Reject'}
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
