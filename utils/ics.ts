// iCalendar (.ics) files without a library (RFC 5545), for "Add to calendar".
// Times are written in Asia/Manila (UTC+8, no daylight saving time), with the time zone
// included in the file so Google, Apple and Outlook show the right time anywhere.
import { roundLabel } from '@/utils/tournaments';
import { SITE_URL, publicMatchPath } from '@/utils/site-url';

// Every match is shown as 1 hour long (the database only stores the start time)
const MATCH_MINUTES = 60;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// One row returned by get_public_calendar()
export interface CalendarMatch {
  match_id: string;
  tournament_id: string;
  tournament_name: string;
  game: string;
  round: number;
  round_count: number;
  match_number: number;
  team_a: string | null;
  team_b: string | null;
  scheduled_at: string;
  status: string;
  score_a: number | null;
  score_b: number | null;
  updated_at: string;
  calendar_name: string;
}

// 20261017T153000 in Manila time
function manilaLocal(ms: number) {
  return new Date(ms + MANILA_OFFSET_MS).toISOString().replace(/[-:]/g, '').slice(0, 15);
}

// 20261017T073000Z (UTC), for DTSTAMP
function utcStamp(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

// Text values: backslash, semicolon, comma and line breaks must be escaped
function escapeText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 bytes are folded: continued on the next line, starting with a space
function fold(line: string) {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    if (bytes.encode(current + char).length > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildCalendar(title: string, matches: CalendarMatch[]) {
  const now = Date.now();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DALTA Esports//Tournament Management System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(title)}`,
    'X-WR-TIMEZONE:Asia/Manila',
    // Manila has had no daylight saving time since 1978, so one STANDARD rule is enough
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Manila',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:PHT',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const m of matches) {
    const start = Date.parse(m.scheduled_at);
    const teams = `${m.team_a ?? 'TBD'} vs ${m.team_b ?? 'TBD'}`;
    const round = roundLabel(m.round, m.round_count || m.round);
    const url = `${SITE_URL}${publicMatchPath(m.tournament_id, m.match_id)}`;
    const result = m.status === 'completed' && m.score_a !== null && m.score_b !== null
      ? `\nResult: ${m.score_a} - ${m.score_b}` : '';

    lines.push(
      'BEGIN:VEVENT',
      // The same id every time, so importing again updates the event instead of duplicating it
      `UID:match-${m.match_id}@dalta-esports`,
      // Goes up whenever the match changes, so calendar apps take the newer version
      `SEQUENCE:${Math.floor(Date.parse(m.updated_at) / 1000) % 2147483647}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;TZID=Asia/Manila:${manilaLocal(start)}`,
      `DTEND;TZID=Asia/Manila:${manilaLocal(start + MATCH_MINUTES * 60_000)}`,
      `SUMMARY:${escapeText(`${teams} (${round}, ${m.tournament_name})`)}`,
      `DESCRIPTION:${escapeText(`${m.game} · ${m.tournament_name}\n${round}, match ${m.match_number}${result}\n${url}`)}`,
      `URL:${url}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// "mlbb-championship" for file names
export function calendarFileName(name: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${base || 'dalta-esports'}.ics`;
}
