// Shared moderation types and the strict check of Gemini's answer (utils/gemini.ts).
// No server-only code here, so it can be unit tested and used by the pages for labels.

export type ItemKind = 'comment' | 'feedback';
export type OffenseType = 'none' | 'bullying' | 'harassment' | 'hate_speech' | 'threat' | 'sexual';
export type ModerationStatus = 'pending' | 'approved' | 'hidden' | 'restored' | 'removed';

export interface TextToAnalyze {
  id: string;
  kind: ItemKind;
  text: string;
  // Feedback only (1-5)
  rating?: number | null;
}

export interface TextAnalysis {
  id: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  is_profane: boolean;
  is_offensive: boolean;
  offense_type: OffenseType;
  reason: string;
  topics: string[];
}

const OFFENSE_TYPES: OffenseType[] = ['none', 'bullying', 'harassment', 'hate_speech', 'threat', 'sexual'];

export const offenseLabels: Record<OffenseType, string> = {
  none: 'None',
  bullying: 'Bullying',
  harassment: 'Harassment',
  hate_speech: 'Hate speech',
  threat: 'Threat',
  sexual: 'Sexual content',
};

// Active warnings at which an account is flagged for a ban (same as check_ban_threshold())
export const WARNING_LIMIT = 5;

// Comments and feedback with these statuses are shown to everyone
export const VISIBLE_STATUSES: ModerationStatus[] = ['pending', 'approved', 'restored'];

// Parses Gemini's JSON strictly. Throws when the answer isn't a JSON array (the caller then asks
// once more). Items with missing or invalid fields, or ids we didn't send, are dropped: they stay
// "pending analysis" and are retried later. Values are clamped before they reach the database.
export function parseAnalysis(text: string, sentIds: string[]): TextAnalysis[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini did not return valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('Gemini returned an unexpected answer.');

  const wanted = new Set(sentIds);
  const seen = new Set<string>();
  const results: TextAnalysis[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    if (!wanted.has(id) || seen.has(id)) continue;
    if (r.sentiment !== 'positive' && r.sentiment !== 'neutral' && r.sentiment !== 'negative') continue;
    if (typeof r.score !== 'number' || Number.isNaN(r.score)) continue;
    if (typeof r.is_profane !== 'boolean' || typeof r.is_offensive !== 'boolean') continue;
    if (typeof r.offense_type !== 'string' || !OFFENSE_TYPES.includes(r.offense_type as OffenseType)) continue;

    // Keep the two offensive fields consistent: a type means offensive, offensive needs a type
    const isOffensive = r.is_offensive || r.offense_type !== 'none';
    let offenseType = r.offense_type as OffenseType;
    if (isOffensive && offenseType === 'none') offenseType = 'harassment';

    const topics = (Array.isArray(r.topics) ? r.topics : [])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase().slice(0, 40))
      .filter(Boolean)
      .slice(0, 3);

    seen.add(id);
    results.push({
      id,
      sentiment: r.sentiment,
      score: Math.round(Math.max(-1, Math.min(1, r.score)) * 100) / 100,
      is_profane: r.is_profane,
      is_offensive: isOffensive,
      offense_type: offenseType,
      reason: typeof r.reason === 'string' ? r.reason.trim().slice(0, 300) : '',
      topics,
    });
  }
  return results;
}
