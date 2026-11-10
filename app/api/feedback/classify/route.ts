import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { runModerationBatch } from '@/utils/moderation';
import { MAX_FEEDBACK_ANALYSIS_ATTEMPTS } from '@/utils/feedback';
import { can } from '@/utils/permissions';

// one batch waits up to 15 s for Gemini; an unparsable answer is asked once more (2 x 15 s), so 40 s like /api/comments. If the
// function is still stopped, the item is already saved and stays "pending analysis" for the cron retry.
export const maxDuration = 40;


// "Retry pending analysis" on /admin/feedback (use case "Classify sentiment", Organizing Committee).
// New feedback is classified when it's sent (/api/feedback); this retries the ones that stayed
// pending because Gemini failed or a limit was reached. Same rate limit and server key.
export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  }

  const { data: role, error: roleError } = await supabase.rpc('get_my_role');
  if (roleError) {
    return NextResponse.json({ error: 'Could not check your role. Please try again.' }, { status: 500 });
  }
  if (!can(role, 'feedback.viewAll')) {
    return NextResponse.json({ error: 'Only admins can classify feedback.' }, { status: 403 });
  }

  // Same pipeline as comments (utils/moderation.ts): the next batch of waiting items, oldest
  // first, feedback and comments together.
  const result = await runModerationBatch(supabase);

  const { count: remaining } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .is('sentiment', null)
    .lt('analysis_attempts', MAX_FEEDBACK_ANALYSIS_ATTEMPTS);

  return NextResponse.json({
    classified: result.analyzed.size,
    remaining: remaining ?? 0,
    // Shown to the admin when nothing (or not everything) could be classified
    reason: result.pendingReason,
  });
}
