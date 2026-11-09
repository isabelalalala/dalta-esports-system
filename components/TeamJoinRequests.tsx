'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { TeamJoinRequest } from '@/utils/types';
import VerifiedBadge from '@/components/VerifiedBadge';
import Avatar from '@/components/Avatar';
import ConfirmDialog from '@/components/ConfirmDialog';
import SectionHint from '@/components/SectionHint';
import { timeAgo } from '@/utils/notifications';
import RankBadge from '@/components/RankBadge';
import { UserPlus } from 'lucide-react';

interface Props {
  teamId: string;
  gameName: string;
  recruiting: boolean;
  // The captain answers requests; organizers only see them
  canAnswer: boolean;
  // Captain and admin/staff can switch recruiting on/off
  canToggle: boolean;
  isSolo: boolean;
  isFull: boolean;
  // Free roster spots (Accept all stops when the roster is full)
  openSlots: number;
  // Changes when the page reloads (e.g. a live update): the requests are loaded again
  refreshKey?: number;
  // Called after a change that affects the rest of the page (roster, recruiting flag)
  onChanged: () => void;
}

// Team page card: the "Recruiting" switch and the open join requests with Accept / Decline.
export default function TeamJoinRequests({
  teamId, gameName, recruiting, canAnswer, canToggle, isSolo, isFull, openSlots, refreshKey, onChanged,
}: Props) {
  const supabase = createClient();
  const [requests, setRequests] = useState<TeamJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  // "Accept all" / "Decline all" confirmation, and its result
  const [bulk, setBulk] = useState<'accept' | 'decline' | null>(null);
  const [bulkMessage, setBulkMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_team_join_requests', { p_team_id: teamId });
        if (rpcError) throw rpcError;
        setRequests((data || []) as TeamJoinRequest[]);
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load join requests.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, teamId, reloadCount, refreshKey]);

  const toggleRecruiting = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('set_team_recruiting', {
        p_team_id: teamId,
        p_recruiting: !recruiting,
      });
      if (rpcError) throw rpcError;
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change recruiting.'));
    } finally {
      setBusy(false);
    }
  };

  const answer = async (request: TeamJoinRequest, accept: boolean) => {
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('respond_to_join_request', {
        p_request_id: request.request_id,
        p_accept: accept,
      });
      if (rpcError) throw rpcError;
      setReloadCount((n) => n + 1);
      // Accepting changes the roster shown above
      if (accept) onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not answer the request.'));
    } finally {
      setBusy(false);
    }
  };

  // Answers every open request one by one through respond_to_join_request() (same checks,
  // notifications and activity log entries as the single buttons). Accepting goes oldest first and
  // stops when the roster is full; the others stay pending.
  const answerAll = async (accept: boolean) => {
    setBusy(true);
    setError('');
    setBulkMessage('');
    const queue = accept ? requests.slice(0, Math.max(openSlots, 0)) : requests;
    let done = 0;
    const failed: string[] = [];
    for (const r of queue) {
      const { error: rpcError } = await supabase.rpc('respond_to_join_request', {
        p_request_id: r.request_id,
        p_accept: accept,
      });
      if (rpcError) failed.push(`${r.ign || r.full_name || 'Player'} (${getErrorMessage(rpcError, 'failed')})`);
      else done++;
    }
    const left = requests.length - queue.length;
    const parts = [`${accept ? 'Accepted' : 'Declined'} ${done} request${done === 1 ? '' : 's'}.`];
    if (failed.length) parts.push(`Couldn't ${accept ? 'accept' : 'decline'}: ${failed.join('; ')}.`);
    if (accept && left > 0) parts.push(`${left} still pending: the roster is full.`);
    setBulkMessage(parts.join(' '));
    setBulk(null);
    setBusy(false);
    setReloadCount((n) => n + 1);
    if (accept && done > 0) onChanged();
  };

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider flex items-center gap-1.5">Recruiting <SectionHint text="Recruiting — accept or decline players who want to join your team. Switch it on so players can find you under All teams." /></h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              {recruiting
                ? 'Players can find this team under All teams and ask to join.'
                : 'Turn this on to let players ask to join from the All teams list.'}
            </p>
          </div>
        </div>

        {canToggle && !isSolo && (
          <button
            type="button"
            onClick={toggleRecruiting}
            disabled={busy}
            aria-pressed={recruiting}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider shadow-2xs transition-all disabled:opacity-50 cursor-pointer ${
              recruiting
                ? 'border border-stone-300 bg-white text-stone-800 hover:border-red-300 hover:text-red-700'
                : 'border border-amber-400 bg-gold text-stone-950 hover:bg-golddark'
            }`}
          >
            {recruiting ? 'Stop recruiting' : 'Start recruiting'}
          </button>
        )}
      </div>

      {isSolo && (
        <p className="text-xs sm:text-sm text-stone-500 font-medium">
          {gameName} teams have one player, so they can&apos;t recruit.
        </p>
      )}
      {recruiting && isFull && (
        <p className="text-xs sm:text-sm text-amber-800 font-semibold">
          The roster is full, so new requests can&apos;t be accepted until a spot opens.
        </p>
      )}
      {error && <p role="alert" className="text-xs sm:text-sm font-bold text-red-700">{error}</p>}

      {!isSolo && (
        <div className="space-y-3">
          <h3 className="font-black text-stone-950 text-xs sm:text-sm tracking-wider uppercase">
            Join requests ({loading ? '…' : requests.length})
          </h3>

          {bulkMessage && <p role="status" className="text-sm font-bold text-stone-800">{bulkMessage}</p>}

          {/* Bulk answers (captain only, when there is more than one request) */}
          {canAnswer && requests.length > 1 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setBulk('accept')}
                disabled={busy || isFull}
                className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-4 py-2 text-xs uppercase tracking-wider shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => setBulk('decline')}
                disabled={busy}
                className="rounded-xl border border-red-200 text-red-700 hover:bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                Decline all
              </button>
            </div>
          )}

          {bulk && (
            <ConfirmDialog
              title={bulk === 'accept' ? 'Accept all join requests?' : 'Decline all join requests?'}
              confirmLabel={bulk === 'accept' ? 'Accept all' : 'Decline all'}
              tone={bulk === 'decline' ? 'danger' : 'normal'}
              busy={busy}
              onConfirm={() => answerAll(bulk === 'accept')}
              onClose={() => setBulk(null)}
            >
              {bulk === 'accept' ? (
                <p>
                  {requests.length > openSlots
                    ? `Your roster has ${openSlots} open spot${openSlots === 1 ? '' : 's'}, so the ${openSlots} oldest of the ${requests.length} requests are accepted. The rest stay pending.`
                    : `All ${requests.length} players are added to the team.`}{' '}
                  Each player gets a notification.
                </p>
              ) : (
                <p>All {requests.length} players are told their request was declined. They can ask again later.</p>
              )}
              <ul className="list-disc pl-5">
                {(bulk === 'accept' ? requests.slice(0, openSlots) : requests).map((r) => (
                  <li key={r.request_id} className="break-words">{r.ign || r.full_name || 'Player'}</li>
                ))}
              </ul>
            </ConfirmDialog>
          )}

          {!loading && requests.length === 0 && (
            <p className="text-xs sm:text-sm text-stone-500 font-medium">No open requests.</p>
          )}

          {requests.map((r) => (
            <div
              key={r.request_id}
              className="p-4 rounded-2xl border border-stone-200/80 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar url={r.avatar_url} name={r.full_name || r.ign} size="sm" />
                  <span className="font-black text-stone-950 text-sm break-words">
                    {r.ign || r.full_name || 'Player'}
                  </span>
                  <VerifiedBadge verified={r.is_verified} />
                  <span className="text-[11px] text-stone-500 font-medium">{timeAgo(r.created_at)}</span>
                </div>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-stone-500 font-semibold">
                  <RankBadge rank={r.rank} position={r.rank_position} count={r.rank_count} />
                  {r.in_game_role && <span className="text-maroon font-extrabold">{r.in_game_role} ·</span>}
                  <span>{r.full_name}</span>
                </p>
                {r.message && (
                  <p className="text-xs sm:text-sm text-stone-700 font-medium break-words">“{r.message}”</p>
                )}
              </div>

              {canAnswer && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => answer(r, true)}
                    disabled={busy || isFull}
                    className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-4 py-2 text-xs uppercase tracking-wider shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(r, false)}
                    disabled={busy}
                    className="rounded-xl border border-red-200 text-red-700 hover:bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
