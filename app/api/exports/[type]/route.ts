import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage } from '@/utils/errors';
import { buildExport, EXPORT_ROLES, isExportType, toCsv, toXlsx } from '@/utils/exports';

// GET /api/exports/<type>?format=xlsx|csv&tournament=<id>&game=<id>
// Builds the file on the server with the logged-in user's own session (RLS applies),
// after checking the role, and logs the export before sending it.
export async function GET(request: NextRequest, ctx: RouteContext<'/api/exports/[type]'>) {
  const { type } = await ctx.params;
  if (!isExportType(type)) {
    return NextResponse.json({ error: 'Unknown export.' }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const format = params.get('format') === 'csv' ? 'csv' : 'xlsx';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  }
  const { data: role } = await supabase.rpc('get_my_role');
  if (!EXPORT_ROLES[type].includes(role ?? '')) {
    return NextResponse.json({ error: 'You are not allowed to download this.' }, { status: 403 });
  }

  let table;
  try {
    table = await buildExport(type, supabase, {
      tournamentId: params.get('tournament'),
      gameId: params.get('game'),
    });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err, 'The export failed.') }, { status: 400 });
  }

  // Every export is logged; no log, no file
  const { error: logError } = await supabase.rpc('log_export', {
    p_type: type,
    p_details: {
      format,
      rows: table.rows.length,
      tournament_name: table.tournamentName ?? null,
      tournament_id: table.tournamentId ?? null,
      filter: table.filter ?? null,
    },
  });
  if (logError) {
    return NextResponse.json({ error: getErrorMessage(logError, 'The export could not be logged.') }, { status: 500 });
  }

  const fileName = `${table.fileBase}.${format}`;
  const headers = {
    'Content-Disposition': `attachment; filename="${fileName}"`,
    // Personal data: never keep a copy in a browser or proxy cache
    'Cache-Control': 'no-store',
  };

  if (format === 'csv') {
    return new NextResponse(toCsv(table), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } });
  }
  const file = await toXlsx(table);
  return new NextResponse(file as BodyInit, {
    headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
}
