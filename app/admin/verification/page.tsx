'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Profile, VerificationStatus } from '@/utils/types';
import { verificationLabels } from '@/utils/verification';

const inputClass =
  'rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-2 text-white outline-none focus:border-[#00d2ff]';

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
        const { data: myRole } = await supabase.rpc('get_my_role');
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

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;

  // Hiding the page is only for convenience; RLS and review_student_verification() also check the role.
  if (role !== 'admin' && role !== 'staff') {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">
        Only organizers can verify students.{' '}
        <Link href="/dashboard" className="text-[#00d2ff] underline">Back to Dashboard</Link>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visible = players.filter((p) =>
    !query ||
    [p.full_name, p.email, p.student_id, p.school, p.course_year].some((v) => (v || '').toLowerCase().includes(query))
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-block text-[#00d2ff] hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-[#00d2ff]">Student Verification</h1>
          <p className="text-gray-400 text-sm mt-2">
            Check each player&apos;s details against school records or their school ID before verifying.
            Only verified students can join tournaments marked &quot;Verified students only&quot;.
          </p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>}
        {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setRejectingId(null); setMessage(''); }}
                className={`px-4 py-2 rounded-lg font-bold border ${tab === t
                  ? 'bg-[#00d2ff] text-black border-[#00d2ff]'
                  : 'border-[#00d2ff]/40 text-gray-300 hover:bg-[#00d2ff]/10'}`}
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

        {visible.length === 0 ? (
          <p className="text-gray-400 text-center py-12">
            {tab === 'pending' ? 'No players are waiting for verification.' : 'No players here.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => {
              const busy = busyId === p.id;
              return (
                <li key={p.id} className="bg-[#1a1a2e] border border-[#00d2ff]/20 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="font-bold">{p.full_name || <span className="italic text-gray-500">No name</span>}</p>
                      <p className="text-sm text-gray-400">{p.email}</p>
                    </div>
                    <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
                      <dt className="text-gray-500">Student ID</dt>
                      <dt className="text-gray-500">School</dt>
                      <dt className="text-gray-500">Course / Year</dt>
                      <dd className="font-semibold">{p.student_id}</dd>
                      <dd>{p.school}</dd>
                      <dd>{p.course_year}</dd>
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
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-600 disabled:opacity-50">
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
                          className="bg-[#00d2ff] text-black px-4 py-2 rounded-lg hover:bg-[#00b8e6] disabled:opacity-50">
                          Verify
                        </button>
                      )}
                      {tab !== 'rejected' && (
                        <button onClick={() => { setRejectingId(p.id); setReason(''); }} disabled={busy}
                          className="border border-red-500 text-red-300 px-4 py-2 rounded-lg hover:bg-red-500/10 disabled:opacity-50">
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
