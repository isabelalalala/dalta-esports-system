'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, Eye, EyeOff, Trophy } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { toast } from '@/components/Toaster';
import { useConfirm } from '@/components/useConfirm';
import { refreshSite } from '@/app/admin/website/actions';

interface ChampionRow {
  champion_team_name: string;
  roster: { user_id: string; ign: string; role: string }[];
  mvp_user_id: string | null;
  is_published: boolean;
}

// Admin Panel box (admins only: champion.manage) once the final has a winner: pick the MVP from the
// champion roster and publish or hide the Hall of Fame record. Both go through admin-checked,
// logged database functions (set_tournament_mvp, set_champion_published); the record itself is
// written by the database. refreshSite() shows the change on the cached public page right away.
export default function HallOfFameAdmin({ tournamentId, finalWinner }: { tournamentId: string; finalWinner: string | null }) {
  const supabase = createClient();
  const [row, setRow] = useState<ChampionRow | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDialog, ask] = useConfirm();

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('tournament_champions')
      .select('champion_team_name, roster, mvp_user_id, is_published')
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    if (loadError) setError(getErrorMessage(loadError, 'The Hall of Fame record could not be loaded.'));
    else setRow(data as unknown as ChampionRow | null);
  }, [supabase, tournamentId]);

  // Reload when the final's winner changes (the record follows it)
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, finalWinner]);

  const setMvp = async (userId: string) => {
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('set_tournament_mvp', { p_tournament_id: tournamentId, p_user_id: userId || null });
    setBusy(false);
    if (rpcError) return toast.error(getErrorMessage(rpcError, 'The MVP could not be saved.'));
    toast.success(userId ? 'MVP saved.' : 'MVP cleared.');
    await refreshSite().catch(() => undefined);
    load();
  };

  const togglePublished = async () => {
    if (!row) return;
    const publish = !row.is_published;
    if (!publish && !(await ask({
      title: 'Hide from the Hall of Fame?',
      message: `${row.champion_team_name} will no longer be shown on the public Hall of Fame. You can publish it again later.`,
      confirmLabel: 'Hide',
    }))) return;
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('set_champion_published', { p_tournament_id: tournamentId, p_published: publish });
    setBusy(false);
    if (rpcError) return toast.error(getErrorMessage(rpcError, 'The Hall of Fame record could not be changed.'));
    toast.success(publish ? 'Published in the Hall of Fame.' : 'Hidden from the Hall of Fame.');
    await refreshSite().catch(() => undefined);
    load();
  };

  if (error) return <p role="alert" className="text-sm font-bold text-red-700">{error}</p>;
  if (!row) return null; // no champion yet (or the migration hasn't run)

  return (
    <div className="rounded-2xl border border-gold/60 bg-gold/10 p-4 sm:p-5 space-y-3">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-stone-950">
          <Trophy className="size-4 text-amber-700" aria-hidden="true" /> Hall of Fame · {row.champion_team_name}
        </p>
        <Link href="/hall-of-fame" className="text-xs font-black uppercase tracking-widest text-maroon hover:underline">View page →</Link>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 min-w-0 space-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-stone-600">
            <Award className="size-3.5" aria-hidden="true" /> MVP (from the champion roster)
          </span>
          <select
            value={row.mvp_user_id ?? ''}
            onChange={(e) => setMvp(e.target.value)}
            disabled={busy}
            className="w-full h-11 rounded-xl border border-stone-300 bg-surface px-3 text-sm font-bold text-stone-950 focus:border-amber-600 disabled:opacity-60"
          >
            <option value="">No MVP</option>
            {row.roster.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.ign}{m.role === 'captain' ? ' (captain)' : ''}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={togglePublished} disabled={busy} className="btn btn-secondary">
          {row.is_published ? <><EyeOff className="size-4" aria-hidden="true" /> Hide</> : <><Eye className="size-4" aria-hidden="true" /> Publish</>}
        </button>
      </div>
      {!row.is_published && <p className="text-xs font-bold text-stone-700">Hidden: only admins see this record.</p>}
    </div>
  );
}
