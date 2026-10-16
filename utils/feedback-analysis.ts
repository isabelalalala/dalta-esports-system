// Classifies feedback with Gemini and saves the result, or leaves it "pending analysis".
// SERVER ONLY (route handlers): uses GEMINI_API_KEY and FEEDBACK_SERVER_KEY.
//
// Steps:
// 1. claim_gemini_call(): the database rate limit (per minute, per day, per user)
// 2. Gemini (one request for all items)
// 3. save_feedback_sentiment() for each result
// Anything that fails -> mark_feedback_pending() with the reason; an admin retries later.
// The database functions check FEEDBACK_SERVER_KEY against the key in Supabase Vault,
// so only this server can save sentiment (no service role key).
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyFeedback, type FeedbackToClassify } from '@/utils/gemini';

export interface AnalysisResult {
  classified: number;
  // Why some or all items are still pending (null = everything was classified)
  pendingReason: string | null;
}

export async function analyzeFeedback(
  supabase: SupabaseClient,
  items: FeedbackToClassify[]
): Promise<AnalysisResult> {
  if (items.length === 0) return { classified: 0, pendingReason: null };

  const key = process.env.FEEDBACK_SERVER_KEY;
  if (!key) {
    // Can't even record the reason without the key; the feedback simply stays pending.
    return { classified: 0, pendingReason: 'FEEDBACK_SERVER_KEY is not set on the server.' };
  }

  const ids = items.map((i) => i.id);
  const markPending = async (reason: string): Promise<AnalysisResult> => {
    await supabase.rpc('mark_feedback_pending', { p_key: key, p_feedback_ids: ids, p_reason: reason });
    return { classified: 0, pendingReason: reason };
  };

  // 1. Rate limit (returns a reason when a limit is reached)
  const { data: limitReason, error: claimError } = await supabase.rpc('claim_gemini_call', {
    p_key: key,
    p_items: items.length,
  });
  if (claimError) return { classified: 0, pendingReason: claimError.message };
  if (limitReason) return markPending(limitReason as string);

  // 2. Gemini
  let results;
  try {
    results = await classifyFeedback(items);
  } catch (err) {
    return markPending(err instanceof Error ? err.message : 'Classification failed.');
  }

  // 3. Save each result
  let classified = 0;
  const saved = new Set<string>();
  for (const r of results) {
    const { data, error } = await supabase.rpc('save_feedback_sentiment', {
      p_key: key,
      p_feedback_id: r.id,
      p_sentiment: r.sentiment,
      p_score: r.score,
      p_topics: r.topics,
    });
    if (!error && data === true) {
      classified++;
      saved.add(r.id);
    }
  }

  // Gemini skipped some items (or saving failed): keep them pending with a reason
  const missing = ids.filter((id) => !saved.has(id));
  if (missing.length > 0) {
    const reason = 'Gemini returned no result for this comment.';
    await supabase.rpc('mark_feedback_pending', { p_key: key, p_feedback_ids: missing, p_reason: reason });
    return { classified, pendingReason: reason };
  }
  return { classified, pendingReason: null };
}
