'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  optionIdFrom, type GameOption, type GameProfileField, type GameProfileSchema,
} from '@/utils/game-profiles';

const inputClass =
  'w-full p-2.5 rounded-xl bg-white text-stone-950 border border-stone-300 focus:border-gold focus:ring-2 focus:ring-gold/25 outline-none text-sm font-medium';

const TYPE_LABELS: Record<GameProfileField['type'], string> = {
  text: 'Text', number: 'Number', select: 'Single choice', multiselect: 'Multiple choice',
};
const MAPS_LABELS = { ign: 'In-game name (shown everywhere)', rank: 'Rank (badge, filters)', role: 'Main role (filters)' };

// Every option id in a schema, for "how many options would this save remove?"
function optionIds(schema: GameProfileSchema): Set<string> {
  const ids = new Set<string>();
  for (const f of schema.fields) for (const o of f.options ?? []) ids.add(`${f.key}:${o.id}`);
  return ids;
}

// Edits ONE game's form: field labels, help texts, required, max picks and the option lists
// (add, rename, reorder, remove, tiers). Field keys, types and the in-game name/rank/role
// mapping stay as they are (changing those would break saved profiles). Saving goes through
// update_game_profile_schema(), which checks everything again, refreshes the saved rank/role
// texts and logs the change.
export default function GameSchemaEditor({
  gameId, gameName, initial, onSaved,
}: { gameId: string; gameName: string; initial: GameProfileSchema; onSaved: (schema: GameProfileSchema) => void }) {
  const [schema, setSchema] = useState<GameProfileSchema>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  // Bumped by "Undo changes" so the tier inputs (which keep their own text) start over
  const [version, setVersion] = useState(0);

  const dirty = JSON.stringify(schema) !== JSON.stringify(initial);
  const removedCount = useMemo(() => {
    const now = optionIds(schema);
    return [...optionIds(initial)].filter((id) => !now.has(id)).length;
  }, [schema, initial]);

  const updateField = (index: number, change: Partial<GameProfileField>) => {
    setSchema((s) => ({ fields: s.fields.map((f, i) => (i === index ? { ...f, ...change } : f)) }));
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { error: rpcError } = await createClient().rpc('update_game_profile_schema', {
        p_game_id: gameId,
        // the schema is plain JSON (labels, ids, numbers)
        p_schema: JSON.parse(JSON.stringify(schema)),
      });
      if (rpcError) throw rpcError;
      setConfirming(false);
      setMessage(`${gameName} saved. Players see the new lists right away.`);
      onSaved(schema);
    } catch (err) {
      setError(getErrorMessage(err, 'The changes could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {schema.fields.map((f, index) => (
        <details key={`${version}-${f.key}`} className="group rounded-2xl border border-stone-200/90 bg-white shadow-2xs" open={index === 0}>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
            <span className="font-black uppercase tracking-wide text-stone-950">{f.label}</span>
            <span className="text-xs font-semibold text-stone-600">
              {TYPE_LABELS[f.type]}
              {f.options ? ` · ${f.options.length} options` : ''}
              {f.required ? ' · required' : ''}
              {f.maps_to ? ` · ${MAPS_LABELS[f.maps_to]}` : ''}
            </span>
          </summary>

          <div className="space-y-4 border-t border-stone-100 p-4">
            <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-stone-700">
                <span>Label</span>
                <input className={inputClass} value={f.label} maxLength={60} onChange={(e) => updateField(index, { label: e.target.value })} />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-stone-700">
                <span>Help text (optional)</span>
                <input className={inputClass} value={f.help ?? ''} maxLength={160} onChange={(e) => updateField(index, { help: e.target.value || undefined })} />
              </label>
              {f.maps_to !== 'ign' && (
                <label className="flex items-center gap-2 text-sm font-bold text-stone-800">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(index, { required: e.target.checked || undefined })} className="h-4 w-4" />
                  Required
                </label>
              )}
              {f.type === 'multiselect' && (
                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-stone-700">
                  <span>Most picks</span>
                  <input type="number" min={1} max={20} className={inputClass} value={f.max ?? ''} onChange={(e) => updateField(index, { max: Number(e.target.value) || undefined })} />
                </label>
              )}
            </div>
            {f.pattern && (
              <p className="text-xs text-stone-600">
                Format check: <code className="rounded bg-stone-100 px-1">{f.pattern}</code> ({f.pattern_hint ?? 'no hint'})
              </p>
            )}
            {f.options && (
              <OptionList
                field={f}
                isRank={f.maps_to === 'rank'}
                onChange={(options) => updateField(index, { options })}
              />
            )}
          </div>
        </details>
      ))}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white/95 p-4 shadow-md backdrop-blur-md">
        <span className="text-xs font-black tracking-wider text-stone-700">
          {dirty ? 'Unsaved changes' : 'No changes'}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => { setSchema(initial); setError(''); setVersion((v) => v + 1); }}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-700 disabled:opacity-50 cursor-pointer"
          >
            Undo changes
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => (removedCount > 0 ? setConfirming(true) : save())}
            className="rounded-xl bg-gold px-5 py-2 text-xs font-black uppercase tracking-wider text-stone-950 hover:bg-golddark disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : `Save ${gameName}`}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Remove ${removedCount} option${removedCount === 1 ? '' : 's'}?`}
          confirmLabel="Save and remove"
          tone="danger"
          busy={saving}
          error={error}
          onConfirm={save}
          onClose={() => setConfirming(false)}
        >
          <p>
            Players can no longer choose {removedCount === 1 ? 'it' : 'them'}. Profiles that already have a removed option
            keep showing it until the player edits their profile, and then they must pick another one.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// The options of one list: rename, reorder (rank lists are lowest -> highest), remove, add, tiers
