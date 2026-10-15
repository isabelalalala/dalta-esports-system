'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Match, MatchResultSubmission, MatchTeam, ResultStatus } from '@/utils/types';

const PROOF_BUCKET = 'match-proofs';
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
// Same list as the bucket's allowed types (the bucket refuses anything else)
const PROOF_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const inputClass =
  'border border-brownlight bg-sitebg px-3 py-2 text-white outline-none focus:border-gold';

const statusLabels: Record<ResultStatus, string> = {
  pending: 'Waiting for the other captain',
  confirmed: 'Confirmed, waiting for staff',
  disputed: 'Disputed',
  approved: 'Approved',
  overridden: 'Changed by staff',
  rejected: 'Not accepted',
};
const statusStyles: Record<ResultStatus, string> = {
  pending: 'border-gray-500/60 text-gray-300',
  confirmed: 'border-green-500/60 text-green-300',
  disputed: 'border-red-500/60 text-red-300',
  approved: 'border-brownlight text-gold',
  overridden: 'border-yellow-500/60 text-yellow-300',
  rejected: 'border-red-500/60 text-red-300',
};

interface Props {
  match: Match;
  teamA: MatchTeam | null;
  teamB: MatchTeam | null;
  // This match's submissions, newest first (RLS: only the two teams and staff see them)
  submissions: MatchResultSubmission[];
  isStaff: boolean;
  myTeamId: string | null;
  now: number;
  onChanged: () => void;
}

