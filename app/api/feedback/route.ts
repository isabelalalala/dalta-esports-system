import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { analyzeFeedback } from '@/utils/feedback-analysis';
import { getErrorMessage } from '@/utils/errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Submit feedback & ratings" (use case, Audience / Players), which includes
// "classify sentiment" (Gemini). DFD 5.0: Feedback and Rating -> Feedback Confirmation.
// The feedback is saved AS THE LOGGED-IN USER (RLS + the one-per-target index apply),
// then classified right away. If Gemini fails or a limit is reached, the feedback is still
// saved and stays "pending analysis" for an admin to retry.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in to send feedback.' }, { status: 401 });
  }

  let body: { tournament_id?: unknown; match_id?: unknown; rating?: unknown; comment?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const rating = Number(body.rating);
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const tournamentId = typeof body.tournament_id === 'string' && UUID.test(body.tournament_id) ? body.tournament_id : null;
  const matchId = typeof body.match_id === 'string' && UUID.test(body.match_id) ? body.match_id : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Please choose a rating from 1 to 5 stars.' }, { status: 400 });
  }
  if (comment.length < 3 || comment.length > 1000) {
    return NextResponse.json({ error: 'Please write a comment of 3 to 1000 characters.' }, { status: 400 });
  }

  // The database fills in the match's tournament and refuses a second feedback for the same thing
  const { data: saved, error: insertError } = await supabase
    .from('feedback')
    .insert({ user_id: user.id, tournament_id: tournamentId, match_id: matchId, rating, comment })
    .select('id, rating, comment')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const what = matchId ? 'this match' : tournamentId ? 'this tournament' : 'the event in general';
      return NextResponse.json({ error: `You already sent feedback about ${what}. Thank you!` }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(insertError, 'Your feedback could not be saved.') }, { status: 400 });
  }

  // The person gets the same confirmation either way; organizers see pending ones on /admin/feedback.
  const analysis = await analyzeFeedback(supabase, [saved]);
  return NextResponse.json({ id: saved.id, analyzed: analysis.classified > 0 });
}
