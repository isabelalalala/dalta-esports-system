// Game-specific profile fields (202611091400_game_profile_schemas). Each game's form lives in
// games.profile_schema; a player's values in player_game_profiles.details. The database trigger
// check_game_profile() is the real check; validateGameProfile() applies the SAME rules in the
// browser so the form can show errors next to the fields before saving.

export type FieldType = 'text' | 'number' | 'select' | 'multiselect';

export interface GameOption {
  id: string; // never changes (saved profiles store it)
  label: string; // can be renamed by an admin
  sub?: SubField; // e.g. Tier 1-3 for "Gold"; none for "Radiant"
}

export interface SubField {
  label: string;
  type: 'select' | 'number';
  options?: { id: string; label: string }[];
  min?: number;
  max?: number;
  suffix?: string; // shown after a number, e.g. "★"
}

export interface GameProfileField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: GameOption[];
  max?: number; // multiselect: most picks; number: highest value
  min?: number;
  max_length?: number;
  pattern?: string;
  pattern_hint?: string;
  help?: string;
  maps_to?: 'ign' | 'rank' | 'role';
}

export interface GameProfileSchema {
  fields: GameProfileField[];
}

export type DetailValue = string | number | string[];
export type GameProfileDetails = Record<string, DetailValue>;

export const DEFAULT_TEXT_MAX = 60;
export const subKey = (key: string) => `${key}_sub`;

// Reads games.profile_schema safely (anything malformed = no fields)
export function parseSchema(value: unknown): GameProfileSchema {
  const fields = (value as GameProfileSchema | null)?.fields;
  return { fields: Array.isArray(fields) ? fields : [] };
}

export function fieldFor(schema: GameProfileSchema, mapsTo: 'ign' | 'rank' | 'role') {
  return schema.fields.find((f) => f.maps_to === mapsTo) ?? null;
}

export function optionOf(field: GameProfileField | null | undefined, id: unknown): GameOption | null;
export function optionOf(field: SubField | null | undefined, id: unknown): { id: string; label: string } | null;
export function optionOf(field: GameProfileField | SubField | null | undefined, id: unknown) {
  return field?.options?.find((o) => o.id === id) ?? null;
}

// Reads player_game_profiles.details safely (anything malformed = no values)
export function parseDetails(value: unknown): GameProfileDetails {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as GameProfileDetails) : {};
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

// "Gold 2", "Mythic 25★", "Radiant" (null when nothing or an unknown option is chosen)
export function selectLabel(field: GameProfileField | null, details: GameProfileDetails): string | null {
  if (!field) return null;
  const opt = optionOf(field, details[field.key]);
  if (!opt) return null;
  const sub = opt.sub;
  const subValue = details[subKey(field.key)];
  if (!sub || isEmpty(subValue)) return opt.label;
  if (sub.type === 'number') return `${opt.label} ${subValue}${sub.suffix ?? ''}`;
  const subOpt = optionOf(sub, subValue);
  return subOpt ? `${opt.label} ${subOpt.label}` : opt.label;
}

export interface ValidationResult {
  errors: Record<string, string>; // by field key (sub errors use the parent's key)
  clean: GameProfileDetails; // trimmed values, only valid keys, sub values only where they belong
}

// Same rules as check_game_profile() in the database
export function validateGameProfile(schema: GameProfileSchema, details: GameProfileDetails): ValidationResult {
  const errors: Record<string, string> = {};
  const clean: GameProfileDetails = {};

  for (const f of schema.fields) {
    const v = details[f.key];
    if (isEmpty(v)) {
      if (f.required) errors[f.key] = `${f.label} is required.`;
      continue;
    }

    if (f.type === 'text') {
      const s = String(v).trim();
      const max = f.max_length ?? DEFAULT_TEXT_MAX;
      if (s.length > max) errors[f.key] = `${f.label} is too long (at most ${max} characters).`;
      else if (f.pattern && !new RegExp(f.pattern).test(s)) errors[f.key] = f.pattern_hint ?? 'The format is not valid.';
      else clean[f.key] = s;
    } else if (f.type === 'number') {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isInteger(n)) errors[f.key] = `${f.label} must be a whole number.`;
      else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
        errors[f.key] = `${f.label} must be between ${f.min ?? 0} and ${f.max ?? 'any'}.`;
      } else clean[f.key] = n;
    } else if (f.type === 'select') {
      const opt = optionOf(f, v);
      if (!opt) {
        errors[f.key] = `Choose a ${f.label.toLowerCase()} from the list.`;
        continue;
      }
      clean[f.key] = opt.id;
      if (opt.sub) {
        const sv = details[subKey(f.key)];
        if (isEmpty(sv)) {
          errors[f.key] = `Choose a ${opt.sub.label.toLowerCase()} for ${opt.label}.`;
        } else if (opt.sub.type === 'number') {
          const n = typeof sv === 'number' ? sv : Number(sv);
          if (!Number.isInteger(n) || (opt.sub.min !== undefined && n < opt.sub.min) || (opt.sub.max !== undefined && n > opt.sub.max)) {
            errors[f.key] = `${opt.sub.label} must be a whole number between ${opt.sub.min ?? 0} and ${opt.sub.max ?? 'any'}.`;
          } else clean[subKey(f.key)] = n;
        } else if (!optionOf(opt.sub, sv)) {
          errors[f.key] = `Choose a valid ${opt.sub.label.toLowerCase()} for ${opt.label}.`;
        } else clean[subKey(f.key)] = String(sv);
      }
    } else if (f.type === 'multiselect') {
      const list = Array.isArray(v) ? v : [];
      const unique = [...new Set(list)];
      if (unique.length !== list.length) errors[f.key] = `${f.label} lists the same option twice.`;
      else if (list.some((id) => !optionOf(f, id))) errors[f.key] = `${f.label} has an option that is not in the list.`;
      else if (list.length > (f.max ?? 99)) errors[f.key] = `Choose at most ${f.max} for ${f.label}.`;
      else clean[f.key] = list;
    }
  }
  return { errors, clean };
}

// Rank badge color by how high the rank sits in its list (1 = lowest). Theme tokens only;
// neutral -> gold -> maroon, no meaning colors (red/green/yellow mean errors/success/pending).
export function rankTone(position: number | null | undefined, count: number | null | undefined) {
  if (!position || !count) return 'border-stone-300 bg-stone-100 text-stone-700';
  const share = position / count;
  if (share <= 0.34) return 'border-stone-300 bg-stone-100 text-stone-800';
  if (share <= 0.67) return 'border-gold/70 bg-gold/15 text-stone-950';
  if (share < 1) return 'border-gold bg-gold text-stone-950';
  return 'border-maroon bg-maroon text-white';
}

// Readable name of a multiselect's picks, e.g. "Jett, Reyna"
export function multiLabels(field: GameProfileField, value: DetailValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((id) => optionOf(field, id)?.label).filter((l): l is string => !!l);
}

// A short id for a new option from its name ("Bot (ADC)" -> "bot-adc"), unique within the list
export function optionIdFrom(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/&/g, 'and').replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'option';
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}