// Result submission: a captain submits the score with a screenshot, the other captain
// confirms or disputes, and staff approve, override or reject. The database checks every step.
export default function ResultSection({ match, teamA, teamB, submissions, isStaff, myTeamId, now, onChanged }: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Submit form
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // Dispute / reject reasons and the override score
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [overrideA, setOverrideA] = useState('');
  const [overrideB, setOverrideB] = useState('');
  // Short-lived link to the screenshot (the bucket is private)
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const open = submissions.find((s) => ['pending', 'confirmed', 'disputed'].includes(s.status)) ?? null;
  const history = submissions.filter((s) => s !== open);
  const teamName = (teamId: string) => (teamId === teamA?.id ? teamA?.name : teamB?.name) ?? 'A team';

  const proofPath = open?.proof_path ?? null;
  useEffect(() => {
    if (!proofPath) return;
    const loadProof = async () => {
      // Valid for 10 minutes; the storage policy only allows the two teams and staff
      const { data } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(proofPath, 600);
      setProofUrl(data?.signedUrl ?? null);
    };
    loadProof();
  }, [supabase, proofPath]);

  const matchStarted =
    match.status === 'live' || (!!match.scheduled_at && now >= new Date(match.scheduled_at).getTime());
  const canSubmit = !!myTeamId && !open && match.status !== 'completed' && !!teamA && !!teamB && matchStarted;
  // The other team's captain answers a pending result
  const canRespond = !!open && open.status === 'pending' && !!myTeamId && myTeamId !== open.team_id;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setReason('');
      setNote('');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Choose a screenshot of the result.');
    if (!PROOF_TYPES[file.type]) return setError('The screenshot must be a PNG, JPG or WebP image.');
    if (file.size > MAX_PROOF_BYTES) return setError('The screenshot must be 5 MB or smaller.');
    if (Number(scoreA) === Number(scoreB)) return setError("A match can't end in a tie. Enter the final score.");

    run(async () => {
      // 1. Upload to this match's folder (the storage policy only lets the two captains do this)
      const path = `${match.id}/${crypto.randomUUID()}.${PROOF_TYPES[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from(PROOF_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      // 2. Submit the score with the screenshot's path
      const { error: submitError } = await supabase.rpc('submit_match_result', {
        p_match_id: match.id,
        p_score_a: Number(scoreA),
        p_score_b: Number(scoreB),
        p_proof_path: path,
      });
      if (submitError) throw submitError;
      setScoreA('');
      setScoreB('');
      setFile(null);
    }, 'Failed to submit the result');
  };

  const respond = (confirm: boolean) => {
    if (!open) return;
    if (!confirm && !reason.trim()) return setError('Please explain what is wrong with the result.');
    run(async () => {
      const { error: respondError } = await supabase.rpc('respond_to_match_result', {
        p_submission_id: open.id,
        p_confirm: confirm,
        p_reason: confirm ? null : reason,
      });
      if (respondError) throw respondError;
    }, 'Failed to answer the result');
  };

  const review = (action: 'approve' | 'override' | 'reject') => {
    if (!open) return;
    if (action === 'reject' && !note.trim()) return setError('Write a reason before rejecting.');
    if (action === 'override' && (overrideA === '' || overrideB === '')) return setError('Enter both scores for the override.');
    run(async () => {
      const { error: reviewError } = await supabase.rpc('review_match_result', {
        p_submission_id: open.id,
        p_action: action,
        p_score_a: action === 'override' ? Number(overrideA) : null,
        p_score_b: action === 'override' ? Number(overrideB) : null,
        p_note: note || null,
      });
      if (reviewError) throw reviewError;
    }, 'Failed to review the result');
  };

  // Nothing to show to people who aren't involved, when there are no results yet
  if (!open && history.length === 0 && !canSubmit && !isStaff) return null;

  return (
    <section className="bg-sitecard border border-brownlight p-6 space-y-4">
      <h2 className="text-xl font-bold">Result</h2>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}

      {/* The open submission */}
      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold">
              {teamA?.name} <span className="tabular-nums text-gold">{open.score_a} - {open.score_b}</span> {teamB?.name}
            </p>
            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase ${statusStyles[open.status]}`}>
              {statusLabels[open.status]}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Submitted by {teamName(open.team_id)} on {new Date(open.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {open.dispute_reason && <p className="text-sm text-red-300">Dispute: {open.dispute_reason}</p>}

          {proofUrl && (
            <a href={proofUrl} target="_blank" rel="noreferrer" className="block">
              <Image
                src={proofUrl}
                alt="Screenshot of the result"
                width={800}
                height={450}
                unoptimized
                className="w-full max-h-96 object-contain border border-gray-700 bg-black"
              />
            </a>
          )}

          {/* The other captain confirms or disputes */}
          {canRespond && (
            <div className="border-t border-gray-700 pt-4 space-y-2">
              <p className="text-sm text-gray-300">Is this the correct result?</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => respond(true)} disabled={busy}
                  className="bg-gold text-black px-4 py-2 font-bold hover:bg-golddark disabled:opacity-50">
                  Confirm
                </button>
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
                  placeholder="If it's wrong: what happened?" className={`${inputClass} flex-1`} />
                <button onClick={() => respond(false)} disabled={busy}
                  className="border border-red-500 text-red-300 px-4 py-2 font-bold hover:bg-red-500/10 disabled:opacity-50">
                  Dispute
                </button>
              </div>
            </div>
          )}
          {open.status === 'pending' && myTeamId === open.team_id && (
            <p className="text-sm text-gray-400">Waiting for the other captain to confirm.</p>
          )}

          {/* Staff review */}
          {isStaff && (
            <div className="border-t border-gray-700 pt-4 space-y-3">
              <p className="text-sm font-semibold text-yellow-300">Staff review</p>
              <button onClick={() => review('approve')} disabled={busy}
                className="bg-gold text-black px-4 py-2 font-bold hover:bg-golddark disabled:opacity-50">
                Approve {open.score_a} - {open.score_b}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-300">Override:</span>
                <input type="number" min="0" value={overrideA} onChange={(e) => setOverrideA(e.target.value)}
                  className={`${inputClass} w-20`} aria-label={`Score for ${teamA?.name}`} placeholder={teamA?.name} />
                <span>-</span>
                <input type="number" min="0" value={overrideB} onChange={(e) => setOverrideB(e.target.value)}
                  className={`${inputClass} w-20`} aria-label={`Score for ${teamB?.name}`} placeholder={teamB?.name} />
                <button onClick={() => review('override')} disabled={busy}
                  className="border border-yellow-500 text-yellow-300 px-4 py-2 font-bold hover:bg-yellow-500/10 disabled:opacity-50">
                  Apply this score
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                  placeholder="Note (required to reject, e.g. screenshot unreadable)" className={`${inputClass} flex-1`} />
                <button onClick={() => review('reject')} disabled={busy}
                  className="border border-red-500 text-red-300 px-4 py-2 font-bold hover:bg-red-500/10 disabled:opacity-50">
                  Reject
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Approving or overriding completes the match and moves the winner to the next round.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Submit form for either captain */}
      {canSubmit && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-gray-300">Submit the final score with a screenshot (PNG, JPG or WebP, max 5 MB).</p>
          <div className="grid grid-cols-[1fr_5rem] gap-2 items-center max-w-sm">
            <span className="font-semibold truncate">{teamA?.name}</span>
            <input type="number" min="0" value={scoreA} onChange={(e) => setScoreA(e.target.value)} className={inputClass} required aria-label={`Score for ${teamA?.name}`} />
            <span className="font-semibold truncate">{teamB?.name}</span>
            <input type="number" min="0" value={scoreB} onChange={(e) => setScoreB(e.target.value)} className={inputClass} required aria-label={`Score for ${teamB?.name}`} />
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gold file:px-3 file:py-1 file:font-bold file:text-black"
            required
          />
          <button type="submit" disabled={busy}
            className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark disabled:opacity-50">
            {busy ? 'Submitting...' : 'Submit result'}
          </button>
        </form>
      )}

      {!open && !canSubmit && match.status !== 'completed' && (
        <p className="text-sm text-gray-400">
          {myTeamId ? 'You can submit the result once the match has started.' : 'No result submitted yet.'}
        </p>
      )}

      {/* Earlier submissions */}
      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-400">Earlier submissions ({history.length})</summary>
          <ul className="mt-2 space-y-2">
            {history.map((s) => (
              <li key={s.id} className="text-gray-300">
                {s.score_a} - {s.score_b} by {teamName(s.team_id)} ·{' '}
                <span className={statusStyles[s.status].split(' ').find((c) => c.startsWith('text-'))}>{statusLabels[s.status]}</span>
                {s.status === 'overridden' && ` to ${s.final_score_a} - ${s.final_score_b}`}
                {s.review_note && <span className="text-gray-400"> · {s.review_note}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
