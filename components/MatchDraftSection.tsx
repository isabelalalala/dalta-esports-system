'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { DRAFT_SLOTS, LOL_CHAMPIONS, MAX_GAMES, toSlots, validateDraft, type MatchDraft } from '@/utils/lol-champions';
import { Ban, Swords } from 'lucide-react';
import SectionHint from '@/components/SectionHint';

interface Props {
  matchId: string;
  teamAName: string;
  teamBName: string;
  // Admin/staff: can enter and change the draft (the database checks the role again)
  canEdit: boolean;
}

type ListKey = 'team_a_bans' | 'team_a_picks' | 'team_b_bans' | 'team_b_picks';
const LIST_KEYS: ListKey[] = ['team_a_bans', 'team_a_picks', 'team_b_bans', 'team_b_picks'];

// League of Legends ban/pick summary for one match, per game of the series (match_drafts).
// Everyone sees it (it updates live); staff enter it. Shown only for LoL matches.
export default function MatchDraftSection({ matchId, teamAName, teamBName, canEdit }: Props) {
  const supabase = createClient();
  const [drafts, setDrafts] = useState<MatchDraft[]>([]);
  const [game, setGame] = useState(1);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<ListKey, string[]>>(() => emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  useRealtimeRefresh(`draft-${matchId}`, [{ table: 'match_drafts', filter: `match_id=eq.${matchId}` }], reload);

  useEffect(() => {
    supabase
      .from('match_drafts')
      .select('*')
      .eq('match_id', matchId)
      .order('game_number')
      .then(({ data, error: loadError }) => {
        if (loadError) setError(getErrorMessage(loadError, 'Could not load the ban/pick summary.'));
        else setDrafts((data || []) as MatchDraft[]);
      });
  }, [supabase, matchId, reloadCount]);

  const current = drafts.find((d) => d.game_number === game);
  const nextGame = Math.min((drafts.at(-1)?.game_number ?? 0) + 1, MAX_GAMES);

  const startEditing = (gameNumber: number) => {
    const d = drafts.find((x) => x.game_number === gameNumber);
    setGame(gameNumber);
    setForm({
      team_a_bans: toSlots(d?.team_a_bans), team_a_picks: toSlots(d?.team_a_picks),
      team_b_bans: toSlots(d?.team_b_bans), team_b_picks: toSlots(d?.team_b_picks),
    });
    setError('');
    setEditing(true);
  };

  const setSlot = (key: ListKey, index: number, value: string) =>
    setForm((f) => ({ ...f, [key]: f[key].map((v, i) => (i === index ? value : v)) }));

  const save = async () => {
    const problem = validateDraft(LIST_KEYS.map((k) => form[k]));
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const row = {
        match_id: matchId,
        game_number: game,
        ...Object.fromEntries(LIST_KEYS.map((k) => [k, form[k].map((n) => n.trim()).filter(Boolean)])),
      };
      const { data, error: saveError } = await supabase
        .from('match_drafts')
        .upsert(row, { onConflict: 'match_id,game_number' })
        .select('id');
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error('Only tournament staff can enter the ban/pick summary.');
      setEditing(false);
      reload();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the ban/pick summary.'));
    } finally {
      setBusy(false);
    }
  };

  // Nothing entered yet and the viewer can't enter it: show nothing
  if (drafts.length === 0 && !canEdit) return null;

  return (
    <section className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Swords className="h-5 w-5" /> Bans &amp; picks
          <SectionHint text="Bans & picks — the champions each team banned and picked in every game of this League of Legends match, entered by staff." />
        </h2>
        {drafts.length > 0 && (
          <div role="tablist" aria-label="Game" className="flex flex-wrap gap-1">
            {drafts.map((d) => (
              <button
                key={d.game_number}
                role="tab"
                aria-selected={game === d.game_number}
                onClick={() => { setGame(d.game_number); setEditing(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer ${
                  game === d.game_number ? 'bg-gold text-stone-950' : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >
                Game {d.game_number}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}

      {editing ? (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Game {game}. Up to {DRAFT_SLOTS} bans and {DRAFT_SLOTS} picks per team; leave unused slots empty.
          </p>
          <datalist id="lol-champions">
            {LOL_CHAMPIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([['A', teamAName], ['B', teamBName]] as const).map(([side, teamName]) => (
              <fieldset key={side} className="rounded-xl border border-stone-200 p-3 space-y-3 min-w-0">
                <legend className="px-1 text-sm font-black text-stone-950 break-words">{teamName}</legend>
                {(['bans', 'picks'] as const).map((kind) => {
                  const key = `team_${side.toLowerCase()}_${kind}` as ListKey;
                  return (
                    <div key={kind} className="space-y-1.5">
                      <p className="text-xs font-black uppercase tracking-wider text-stone-600">{kind}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {form[key].map((value, i) => (
                          <input
                            key={i}
                            list="lol-champions"
                            value={value}
                            maxLength={30}
                            onChange={(e) => setSlot(key, i, e.target.value)}
                            aria-label={`${teamName} ${kind === 'bans' ? 'ban' : 'pick'} ${i + 1}`}
                            placeholder={`${kind === 'bans' ? 'Ban' : 'Pick'} ${i + 1}`}
                            className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-950 placeholder:text-stone-500 focus:border-gold focus:ring-2 focus:ring-gold/25 outline-none"
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 text-xs font-black uppercase tracking-widest disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Saving...' : `Save game ${game}`}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-black uppercase tracking-widest cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : current ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DraftColumn teamName={teamAName} bans={current.team_a_bans} picks={current.team_a_picks} />
          <DraftColumn teamName={teamBName} bans={current.team_b_bans} picks={current.team_b_picks} />
        </div>
      ) : (
        <p className="text-stone-600">No bans or picks entered yet.</p>
      )}

      {canEdit && !editing && (
        <div className="flex flex-wrap gap-2">
          {current && (
            <button
              type="button"
              onClick={() => startEditing(game)}
              className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              Edit game {game}
            </button>
          )}
          {drafts.length < MAX_GAMES && (
            <button
              type="button"
              onClick={() => startEditing(nextGame)}
              className="px-4 py-2 rounded-xl bg-gold hover:bg-golddark text-stone-950 text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              {drafts.length === 0 ? 'Enter bans & picks' : `Add game ${nextGame}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function DraftColumn({ teamName, bans, picks }: { teamName: string; bans: string[]; picks: string[] }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 min-w-0">
      <p className="font-black text-stone-950 break-words">{teamName}</p>
      <p className="mt-2 text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-1">
        <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Bans
      </p>
      <p className="text-stone-800 break-words">{bans.length ? bans.join(', ') : 'None'}</p>
      <p className="mt-2 text-xs font-black uppercase tracking-wider text-stone-600">Picks</p>
      <ul className="text-stone-950 font-semibold">
        {picks.length ? picks.map((p) => <li key={p} className="break-words">{p}</li>) : <li className="font-normal text-stone-600">None</li>}
      </ul>
    </div>
  );
}

function emptyForm(): Record<ListKey, string[]> {
  return { team_a_bans: toSlots([]), team_a_picks: toSlots([]), team_b_bans: toSlots([]), team_b_picks: toSlots([]) };
}
