'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getErrorMessage } from '@/utils/errors';

interface Props {
  team: { id: string; name: string; gameName?: string };
  onClose: () => void;
  // Called after the team was removed, with a short summary for the success message
  onRemoved: (summary: string) => void;
}

interface Preview {
  members: { name: string; captain: boolean }[];
  tournaments: string[];
  // Unfinished matches: they become walkovers for the opponent
  matches: { label: string }[];
}

const REASON_MIN = 5;
const REASON_MAX = 500;

// "Remove team" confirmation (admin/staff). Shows who is on the team, what it's registered for
// and which bracket matches will be given away, and requires a reason. The database function
// remove_team() does the actual work and checks the role again.
export default function RemoveTeamDialog({ team, onClose, onRemoved }: Props) {
  const supabase = createClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [rosterRes, regsRes, matchesRes] = await Promise.all([
          supabase.rpc('get_team_roster', { p_team_id: team.id }),
          supabase
            .from('tournament_registrations')
            .select('status, tournaments(name, end_date)')
            .eq('team_id', team.id)
            .in('status', ['pending', 'approved']),
          supabase
            .from('matches')
            .select('round, match_number, tournaments(name)')
            .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
            .neq('status', 'completed'),
        ]);
        if (rosterRes.error) throw rosterRes.error;
        if (regsRes.error) throw regsRes.error;
        if (matchesRes.error) throw matchesRes.error;

        const today = new Date().toISOString().slice(0, 10);
        setPreview({
          members: (rosterRes.data || []).map((m) => ({ name: m.full_name || 'Unnamed player', captain: m.role === 'captain' })),
          // Same rule as remove_team(): only tournaments that haven't ended are withdrawn
          tournaments: (regsRes.data || [])
            .filter((r) => r.tournaments && (r.tournaments.end_date ?? '').slice(0, 10) >= today)
            .map((r) => `${r.tournaments!.name} (${r.status})`),
          matches: (matchesRes.data || []).map((m) => ({
            label: `${m.tournaments?.name ?? 'Tournament'}: round ${m.round}, match ${m.match_number}`,
          })),
        });
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load the team details.'));
      }
    };
    load();
  }, [supabase, team.id]);

  const cleanReason = reason.trim();

  const handleConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('remove_team', {
        p_team_id: team.id,
        p_reason: cleanReason,
      });
      if (rpcError) throw rpcError;
      const result = data as { members: number; withdrawn: number; walkovers: number };
      const parts = [`${team.name} was removed.`];
      if (result.withdrawn > 0) parts.push(`${result.withdrawn} registration(s) withdrawn.`);
      if (result.walkovers > 0) parts.push(`${result.walkovers} match(es) given to the opponent as a walkover.`);
      onRemoved(parts.join(' '));
    } catch (err) {
      setError(getErrorMessage(err, 'The team could not be removed.'));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title={`Remove ${team.name}?`}
      confirmLabel="Remove team"
      tone="danger"
      busy={busy}
      confirmDisabled={!preview || cleanReason.length < REASON_MIN}
      error={error}
      onConfirm={handleConfirm}
      onClose={onClose}
    >
      <p>
        The team disappears from team lists, recruiting and new registrations. Its members are freed to join
        other teams and get a notification with your reason. Past matches keep the team&apos;s name.
      </p>

      {!preview ? (
        !error && <p className="text-stone-600">Loading team details...</p>
      ) : (
        <>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-600">
              Members ({preview.members.length})
            </h3>
            {preview.members.length === 0 ? (
              <p className="text-stone-600">No members.</p>
            ) : (
              <ul className="mt-1 list-disc pl-5">
                {preview.members.map((m, i) => (
                  <li key={i} className="break-words">
                    {m.name}
                    {m.captain && <span className="font-bold text-maroon"> (captain)</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-600">
              Registrations that will be withdrawn
            </h3>
            {preview.tournaments.length === 0 ? (
              <p className="text-stone-600">None.</p>
            ) : (
              <ul className="mt-1 list-disc pl-5">
                {preview.tournaments.map((t) => (
                  <li key={t} className="break-words">{t}</li>
                ))}
              </ul>
            )}
          </div>

          {preview.matches.length > 0 && (
            <div role="note" className="rounded-xl border border-yellow-500/40 bg-yellow-50 p-3">
              <p className="font-bold text-stone-950">This team is in an active bracket.</p>
              <p className="mt-1">
                Its unfinished match{preview.matches.length > 1 ? 'es' : ''} will be given to the opponent as a
                walkover (forfeit). If the opponent isn&apos;t known yet, the walkover happens as soon as they are.
                This can&apos;t be undone, even if the team is restored later.
              </p>
              <ul className="mt-1 list-disc pl-5">
                {preview.matches.map((m, i) => (
                  <li key={i} className="break-words">{m.label}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="space-y-1.5">
        <label htmlFor="remove-team-reason" className="block text-xs font-black uppercase tracking-wider text-stone-700">
          Reason (required)
        </label>
        <textarea
          id="remove-team-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX}
          rows={3}
          placeholder="e.g. Code of Conduct violation during the semifinal"
          className="w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-500 focus:border-gold focus:ring-2 focus:ring-gold/25 outline-none text-base sm:text-sm"
        />
        <p className="text-xs text-stone-600">
          {cleanReason.length < REASON_MIN
            ? `At least ${REASON_MIN} characters.`
            : `${cleanReason.length}/${REASON_MAX}`}{' '}
          The members will see this reason.
        </p>
      </div>
    </ConfirmDialog>
  );
}
