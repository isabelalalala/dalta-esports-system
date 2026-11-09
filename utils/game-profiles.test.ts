import { describe, expect, it } from 'vitest';
import {
  optionIdFrom, parseSchema, rankTone, selectLabel, validateGameProfile, type GameProfileSchema,
} from './game-profiles';

// A small Valorant-like schema (the real ones are seeded in 202611091400_game_profile_schemas)
const valorant: GameProfileSchema = {
  fields: [
    { key: 'riot_id', label: 'Riot ID', type: 'text', required: true, maps_to: 'ign', max_length: 22,
      pattern: '^[^#]{3,16}#[A-Za-z0-9]{3,5}$', pattern_hint: 'Use the format Name#TAG' },
    { key: 'rank', label: 'Rank', type: 'select', maps_to: 'rank', options: [
      { id: 'gold', label: 'Gold', sub: { label: 'Tier', type: 'select', options: [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }] } },
      { id: 'radiant', label: 'Radiant' },
    ] },
    { key: 'agents', label: 'Main agents', type: 'multiselect', max: 2, options: [
      { id: 'jett', label: 'Jett' }, { id: 'sage', label: 'Sage' }, { id: 'omen', label: 'Omen' },
    ] },
  ],
};
const mlbbStars: GameProfileSchema = {
  fields: [
    { key: 'ign', label: 'IGN', type: 'text', required: true, maps_to: 'ign' },
    { key: 'rank', label: 'Rank', type: 'select', maps_to: 'rank', options: [
      { id: 'mythic', label: 'Mythic', sub: { label: 'Stars', type: 'number', min: 0, max: 9999, suffix: '★' } },
    ] },
  ],
};

describe('validateGameProfile', () => {
  it('accepts a valid profile and cleans it', () => {
    const { errors, clean } = validateGameProfile(valorant, {
      riot_id: '  Jett#PH1 ', rank: 'gold', rank_sub: '2', agents: ['jett'],
    });
    expect(errors).toEqual({});
    expect(clean).toEqual({ riot_id: 'Jett#PH1', rank: 'gold', rank_sub: '2', agents: ['jett'] });
  });

  it('drops the tier for a rank that has none (Radiant)', () => {
    const { errors, clean } = validateGameProfile(valorant, { riot_id: 'Jett#PH1', rank: 'radiant', rank_sub: '3' });
    expect(errors).toEqual({});
    expect(clean).toEqual({ riot_id: 'Jett#PH1', rank: 'radiant' });
  });

  it('explains every kind of mistake', () => {
    expect(validateGameProfile(valorant, {}).errors.riot_id).toMatch(/required/);
    expect(validateGameProfile(valorant, { riot_id: 'NoTag' }).errors.riot_id).toMatch(/Name#TAG/);
    expect(validateGameProfile(valorant, { riot_id: 'a#b1c', rank: 'gold' }).errors.rank).toMatch(/tier/);
    expect(validateGameProfile(valorant, { riot_id: 'abc#123', rank: 'mythic' }).errors.rank).toMatch(/from the list/);
    expect(validateGameProfile(valorant, { riot_id: 'abc#123', agents: ['jett', 'sage', 'omen'] }).errors.agents).toMatch(/at most 2/);
    expect(validateGameProfile(valorant, { riot_id: 'abc#123', agents: ['jett', 'jett'] }).errors.agents).toMatch(/twice/);
    expect(validateGameProfile(mlbbStars, { ign: 'x', rank: 'mythic', rank_sub: -2 }).errors.rank).toMatch(/between 0 and 9999/);
  });
});

describe('selectLabel', () => {
  it('joins the rank and its tier or stars', () => {
    expect(selectLabel(valorant.fields[1], { rank: 'gold', rank_sub: '3' })).toBe('Gold 3');
    expect(selectLabel(valorant.fields[1], { rank: 'radiant' })).toBe('Radiant');
    expect(selectLabel(mlbbStars.fields[1], { rank: 'mythic', rank_sub: 25 })).toBe('Mythic 25★');
    expect(selectLabel(valorant.fields[1], { rank: 'removed-option' })).toBeNull();
  });
});

describe('helpers', () => {
  it('reads a malformed schema as empty', () => {
    expect(parseSchema(null).fields).toEqual([]);
    expect(parseSchema({ fields: 'nope' }).fields).toEqual([]);
  });
  it('colors ranks from neutral to maroon by position', () => {
    expect(rankTone(1, 9)).toContain('stone');
    expect(rankTone(5, 9)).toContain('gold/15');
    expect(rankTone(9, 9)).toContain('bg-maroon');
    expect(rankTone(null, 9)).toContain('stone');
  });
  it('makes unique option ids from names', () => {
    expect(optionIdFrom('Bot (ADC)', [])).toBe('bot-adc');
    expect(optionIdFrom("Chang'e", [])).toBe('change');
    expect(optionIdFrom('Jett', ['jett'])).toBe('jett-2');
  });
});
