import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { analyzeFeedback } from '@/utils/feedback-analysis';

// How many comments go to Gemini in one request
const BATCH_SIZE = 20;

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
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can classify feedback.' }, { status: 403 });
  }

  // Oldest pending feedback first (RLS: admins read all feedback)
  const { data: pending, error: pendingError } = await supabase
    .from('feedback')
    .select('id, rating, comment')
    .is('sentiment', null)
    .order('created_at')
    .limit(BATCH_SIZE);
  if (pendingError) {
    return NextResponse.json({ error: 'Could not load the pending feedback. Please try again.' }, { status: 500 });
  }

  const result = await analyzeFeedback(supabase, pending ?? []);

  const { count: remaining } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .is('sentiment', null);

  return NextResponse.json({
    classified: result.classified,
    remaining: remaining ?? 0,
    // Shown to the admin when nothing (or not everything) could be classified
    reason: result.pendingReason,
  });
}
