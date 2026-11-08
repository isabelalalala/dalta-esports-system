import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { can } from '@/utils/permissions';
import { runModerationBatch } from '@/utils/moderation';
import { MAX_FEEDBACK_ANALYSIS_ATTEMPTS } from '@/utils/feedback';

// Gemini can take up to 15 s (twice when its answer has to be asked again)
export const maxDuration = 40;

// POST /api/moderation/retry: "Retry pending analysis" (moderation page, feedback page).
// Analyses the next batch of waiting comments and feedback (oldest first). New posts already
// retry older items automatically; this is for when the site is quiet.
// Moderators (admin, staff). The batch reads and saves through the server key, so nothing about
// the items is returned to the caller beyond counts.
export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  }
  const { data: role } = await supabase.rpc('get_my_role');
  if (!can(role, 'moderation.review')) {
    return NextResponse.json({ error: 'Only moderators can retry the analysis.' }, { status: 403 });
  }

  const result = await runModerationBatch(supabase);
  return NextResponse.json({
    analyzed: result.analyzed.size,
    remaining: await countPending(supabase),
    reason: result.pendingReason,
  });
}

// Items still waiting (feedback counts only for admins, who may read feedback)
async function countPending(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [comments, feedback] = await Promise.all([
    supabase.from('stream_comments').select('id', { count: 'exact', head: true })
      .eq('moderation_status', 'pending').lt('analysis_attempts', MAX_FEEDBACK_ANALYSIS_ATTEMPTS),
    supabase.from('feedback').select('id', { count: 'exact', head: true })
      .is('sentiment', null).lt('analysis_attempts', MAX_FEEDBACK_ANALYSIS_ATTEMPTS),
  ]);
  return (comments.count ?? 0) + (feedback.count ?? 0);
}
