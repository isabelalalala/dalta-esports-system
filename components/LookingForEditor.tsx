'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { fieldFor, parseSchema } from '@/utils/game-profiles';
import { lookingForText, parseLookingFor } from '@/utils/team-cards';
import { toast } from '@/components/Toaster';

const MAX_ROLES = 3;

interface Props {
  teamId: string;
  profileSchema: unknown;
  value: unknown;
  recruiting: boolean;
  // Captain edits; everyone else sees the line (only while recruiting)
  canEdit: boolean;
  onSaved: () => void;
}

// "Looking for" on the team page: the captain ticks up to 3 roles and a minimum rank from the
// game's profile form (Phase 8); check_team_looking_for() checks the same on save. It shows on the
// team card while the team is recruiting, and the All teams role/rank filters search it.
export default function LookingForEditor({ teamId, profileSchema, value, recruiting, canEdit, onSaved }: Props) {
  const supabase = createClient();
  const schema = parseSchema(profileSchema);
  const roleOptions = fieldFor(schema, 'role')?.options ?? [];
  const rankOptions = fieldFor(schema, 'rank')?.options ?? [];
  const saved = parseLookingFor(value);
  const [roles, setRoles] = useState<string[]>(saved.roles);
  const [rankMin, setRankMin] = useState(saved.rank_min ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const text = lookingForText(schema, value);

  if (!canEdit) {
    if (!recruiting || !text) return null;
    return (
      <p className="flex items-start gap-2 text-sm text-stone-800">
        <Search className="mt-0.5 size-4 shrink-0 text-maroon" aria-hidden="true" />
        <span><span className="font-black">Looking for:</span> {text}</span>
      </p>
    );
  }
  if (roleOptions.length === 0 && rankOptions.length === 0) return null;

  const toggleRole = (id: string) =>
    setRoles((current) => (current.includes(id) ? current.filter((r) => r !== id) : current.length < MAX_ROLES ? [...current, id] : current));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: saveError } = await supabase
        .from('teams')
        .update({ looking_for: { roles, rank_min: rankMin || null } })
        .eq('id', teamId)
        .select('id');
      if (saveError) throw saveError;
      if (!data?.length) throw new Error('Only the captain can change this.');
      toast.success('"Looking for" saved.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save "Looking for".'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="space-y-3 rounded-2xl border border-stone-200/90 bg-stone-50/60 p-4">
      <legend className="px-1 text-xs font-black uppercase tracking-wider text-stone-700">Looking for</legend>
      <p className="max-w-prose text-sm text-stone-600">
        Shown on your team card while recruiting, and used by the role and rank filters in All teams.
        {!recruiting && ' Your team isn’t recruiting right now, so it’s hidden.'}
      </p>
      {roleOptions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Roles (up to ${MAX_ROLES})`}>
          {roleOptions.map((o) => {
            const on = roles.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleRole(o.id)}
                disabled={!on && roles.length >= MAX_ROLES}
                className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 ${
                  on ? 'border-golddark bg-gold text-ink' : 'border-stone-300 bg-white text-stone-700 hover:border-gold'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {rankOptions.length > 0 && (
        <label className="block max-w-xs text-sm font-bold text-stone-800">
          Minimum rank
          <select
            value={rankMin}
            onChange={(e) => setRankMin(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-sm font-medium text-stone-950 outline-none focus:border-gold focus:ring-2 focus:ring-gold/25"
          >
            <option value="">Any rank</option>
            {rankOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}+</option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={busy} className="btn btn-primary">
        {busy ? 'Saving...' : 'Save'}
      </button>
    </fieldset>
  );
}
