import { NextResponse, type NextRequest } from 'next/server';
import { createPublicClient } from '@/utils/supabase/public';
import { buildCalendar, calendarFileName, type CalendarMatch } from '@/utils/ics';

// GET /calendar/match/<id>, /calendar/tournament/<id>, /calendar/team/<id>
// "Add to calendar" (.ics) for one match, a whole tournament, or all of a team's matches.
// Public like the tournament pages: it only contains team names, rounds and times.
// Calendar apps can also subscribe to these URLs (webcal://) and keep them up to date.
export async function GET(_request: NextRequest, ctx: RouteContext<'/calendar/[kind]/[id]'>) {
  const { kind, id } = await ctx.params;
  if (!['match', 'tournament', 'team'].includes(kind) || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Calendar not found.' }, { status: 404 });
  }

  const { data, error } = await createPublicClient().rpc('get_public_calendar', {
    p_match_id: kind === 'match' ? id : null,
    p_tournament_id: kind === 'tournament' ? id : null,
    p_team_id: kind === 'team' ? id : null,
  });
  if (error) {
    return NextResponse.json({ error: 'The calendar could not be created.' }, { status: 500 });
  }

  const matches = (data || []) as CalendarMatch[];
  if (kind === 'match' && matches.length === 0) {
    return NextResponse.json({ error: 'This match has no time yet.' }, { status: 404 });
  }

  const title = kind === 'match'
    ? `${matches[0].team_a ?? 'TBD'} vs ${matches[0].team_b ?? 'TBD'}`
    : `${matches[0]?.calendar_name ?? 'DALTA Esports'} – DALTA Esports`;

  return new NextResponse(buildCalendar(title, matches), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${calendarFileName(title)}"`,
      // Subscribed calendars check again later; a few minutes old is fine
      'Cache-Control': 'public, max-age=300',
    },
  });
}
