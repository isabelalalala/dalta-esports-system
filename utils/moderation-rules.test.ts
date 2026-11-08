import { describe, expect, it } from 'vitest';
import { parseAnalysis } from '@/utils/moderation-rules';

const ok = {
  id: 'a', sentiment: 'negative', score: -0.6, is_profane: true, is_offensive: false,
  offense_type: 'none', reason: 'Swearing about the stream.', topics: ['Stream Quality'],
};

describe('parseAnalysis', () => {
  it('accepts a valid answer and cleans it', () => {
    expect(parseAnalysis(JSON.stringify([ok]), ['a'])).toEqual([
      { ...ok, topics: ['stream quality'] },
    ]);
  });

  it('throws when the answer is not a JSON array (the caller retries once)', () => {
    expect(() => parseAnalysis('not json', ['a'])).toThrow('valid JSON');
    expect(() => parseAnalysis('{"id":"a"}', ['a'])).toThrow('unexpected');
  });

  it('drops items with missing or wrong fields, unknown ids and duplicates', () => {
    const answer = [
      { ...ok, id: 'x' },                       // not sent
      { ...ok, sentiment: 'angry' },             // bad sentiment
      { ...ok, id: 'b', is_profane: 'yes' },     // bad type
      { ...ok, id: 'c', offense_type: 'rude' },  // unknown offense type
      ok, { ...ok, score: 1 },                   // duplicate id: first one wins
    ];
    expect(parseAnalysis(JSON.stringify(answer), ['a', 'b', 'c']).map((r) => r.id)).toEqual(['a']);
  });

  it('keeps offensive and offense_type consistent', () => {
    const typeOnly = parseAnalysis(JSON.stringify([{ ...ok, offense_type: 'threat', is_offensive: false }]), ['a'])[0];
    expect(typeOnly.is_offensive).toBe(true);
    expect(typeOnly.offense_type).toBe('threat');
    const flagOnly = parseAnalysis(JSON.stringify([{ ...ok, is_offensive: true, offense_type: 'none' }]), ['a'])[0];
    expect(flagOnly.offense_type).toBe('harassment');
  });

  it('clamps the score and limits topics and reason', () => {
    const r = parseAnalysis(JSON.stringify([{ ...ok, score: -7, topics: ['a', 'b', 'c', 'd'], reason: 'x'.repeat(500) }]), ['a'])[0];
    expect(r.score).toBe(-1);
    expect(r.topics).toHaveLength(3);
    expect(r.reason).toHaveLength(300);
  });
});