function OptionList({
  field, isRank, onChange,
}: { field: GameProfileField; isRank: boolean; onChange: (options: GameOption[]) => void }) {
  const options = field.options ?? [];
  const [filter, setFilter] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const canHaveTiers = field.type === 'select';
  const shown = options
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.label.toLowerCase().includes(filter.trim().toLowerCase()));

  const update = (i: number, change: Partial<GameOption>) => onChange(options.map((o, j) => (j === i ? { ...o, ...change } : o)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const label = newLabel.trim();
    if (!label || options.some((o) => o.label.toLowerCase() === label.toLowerCase())) return;
    onChange([...options, { id: optionIdFrom(label, options.map((o) => o.id)), label }]);
    setNewLabel('');
  };
  // Tiers typed as "1, 2, 3" or "V, IV, III, II, I": existing tier ids are kept by position, so
  // renaming a tier doesn't break saved profiles
  const setTiers = (i: number, text: string) => {
    const labels = text.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const current = options[i].sub;
    if (labels.length === 0) {
      update(i, { sub: undefined });
      return;
    }
    const oldOptions = current?.type === 'select' ? current.options ?? [] : [];
    const taken: string[] = [];
    const subOptions = labels.map((label, k) => {
      const id = oldOptions[k]?.id ?? optionIdFrom(label, taken);
      taken.push(id);
      return { id, label };
    });
    update(i, { sub: { label: current?.type === 'select' ? current.label : 'Tier', type: 'select', options: subOptions } });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-black uppercase tracking-wider text-stone-700">
          Options{isRank && ' (lowest rank first)'}
        </p>
        {options.length > 12 && (
          <input
            className={`${inputClass} sm:w-56`}
            placeholder="Find an option..."
            aria-label={`Find an option in ${field.label}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
      </div>
      <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
        {shown.map(({ o, i }) => (
          <li key={o.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2 sm:flex-row sm:items-center">
            <span className="w-8 shrink-0 text-center text-xs font-black text-stone-500" aria-hidden="true">{i + 1}</span>
            <input
              className={`${inputClass} sm:flex-1`}
              value={o.label}
              maxLength={60}
              aria-label={`Name of option ${i + 1}`}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            {canHaveTiers && (
              o.sub?.type === 'number' ? (
                <span className="text-xs font-semibold text-stone-600 sm:w-56">
                  {o.sub.label}: number {o.sub.min ?? 0}–{o.sub.max ?? '∞'}
                </span>
              ) : (
                <input
                  className={`${inputClass} sm:w-56`}
                  placeholder="Tiers, e.g. 1, 2, 3 (empty = none)"
                  aria-label={`Tiers of ${o.label}`}
                  defaultValue={(o.sub?.options ?? []).map((t) => t.label).join(', ')}
                  onBlur={(e) => setTiers(i, e.target.value)}
                />
              )
            )}
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${o.label} up`} className="rounded-lg border border-stone-300 bg-white p-1.5 text-stone-700 disabled:opacity-40 cursor-pointer"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === options.length - 1} aria-label={`Move ${o.label} down`} className="rounded-lg border border-stone-300 bg-white p-1.5 text-stone-700 disabled:opacity-40 cursor-pointer"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} disabled={options.length <= 1} aria-label={`Remove ${o.label}`} className="rounded-lg border border-stone-300 bg-white p-1.5 text-red-700 disabled:opacity-40 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className={`${inputClass} sm:flex-1`}
          placeholder={`New ${field.label.toLowerCase()} option`}
          aria-label={`New ${field.label} option`}
          value={newLabel}
          maxLength={60}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gold bg-gold/15 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-950 hover:bg-gold/25 cursor-pointer">
          <Plus className="h-4 w-4" /> Add option
        </button>
      </div>
    </div>
  );
}
