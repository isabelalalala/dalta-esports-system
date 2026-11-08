import { NextResponse, after } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage } from '@/utils/errors';
import { runModerationBatch } from '@/utils/moderation';

// The analysis runs after the response (after()), up to Gemini's 15 s timeout, twice at most
export const maxDuration = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/comments  { stream_id, content }  ->  { id }
// "Comment on a stream" (Phase 4). The comment is saved AS THE LOGGED-IN USER, so RLS and the
// database rules apply (not flagged/banned, 300 characters, one per 3 seconds). It shows up for
// everyone right away; the AI analysis runs after the response, so posting feels instant, and then
// approves the comment or hides it (viewers' panels reload through Realtime).
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in to comment.' }, { status: 401 });
  }

  let body: { stream_id?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const streamId = typeof body.stream_id === 'string' && UUID.test(body.stream_id) ? body.stream_id : null;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!streamId) {
    return NextResponse.json({ error: 'Unknown stream.' }, { status: 400 });
  }
  if (content.length < 1 || content.length > 300) {
    return NextResponse.json({ error: 'Comments are 1 to 300 characters.' }, { status: 400 });
  }

  // A clear message for flagged/banned accounts (RLS refuses the insert anyway)
  const { data: allowed } = await supabase.rpc('can_post');
  if (allowed === false) {
    return NextResponse.json(
      { error: "Your account is flagged or banned, so you can't comment right now." },
      { status: 403 },
    );
  }

  const { data: saved, error } = await supabase
    .from('stream_comments')
    .insert({ stream_id: streamId, user_id: user.id, content })
    .select('id')
    .single();
  if (error || !saved) {
    // Our trigger messages (e.g. "Slow down: ...") are kept; raw database errors become sentences
    const status = error?.message?.startsWith('Slow down') ? 429 : 400;
    return NextResponse.json({ error: getErrorMessage(error, 'Your comment could not be posted.') }, { status });
  }

  // Moderation after the response: this comment first, plus older items still waiting
  after(async () => {
    await runModerationBatch(supabase, { kind: 'comment', id: saved.id });
  });

  return NextResponse.json({ id: saved.id });
}
