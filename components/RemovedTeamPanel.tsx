'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getErrorMessage } from '@/utils/errors';
import { can, isOrganizer } from '@/utils/permissions';
import { formatDateTime } from '@/utils/tournaments';
import type { TeamRemoval } from '@/utils/types';
import { Ban, RotateCcw } from 'lucide-react';

interface Props {
  team: { id: string; name: string; removed_at: string | null };
  role: string;
  onRestored: (summary: string) => void;
}

// Shown on /teams/[id] instead of the normal page when the team was removed (202611081000).
// Everyone sees that it was removed. Organizers also see the reason and the roster at the time
// (team_removals is organizer-only in RLS); admins can restore it.
export default function RemovedTeamPanel({ team, role, onRestored }: Props) {
  const supabase = createClient();
  const [removal, setRemoval] = useState<TeamRemoval | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const organizer = isOrganizer(role);

  useEffect(() => {
    if (!organizer) return;
    supabase
      .from('team_removals')
      .select('*')
      .eq('team_id', team.id)
      .order('removed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (loadError) setError(getErrorMessage(loadError, 'Could not load the removal details.'));
        else setRemoval(data as TeamRemoval | null);
      });
  }, [supabase, team.id, organizer]);

  const handleRestore = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('restore_team', { p_team_id: team.id });
      if (rpcError) throw rpcError;
      const result = data as { members: number; skipped: string[] };
      let summary = `${team.name} was restored with ${result.members} member(s).`;
      if (result.skipped.length > 0) {
        summary += ` Not added back (now on another team or no longer eligible): ${result.skipped.join(', ')}.`;
      }
      setConfirming(false);
      onRestored(summary);
    } catch (err) {
      setError(getErrorMessage(err, 'The team could not be restored.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-start gap-3">
        <Ban className="w-6 h-6 shrink-0 text-red-700" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-lg font-black uppercase tracking-wide text-stone-950 break-words">
            {team.name} was removed
          </h2>
          <p className="text-base leading-relaxed text-stone-700">
            The organizers removed this team{team.removed_at ? ` on ${formatDateTime(team.removed_at)}` : ''}. It
            no longer plays, recruits or registers. Its past matches stay in the brackets.
          </p>
        </div>
      </div>

      {organizer && removal && (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-black uppercase tracking-wider text-stone-600">Reason</dt>
            <dd className="text-stone-950 break-words whitespace-pre-wrap">{removal.reason}</dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-wider text-stone-600">Members at the time</dt>
            <dd className="text-stone-950 break-words">
              {removal.roster.length === 0
                ? 'None'
                : removal.roster.map((m) => `${m.full_name || 'Unnamed'}${m.role === 'captain' ? ' (captain)' : ''}`).join(', ')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-wider text-stone-600">Withdrawn / walkovers</dt>
            <dd className="text-stone-950 break-words">
              {removal.tournaments.length === 0 ? 'No registrations' : removal.tournaments.join(', ')}
              {' · '}
              {removal.walkovers} walkover(s)
            </dd>
          </div>
        </dl>
      )}

      {error && !confirming && (
        <p role="alert" className="text-sm font-bold text-red-700">{error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={organizer ? '/admin/teams' : '/teams'}
          className="inline-flex justify-center px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-950 text-xs font-black uppercase tracking-widest"
        >
          {organizer ? 'Back to team management' : 'Back to teams'}
        </Link>
        {can(role, 'team.restore') && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-400 bg-gold hover:bg-golddark text-stone-950 text-xs font-black uppercase tracking-widest cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Restore team
          </button>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Restore ${team.name}?`}
          confirmLabel="Restore team"
          busy={busy}
          error={error}
          onConfirm={handleRestore}
          onClose={() => setConfirming(false)}
        >
          <p>
            The team comes back with its captain. Former members who are still free to join are added back;
            the others are listed afterwards so the captain can invite them again.
          </p>
          <p className="font-bold">
            Withdrawn registrations and walkover results are not undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
