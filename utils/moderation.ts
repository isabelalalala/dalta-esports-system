// Analyses waiting comments and feedback with Gemini and saves the result (sentiment + moderation),
// or leaves them "pending analysis". SERVER ONLY (route handlers): uses GEMINI_API_KEY and
// FEEDBACK_SERVER_KEY.
//
// One batch = up to 20 items, oldest first (the item just posted first), in ONE Gemini request:
// 1. claim_moderation_batch(): which items are waiting
// 2. claim_gemini_call(): the database rate limit (per minute, per day, per user)
// 3. Gemini (analyzeTexts)
// 4. save_moderation_result() for each result: it also hides offensive items, gives warnings and
//    flags accounts at 5 warnings (see 202611081500_comments_moderation.sql)
// Anything that fails -> mark_moderation_pending() with the reason. Because every new comment or
// feedback runs a batch, older pending items are retried automatically; admins can also press
// "Retry pending analysis" on the moderation page.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/utils/database.types';
import { analyzeTexts } from '@/utils/gemini';
import type { ItemKind, TextToAnalyze } from '@/utils/moderation-rules';

export interface BatchResult {
  // "comment:<id>" / "feedback:<id>" of every item that was analysed
  analyzed: Set<string>;
  // Why some or all items are still pending (null = everything was analysed, or nothing waited)
  pendingReason: string | null;
}

const key = (kind: ItemKind, id: string) => `${kind}:${id}`;

export async function runModerationBatch(
  supabase: SupabaseClient<Database>,
  first?: { kind: ItemKind; id: string },
): Promise<BatchResult> {
  const analyzed = new Set<string>();
  const serverKey = process.env.FEEDBACK_SERVER_KEY;
  if (!serverKey) {
    // Without the key nothing can be read or saved; items simply stay pending.
    return { analyzed, pendingReason: 'FEEDBACK_SERVER_KEY is not set on the server.' };
  }

  // 1. What is waiting
  const { data: rows, error: batchError } = await supabase.rpc('claim_moderation_batch', {
    p_key: serverKey,
    p_limit: 20,
    p_first_kind: first?.kind,
    p_first_id: first?.id,
  });
  if (batchError) return { analyzed, pendingReason: batchError.message };
  const items: TextToAnalyze[] = (rows ?? []).map((r) => ({
    id: r.id, kind: r.kind as ItemKind, text: r.content, rating: r.rating,
  }));
  if (items.length === 0) return { analyzed, pendingReason: null };

  const markPending = async (list: TextToAnalyze[], reason: string, countAttempt: boolean) => {
    for (const kind of ['comment', 'feedback'] as const) {
      const ids = list.filter((i) => i.kind === kind).map((i) => i.id);
      if (ids.length > 0) {
        await supabase.rpc('mark_moderation_pending', {
          p_key: serverKey, p_kind: kind, p_ids: ids, p_reason: reason, p_count_attempt: countAttempt,
        });
      }
    }
  };

  // 2. Rate limit. Being rate-limited isn't the items' fault: it doesn't count as an attempt.
  const { data: limitReason, error: claimError } = await supabase.rpc('claim_gemini_call', {
    p_key: serverKey,
    p_items: items.length,
  });
  if (claimError || limitReason) {
    const reason = claimError?.message ?? (limitReason as string);
    await markPending(items, reason, false);
    return { analyzed, pendingReason: reason };
  }

  // 3. Gemini
  let results;
  try {
    results = await analyzeTexts(items);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Analysis failed.';
    await markPending(items, reason, true);
    return { analyzed, pendingReason: reason };
  }

  // 4. Save each result (the database applies the moderation policy)
  const kindOf = new Map(items.map((i) => [i.id, i.kind]));
  for (const r of results) {
    const kind = kindOf.get(r.id);
    if (!kind) continue;
    const { data, error } = await supabase.rpc('save_moderation_result', {
      p_key: serverKey,
      p_kind: kind,
      p_id: r.id,
      p_sentiment: r.sentiment,
      p_score: r.score,
      p_topics: r.topics,
      p_is_profane: r.is_profane,
      p_is_offensive: r.is_offensive,
      p_offense_type: r.offense_type,
      p_reason: r.reason,
    });
    if (!error && data === true) analyzed.add(key(kind, r.id));
  }

  // Gemini skipped some items (or saving failed): keep them pending with a reason
  const missing = items.filter((i) => !analyzed.has(key(i.kind, i.id)));
  if (missing.length > 0) {
    const returned = new Set(results.map((r) => r.id));
    const reason = missing.every((i) => !returned.has(i.id))
      ? 'Gemini returned no result for this item.'
      : 'The analysis could not be saved. It will be retried.';
    await markPending(missing, reason, true);
    return { analyzed, pendingReason: reason };
  }
  return { analyzed, pendingReason: null };
}

export function wasAnalyzed(result: BatchResult, kind: ItemKind, id: string) {
  return result.analyzed.has(key(kind, id));
}
