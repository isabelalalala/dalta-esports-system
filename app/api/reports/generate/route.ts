import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import type { Database, Json } from '@/utils/database.types';
import { can } from '@/utils/permissions';
import { getErrorMessage } from '@/utils/errors';
import { writeReportInsights } from '@/utils/gemini';
import {
  describeFilters, fetchFullReport, isDataSource, validateFilters,
  type ReportFilters, type SavedReport,
} from '@/utils/reports';
import {
  acceptDraft, buildInsightRequest, rulesInsights, type InsightRequest, type ReportInsights,
} from '@/utils/report-insights';

// The report functions plus one Gemini call (up to 15 s)
export const maxDuration = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/reports/generate { tournamentId, gameId, from, to, source } -> { id }
// Admin only. Runs every report function with the admin's own session (each one checks the role
// again), computes the statistics behind the written interpretations, lets Gemini reword them
// (numbers checked; computed sentences when Gemini is unavailable) and saves the report.
// Saving goes through RLS ("Admins save reports") and is written to the activity log by a trigger.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  const { data: role } = await supabase.rpc('get_my_role');
  if (!can(role, 'report.generate')) {
    return NextResponse.json({ error: 'Only administrators can generate reports.' }, { status: 403 });
  }

  // Filters: '' = all
  const body = await request.json().catch(() => null);
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const filters: ReportFilters = {
    tournamentId: text(body?.tournamentId),
    gameId: text(body?.gameId),
    from: text(body?.from),
    to: text(body?.to),
    source: isDataSource(body?.source) ? body.source : 'all',
  };
  if ((filters.tournamentId && !UUID.test(filters.tournamentId)) ||
      (filters.gameId && filters.gameId.length > 40) ||
      (filters.from && !DATE.test(filters.from)) || (filters.to && !DATE.test(filters.to))) {
    return NextResponse.json({ error: 'The report filters are not valid.' }, { status: 400 });
  }
  const filterError = validateFilters(filters);
  if (filterError) return NextResponse.json({ error: filterError }, { status: 400 });

  try {
    const [data, names] = await Promise.all([fetchFullReport(supabase, filters), filterNames(supabase, filters)]);
    const request = buildInsightRequest(data, filters.source, describeFilters(names));
    const insights = await writeInsights(supabase, request);

    const { data: saved, error } = await supabase
      .from('analytics_reports')
      // Saved as jsonb exactly as the report functions returned it, plus the written text
      .insert([{ filters: names as NonNullable<Json>, data: { ...data, insights } as unknown as NonNullable<Json>, generated_by: user.id }])
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ id: saved.id });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err, 'The report could not be generated.') }, { status: 500 });
  }
}

// Readable filter names, saved with the report (ids would mean nothing once something is deleted)
async function filterNames(supabase: SupabaseClient<Database>, f: ReportFilters): Promise<SavedReport['filters']> {
  const [tournament, game] = await Promise.all([
    f.tournamentId ? supabase.from('tournaments').select('name').eq('id', f.tournamentId).maybeSingle() : null,
    f.gameId ? supabase.from('games').select('name').eq('id', f.gameId).maybeSingle() : null,
  ]);
  return {
    tournament: tournament?.data?.name ?? undefined,
    game: game?.data?.name ?? undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    source: f.source,
  };
}

// Gemini rewords the computed facts. It goes through the same app-wide rate limit as moderation
// (claim_gemini_call, admins have no per-user limit). Any problem -> the computed sentences.
async function writeInsights(supabase: SupabaseClient<Database>, request: InsightRequest): Promise<ReportInsights> {
  if (request.charts.length === 0) return rulesInsights(request);
  if (!process.env.GEMINI_API_KEY) {
    return rulesInsights(request, 'GEMINI_API_KEY is not set, so the computed sentences are shown.');
  }
  const serverKey = process.env.FEEDBACK_SERVER_KEY;
  if (!serverKey) {
    return rulesInsights(request, 'FEEDBACK_SERVER_KEY is not set (needed for the Gemini rate limit), so the computed sentences are shown.');
  }
  const { data: limitReason, error } = await supabase.rpc('claim_gemini_call', { p_key: serverKey, p_items: 1 });
  if (error || limitReason) {
    if (error) console.error('Report insights: claim_gemini_call failed', error);
    return rulesInsights(request, `AI wording skipped (${error ? 'the AI limit could not be checked' : limitReason}); the computed sentences are shown.`);
  }
  try {
    return acceptDraft(await writeReportInsights(request), request);
  } catch (err) {
    // The details stay in the server log; the saved report only says that the AI wording failed
    console.error('Report insights: Gemini failed', err);
    return rulesInsights(request, 'AI wording unavailable right now; the computed sentences are shown.');
  }
}
