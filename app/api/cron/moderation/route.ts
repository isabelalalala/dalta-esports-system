import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/utils/database.types';
import { runModerationBatch } from '@/utils/moderation';

// Gemini can take up to 15 s (twice when its answer has to be asked again)
export const maxDuration = 40;

// GET /api/cron/moderation: Vercel Cron (vercel.json) retries the next batch of comments and
// feedback still "pending analysis", so they don't wait for the next post or a moderator's
// "Retry" click. Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else gets 401.
// No user session: the batch works through the server key (202611091300_cron_moderation).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await runModerationBatch(supabase);
  // Counts only; the items themselves never leave the database
  return NextResponse.json({ analyzed: result.analyzed.size, reason: result.pendingReason ?? null });
}
