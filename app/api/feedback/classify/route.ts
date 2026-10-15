import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { classifyFeedback } from '@/utils/gemini';

// How many comments go to Gemini in one request
const BATCH_SIZE = 20;

// "Classify sentiment" (use case, Organizing Committee).
// Sends unclassified feedback to Gemini and saves the results AS THE LOGGED-IN ORGANIZER,
// so the feedback RLS (only admins may write sentiment) still applies. No service role key.
export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  }

  const { data: role } = await supabase.rpc('get_my_role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can classify feedback.' }, { status: 403 });
  }

  // Oldest unclassified feedback first
  const { data: pending, error: pendingError } = await supabase
    .from('feedback')
    .select('id, rating, comment')
    .is('sentiment', null)
    .order('created_at')
    .limit(BATCH_SIZE);
  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return NextResponse.json({ classified: 0, remaining: 0 });
  }

  let results;
  try {
    results = await classifyFeedback(pending);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Classification failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Save each result. "sentiment is null" avoids overwriting a result saved at the same time by someone else.
  let classified = 0;
  const classifiedAt = new Date().toISOString();
  for (const r of results) {
    const { data, error } = await supabase
      .from('feedback')
      .update({ sentiment: r.sentiment, sentiment_score: r.score, topics: r.topics, classified_at: classifiedAt })
      .eq('id', r.id)
      .is('sentiment', null)
      .select('id');
    if (!error && data && data.length > 0) classified++;
  }

  const { count: remaining } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .is('sentiment', null);

  return NextResponse.json({ classified, remaining: remaining ?? 0 });
}
