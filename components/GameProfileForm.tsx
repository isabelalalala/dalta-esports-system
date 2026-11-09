'use client';

import { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import GameLogo from '@/components/GameLogo';
import type { Game, PlayerGameProfile } from '@/utils/types';
import {
  fieldFor, optionOf, parseDetails, parseSchema, subKey, validateGameProfile,
  type GameProfileDetails, type GameProfileField,
} from '@/utils/game-profiles';

interface Props {
  games: Game[];
  profiles: PlayerGameProfile[]; // the player's existing game profiles
  userId: string;
  initialGameId: string;
  onSaved: (gameName: string) => void;
  onCancel: () => void;
}

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-500 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none transition-all font-medium text-sm';

// Starting values for a game: the saved details, or for a profile saved before the new form,
// just its in-game name in the game's name field
function startingDetails(game: Game | undefined, profile: PlayerGameProfile | undefined): GameProfileDetails {
  const details = parseDetails(profile?.details);
  if (Object.keys(details).length > 0 || !profile || !game) return details;
  const ignField = fieldFor(parseSchema(game.profile_schema), 'ign');
  return ignField ? { [ignField.key]: profile.ign } : {};
}

// Create or edit a game profile. The player picks the game (logos) first; only that game's fields
// are shown (games.profile_schema), and switching games starts that game's form over. A rank with
// tiers shows its Tier/Division/Stars field; ranks without (Radiant, Master+) don't. The database
// trigger check_game_profile() checks everything again on save.
export default function GameProfileForm({ games, profiles, userId, initialGameId, onSaved, onCancel }: Props) {
  const formId = useId();
  const [gameId, setGameId] = useState(initialGameId);
  const game = games.find((g) => g.id === gameId);
  const existing = profiles.find((p) => p.game_id === gameId);
  const schema = useMemo(() => parseSchema(game?.profile_schema), [game]);
  const [details, setDetails] = useState<GameProfileDetails>(() => startingDetails(game, existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const switchGame = (id: string) => {
    if (id === gameId) return;
    const next = games.find((g) => g.id === id);
    setGameId(id);
    setDetails(startingDetails(next, profiles.find((p) => p.game_id === id)));
    setErrors({});
    setSaveError('');
  };

  const setValue = (key: string, value: string | number | string[] | undefined) => {
    setDetails((d) => {
      const next = { ...d };
      if (value === undefined || value === '') delete next[key];
      else next[key] = value;
      return next;
    });
    setErrors((e) => {
      const rest = { ...e };
      delete rest[key.replace(/_sub$/, '')];
      return rest;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game) return;
    const result = validateGameProfile(schema, details);
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) {
      setSaveError('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const supabase = createClient();
      const ignField = fieldFor(schema, 'ign');
      // ign/rank/in_game_role are filled in by the database from details
      const { error } = existing
        ? await supabase.from('player_game_profiles').update({ details: result.clean }).eq('id', existing.id)
        : await supabase.from('player_game_profiles').insert({
            user_id: userId,
            game_id: game.id,
            ign: String(ignField ? result.clean[ignField.key] : ''),
            details: result.clean,
          });
      if (error) throw error;
      onSaved(game.name);
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Your game profile could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-stone-50/80 border border-gold/70 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm"
      aria-labelledby={`${formId}-title`}
    >
      <div className="space-y-2">
        <h3 id={`${formId}-title`} className="font-black text-maroon text-sm tracking-wider uppercase">
          {existing ? 'Edit' : 'Add'} {game?.name ?? ''} profile
        </h3>
        {/* 1. Pick the game */}
        <div role="radiogroup" aria-label="Game" className="flex flex-wrap gap-2">
          {games.map((g) => {
            const selected = g.id === gameId;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => switchGame(g.id)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors cursor-pointer ${
                  selected ? 'border-gold bg-gold/15 text-stone-950' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                }`}
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink p-1">
                  <GameLogo name={g.name} gameId={g.id} className="h-5 w-5" fallbackClassName="text-[8px]" sizes="20px" />
                </span>
                {g.name}
                {profiles.some((p) => p.game_id === g.id) && <span className="sr-only">(profile saved)</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Only that game's fields */}
      {schema.fields.length === 0 ? (
        <p className="text-sm text-stone-600">This game has no profile form yet. Please check back later.</p>
      ) : (
        <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
          {schema.fields.map((f) => (
            <FieldInput
              key={`${gameId}-${f.key}`}
              formId={formId}
              field={f}
              details={details}
              error={errors[f.key]}
              setValue={setValue}
            />
          ))}
        </div>
      )}

      {saveError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{saveError}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || schema.fields.length === 0}
          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-wider uppercase shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-2.5 text-xs tracking-wider uppercase transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  formId, field: f, details, error, setValue,
}: {
  formId: string;
  field: GameProfileField;
  details: GameProfileDetails;
  error?: string;
  setValue: (key: string, value: string | number | string[] | undefined) => void;
}) {
  const id = `${formId}-${f.key}`;
  const describedBy = [f.help || f.pattern_hint ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const value = details[f.key];
  const wide = f.type === 'multiselect';

  const label = (
    <label htmlFor={id} className="block text-xs font-black text-stone-700 tracking-wider uppercase">
      {f.label}{f.required && <span className="text-maroon"> *</span>}
    </label>
  );
  const help = (f.help || f.pattern_hint) && (
    <p id={`${id}-help`} className="text-[11px] font-medium text-stone-600">{f.help ?? f.pattern_hint}</p>
  );
  const errorText = error && (
    <p id={`${id}-error`} className="text-xs font-bold text-red-700">{error}</p>
  );
  const errorBorder = error ? ' border-red-400' : '';

  if (f.type === 'select') {
    const chosen = optionOf(f, value);
    const sub = chosen?.sub;
    const subId = `${id}-sub`;
    return (
      <div className="space-y-1.5 min-w-0">
        {label}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            id={id}
            value={typeof value === 'string' ? value : ''}
            // A new rank starts without a tier (the old one may not exist for it)
            onChange={(e) => { setValue(f.key, e.target.value || undefined); setValue(subKey(f.key), undefined); }}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={`${inputClass}${errorBorder}`}
          >
            <option value="">{f.required ? 'Choose...' : '— None —'}</option>
            {f.options?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {/* 3. Dependent field: only for ranks that have tiers / divisions / stars */}
          {sub && (
            <div className="sm:w-40 shrink-0">
              <label htmlFor={subId} className="sr-only">{sub.label} for {chosen.label}</label>
              {sub.type === 'number' ? (
                <input
                  id={subId}
                  type="number"
                  inputMode="numeric"
                  min={sub.min}
                  max={sub.max}
                  placeholder={sub.label}
                  value={details[subKey(f.key)] === undefined ? '' : String(details[subKey(f.key)])}
                  onChange={(e) => setValue(subKey(f.key), e.target.value === '' ? undefined : Number(e.target.value))}
                  aria-invalid={!!error}
                  className={`${inputClass}${errorBorder}`}
                />
              ) : (
                <select
                  id={subId}
                  value={String(details[subKey(f.key)] ?? '')}
                  onChange={(e) => setValue(subKey(f.key), e.target.value || undefined)}
                  aria-invalid={!!error}
                  className={`${inputClass}${errorBorder}`}
                >
                  <option value="">{sub.label}...</option>
                  {sub.options?.map((o) => <option key={o.id} value={o.id}>{sub.label} {o.label}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
        {help}
        {errorText}
      </div>
    );
  }

  if (f.type === 'multiselect') {
    const picked = Array.isArray(value) ? value : [];
    const max = f.max ?? 99;
    const remaining = (f.options ?? []).filter((o) => !picked.includes(o.id));
    return (
      <div className={`space-y-1.5 min-w-0 ${wide ? '@3xl:col-span-2' : ''}`}>
        {label}
        {picked.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={`Chosen ${f.label.toLowerCase()}`}>
            {picked.map((pid) => {
              const name = optionOf(f, pid)?.label ?? pid;
              return (
                <li key={pid} className="inline-flex items-center gap-1 rounded-full border border-gold/70 bg-gold/15 pl-3 pr-1 py-0.5 text-xs font-bold text-stone-950">
                  {name}
                  <button
                    type="button"
                    onClick={() => setValue(f.key, picked.filter((x) => x !== pid))}
                    aria-label={`Remove ${name}`}
                    className="rounded-full p-0.5 hover:bg-gold/30 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <select
          id={id}
          value=""
          disabled={picked.length >= max}
          onChange={(e) => e.target.value && setValue(f.key, [...picked, e.target.value])}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${inputClass}${errorBorder} disabled:opacity-60`}
        >
          <option value="">{picked.length >= max ? `Maximum of ${max} chosen` : `Add (${picked.length}/${max})...`}</option>
          {remaining.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {help}
        {errorText}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 min-w-0">
      {label}
      <input
        id={id}
        type={f.type === 'number' ? 'number' : 'text'}
        inputMode={f.type === 'number' || /\[0-9\]/.test(f.pattern ?? '') ? 'numeric' : undefined}
        maxLength={f.type === 'text' ? f.max_length ?? 60 : undefined}
        min={f.min}
        max={f.type === 'number' ? f.max : undefined}
        value={value === undefined ? '' : String(value)}
        onChange={(e) =>
          setValue(f.key, f.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)
        }
        aria-invalid={!!error}
        aria-describedby={describedBy}
        autoComplete="off"
        className={`${inputClass}${errorBorder}`}
      />
      {help}
      {errorText}
    </div>
  );
}
