// Exports for admin/staff (SERVER ONLY: used by app/api/exports/[type]/route.ts).
// Each export reads with the logged-in user's own Supabase session (RLS applies) and
// becomes one table, written as .xlsx (write-excel-file) or CSV (utils/csv.ts).
// Times are shown in Philippine time (Asia/Manila).
import writeXlsxFile from 'write-excel-file/node';
import type { createClient } from '@/utils/supabase/server';
import { csvFile } from '@/utils/csv';
import { roundLabel } from '@/utils/tournaments';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const EXPORT_TYPES = ['registrations', 'rosters', 'matches', 'feedback', 'users'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

// Who may download what (log_export() in the database checks the same)
export const EXPORT_ROLES: Record<ExportType, string[]> = {
  registrations: ['admin', 'staff'],
  rosters: ['admin', 'staff'],
  matches: ['admin', 'staff'],
  feedback: ['admin'],   // feedback is admin-only (Module 6)
  users: ['admin'],
};

export function isExportType(value: string): value is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(value);
}

// datetime = a real moment (shown in PH time), date = a day without time (tournament dates)
type ColumnType = 'text' | 'number' | 'datetime' | 'date' | 'yesno';
type CellValue = string | number | boolean | null | undefined;

interface ExportColumn {
  header: string;
  type?: ColumnType;
  width?: number;
}

export interface ExportTable {
  sheet: string;
  columns: ExportColumn[];
  rows: CellValue[][];
  // File name without extension, e.g. "registrations-mlbb-championship-2026-10-17"
  fileBase: string;
  // For the activity log
  tournamentName?: string;
  tournamentId?: string;
  filter?: string;
}

export interface ExportParams {
  tournamentId?: string | null;
  gameId?: string | null;
}

// ---------------------------------------------------------------------------
// Philippine time. The Philippines has no daylight saving time, so PH time is always UTC+8.
// ---------------------------------------------------------------------------
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// A Date whose UTC parts are the Manila wall-clock time (Excel shows the UTC parts)
function manilaWallClock(iso: string) {
  return new Date(Date.parse(iso) + MANILA_OFFSET_MS);
}

// "2026-10-17 15:30" in PH time
function manilaText(iso: string) {
  return manilaWallClock(iso).toISOString().slice(0, 16).replace('T', ' ');
}

function todayInManila() {
  return manilaWallClock(new Date().toISOString()).toISOString().slice(0, 10);
}

function slug(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'export';
}

const capitalize = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// ---------------------------------------------------------------------------
// Writing the file
// ---------------------------------------------------------------------------
export async function toXlsx(table: ExportTable): Promise<Uint8Array> {
  const header = table.columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const }));
  const body = table.rows.map((row) =>
    row.map((value, i) => {
      if (value === null || value === undefined || value === '') return null;
      switch (table.columns[i].type) {
        case 'datetime':
          return { value: manilaWallClock(String(value)), type: Date, format: 'mmm d, yyyy h:mm AM/PM' };
        case 'date':
          return { value: new Date(`${String(value).slice(0, 10)}T00:00:00Z`), type: Date, format: 'mmm d, yyyy' };
        case 'number':
          return { value: Number(value), type: Number };
        case 'yesno':
          return { value: value ? 'Yes' : 'No', type: String };
        default:
          // Always text, so nothing typed by users is ever treated as a formula
          return { value: String(value), type: String };
      }
    })
  );

  const buffer = await writeXlsxFile([header, ...body], {
    sheet: table.sheet.slice(0, 31),
    columns: table.columns.map((c) => ({ width: c.width ?? 18 })),
    stickyRowsCount: 1,
  }).toBuffer();
  return new Uint8Array(buffer);
}

export function toCsv(table: ExportTable) {
  const rows = table.rows.map((row) =>
    row.map((value, i) => {
      if (value === null || value === undefined) return '';
      switch (table.columns[i].type) {
        case 'datetime': return manilaText(String(value));
        case 'date': return String(value).slice(0, 10);
        case 'yesno': return value ? 'Yes' : 'No';
        default: return value;
      }
    })
  );
  return csvFile(table.columns.map((c) => c.header), rows);
}

// ---------------------------------------------------------------------------
// Reading data (in pages of 1000, the most Supabase returns at once)
// ---------------------------------------------------------------------------
// Without generated database types, Supabase can't know the row shape; each caller says it with <T>.
type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>;

async function fetchAll<T>(page: (from: number, to: number) => Page) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

// .in() with many ids makes a very long URL, so ask in groups of 100
async function fetchIn<T>(ids: string[], page: (chunk: string[], from: number, to: number) => Page) {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    rows.push(...(await fetchAll<T>((from, to) => page(chunk, from, to))));
  }
  return rows;
}

async function getTournament(supabase: SupabaseClient, id: string | null | undefined) {
  if (!id) throw new Error('Choose a tournament.');
  const { data, error } = await supabase.from('tournaments').select('id, name').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tournament not found.');
  return data as { id: string; name: string };
}

interface MemberRow {
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    full_name: string | null;
    student_id: string | null;
    school: string | null;
    course_year: string | null;
    is_verified: boolean;
  } | null;
}

interface TeamRow {
  id: string;
  name: string;
  game_id: string;
  games: { name: string } | null;
}

// Members of the given teams, with their IGN and in-game role for the team's game
async function getMembers(supabase: SupabaseClient, teams: TeamRow[]) {
  const teamIds = teams.map((t) => t.id);
  const members = await fetchIn<MemberRow>(teamIds, (chunk, from, to) =>
    supabase.from('team_members')
      .select('team_id, user_id, role, joined_at, profiles(full_name, student_id, school, course_year, is_verified)')
      .in('team_id', chunk)
      .order('joined_at')
      .range(from, to)
  );

  const userIds = [...new Set(members.map((m) => m.user_id))];
  const gameProfiles = await fetchIn<{ user_id: string; game_id: string; ign: string; in_game_role: string | null }>(
    userIds,
    (chunk, from, to) => supabase.from('player_game_profiles')
      .select('user_id, game_id, ign, in_game_role').in('user_id', chunk).range(from, to)
  );
  const gameOf = new Map(teams.map((t) => [t.id, t.game_id]));
  const profileKey = (userId: string, gameId: string | undefined) => `${userId}:${gameId}`;
  const igns = new Map(gameProfiles.map((g) => [profileKey(g.user_id, g.game_id), g]));

  // Team id -> members (captain first), with the game profile for that team's game
  const byTeam = new Map<string, (MemberRow & { ign: string | null; in_game_role: string | null })[]>();
  for (const m of members) {
    const gp = igns.get(profileKey(m.user_id, gameOf.get(m.team_id)));
    const list = byTeam.get(m.team_id) ?? [];
    list.push({ ...m, ign: gp?.ign ?? null, in_game_role: gp?.in_game_role ?? null });
    byTeam.set(m.team_id, list);
  }
  for (const list of byTeam.values()) list.sort((a, b) => Number(b.role === 'captain') - Number(a.role === 'captain'));
  return byTeam;
}

// ---------------------------------------------------------------------------
// The exports
// ---------------------------------------------------------------------------
const statusOrder = ['approved', 'pending', 'rejected', 'cancelled'];

async function registrationsExport(supabase: SupabaseClient, params: ExportParams): Promise<ExportTable> {
  const tournament = await getTournament(supabase, params.tournamentId);
  const regs = await fetchAll<{
    status: string; registered_at: string; team_id: string | null; team_name: string | null; teams: TeamRow | null;
  }>((from, to) => supabase.from('tournament_registrations')
    .select('status, registered_at, team_id, team_name, teams(id, name, game_id, games(name))')
    .eq('tournament_id', tournament.id).order('registered_at').range(from, to));

  regs.sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
    || (a.teams?.name ?? a.team_name ?? '').localeCompare(b.teams?.name ?? b.team_name ?? ''));
  const members = await getMembers(supabase, regs.flatMap((r) => (r.teams ? [r.teams] : [])));

  const rows: CellValue[][] = [];
  for (const r of regs) {
    const teamName = r.teams?.name ?? r.team_name ?? 'Unnamed team';
    const list = r.team_id ? members.get(r.team_id) ?? [] : [];
    // Older registrations without a team still get one row
    if (list.length === 0) rows.push([tournament.name, teamName, capitalize(r.status), r.registered_at]);
    for (const m of list) {
      rows.push([
        tournament.name, teamName, capitalize(r.status), r.registered_at,
        m.profiles?.full_name, capitalize(m.role), m.ign, m.in_game_role,
        m.profiles?.student_id, m.profiles?.school, m.profiles?.course_year, m.profiles?.is_verified ?? false,
      ]);
    }
  }

  return {
    sheet: 'Registrations',
    columns: [
      { header: 'Tournament', width: 28 }, { header: 'Team', width: 22 }, { header: 'Registration status', width: 18 },
      { header: 'Registered (PH time)', type: 'datetime', width: 22 }, { header: 'Member', width: 24 },
      { header: 'Team role', width: 11 }, { header: 'IGN', width: 18 }, { header: 'In-game role', width: 14 },
      { header: 'Student ID', width: 16 }, { header: 'School', width: 30 }, { header: 'Course / Year', width: 14 },
      { header: 'Verified', type: 'yesno', width: 10 },
    ],
    rows,
    fileBase: `registrations-${slug(tournament.name)}-${todayInManila()}`,
    tournamentName: tournament.name,
    tournamentId: tournament.id,
  };
}

async function rostersExport(supabase: SupabaseClient, params: ExportParams): Promise<ExportTable> {
  let teams: TeamRow[];
  let tournament: { id: string; name: string } | null = null;

  if (params.tournamentId) {
    // Teams with an active (pending/approved) registration for the tournament
    tournament = await getTournament(supabase, params.tournamentId);
    const regs = await fetchAll<{ teams: TeamRow | null }>((from, to) => supabase.from('tournament_registrations')
      .select('teams(id, name, game_id, games(name))').eq('tournament_id', tournament!.id)
      .in('status', ['pending', 'approved']).range(from, to));
    teams = regs.flatMap((r) => (r.teams ? [r.teams] : []));
  } else {
    teams = await fetchAll<TeamRow>((from, to) => {
      let query = supabase.from('teams').select('id, name, game_id, games(name)').order('name');
      if (params.gameId) query = query.eq('game_id', params.gameId);
      return query.range(from, to);
    });
  }
  teams.sort((a, b) => (a.games?.name ?? '').localeCompare(b.games?.name ?? '') || a.name.localeCompare(b.name));
  const members = await getMembers(supabase, teams);

  const rows: CellValue[][] = [];
  for (const t of teams) {
    const list = members.get(t.id) ?? [];
    const captain = list.find((m) => m.role === 'captain');
    for (const m of list) {
      rows.push([
        t.name, t.games?.name, captain?.profiles?.full_name, m.profiles?.full_name, capitalize(m.role),
        m.ign, m.in_game_role, m.profiles?.is_verified ?? false, m.joined_at,
      ]);
    }
  }

  const label = tournament?.name ?? (params.gameId ? teams[0]?.games?.name ?? params.gameId : 'all-teams');
  return {
    sheet: 'Rosters',
    columns: [
      { header: 'Team', width: 22 }, { header: 'Game', width: 18 }, { header: 'Captain', width: 22 },
      { header: 'Member', width: 24 }, { header: 'Team role', width: 11 }, { header: 'IGN', width: 18 },
      { header: 'In-game role', width: 14 }, { header: 'Verified', type: 'yesno', width: 10 },
      { header: 'Joined (PH time)', type: 'datetime', width: 22 },
    ],
    rows,
    fileBase: `rosters-${slug(label)}-${todayInManila()}`,
    tournamentName: tournament?.name,
    tournamentId: tournament?.id,
    filter: !tournament && params.gameId ? `game ${params.gameId}` : undefined,
  };
}

async function matchesExport(supabase: SupabaseClient, params: ExportParams): Promise<ExportTable> {
  const tournament = await getTournament(supabase, params.tournamentId);
  const matches = await fetchAll<{
    id: string; round: number; match_number: number; team_a_id: string | null; team_b_id: string | null;
    scheduled_at: string | null; status: string; score_a: number | null; score_b: number | null;
    winner_team_id: string | null; is_forfeit: boolean;
  }>((from, to) => supabase.from('matches').select('*').eq('tournament_id', tournament.id)
    .order('round').order('match_number').range(from, to));

  const teamIds = [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((id): id is string => !!id))];
  const teams = await fetchIn<{ id: string; name: string }>(teamIds, (chunk, from, to) =>
    supabase.from('teams').select('id, name').in('id', chunk).range(from, to));
  const names = new Map(teams.map((t) => [t.id, t.name]));
  const checkins = await fetchIn<{ match_id: string; team_id: string; checked_in_at: string }>(
    matches.map((m) => m.id),
    (chunk, from, to) => supabase.from('match_checkins').select('match_id, team_id, checked_in_at').in('match_id', chunk).range(from, to)
  );
  const checkinAt = (matchId: string, teamId: string | null) =>
    checkins.find((c) => c.match_id === matchId && c.team_id === teamId)?.checked_in_at ?? null;

  const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
  // Byes (round 1 with one team) aren't real matches
  const played = matches.filter((m) => !(m.round === 1 && (!m.team_a_id || !m.team_b_id)));
  const name = (id: string | null) => (id ? names.get(id) ?? 'Unknown team' : 'TBD');

  return {
    sheet: 'Schedule and results',
    columns: [
      { header: 'Tournament', width: 28 }, { header: 'Round', width: 14 }, { header: 'Match #', type: 'number', width: 9 },
      { header: 'Team A', width: 22 }, { header: 'Team B', width: 22 },
      { header: 'Scheduled (PH time)', type: 'datetime', width: 22 }, { header: 'Status', width: 11 },
      { header: 'Score A', type: 'number', width: 9 }, { header: 'Score B', type: 'number', width: 9 },
      { header: 'Winner', width: 22 }, { header: 'Forfeit', type: 'yesno', width: 9 },
      { header: 'Team A check-in (PH time)', type: 'datetime', width: 24 },
      { header: 'Team B check-in (PH time)', type: 'datetime', width: 24 },
    ],
    rows: played.map((m) => [
      tournament.name, roundLabel(m.round, roundCount), m.match_number, name(m.team_a_id), name(m.team_b_id),
      m.scheduled_at, capitalize(m.status), m.score_a, m.score_b, m.winner_team_id ? name(m.winner_team_id) : null,
      m.is_forfeit, checkinAt(m.id, m.team_a_id), checkinAt(m.id, m.team_b_id),
    ]),
    fileBase: `schedule-results-${slug(tournament.name)}-${todayInManila()}`,
    tournamentName: tournament.name,
    tournamentId: tournament.id,
  };
}

// Feedback without names: the export is for reading sentiment, not for finding authors
async function feedbackExport(supabase: SupabaseClient, params: ExportParams): Promise<ExportTable> {
  let tournament: { id: string; name: string } | null = null;
  if (params.tournamentId && params.tournamentId !== 'general') tournament = await getTournament(supabase, params.tournamentId);

  const rows = await fetchAll<{
    created_at: string; rating: number; comment: string; sentiment: string | null; sentiment_score: number | null;
    topics: string[]; tournaments: { name: string } | null;
  }>((from, to) => {
    let query = supabase.from('feedback')
      .select('created_at, rating, comment, sentiment, sentiment_score, topics, tournaments(name)')
      .order('created_at', { ascending: false });
    if (tournament) query = query.eq('tournament_id', tournament.id);
    else if (params.tournamentId === 'general') query = query.is('tournament_id', null);
    return query.range(from, to);
  });

  const label = tournament?.name ?? (params.tournamentId === 'general' ? 'general' : 'all');
  return {
    sheet: 'Feedback',
    columns: [
      { header: 'Date (PH time)', type: 'datetime', width: 22 }, { header: 'Tournament', width: 28 },
      { header: 'Rating', type: 'number', width: 8 }, { header: 'Comment', width: 60 },
      { header: 'Sentiment', width: 12 }, { header: 'Sentiment score', type: 'number', width: 15 },
      { header: 'Topics', width: 36 },
    ],
    rows: rows.map((f) => [
      f.created_at, f.tournaments?.name ?? 'General', f.rating, f.comment,
      f.sentiment ? capitalize(f.sentiment) : 'Not classified', f.sentiment_score, f.topics.join(', '),
    ]),
    fileBase: `feedback-${slug(label)}-${todayInManila()}`,
    tournamentName: tournament?.name,
    tournamentId: tournament?.id,
    filter: params.tournamentId === 'general' ? 'general feedback' : undefined,
  };
}

async function usersExport(supabase: SupabaseClient): Promise<ExportTable> {
  const users = await fetchAll<{
    full_name: string | null; email: string; role: string; created_at: string; verification_status: string;
    student_id: string | null; school: string | null; course_year: string | null; privacy_consent_at: string | null;
  }>((from, to) => supabase.from('profiles')
    .select('full_name, email, role, created_at, verification_status, student_id, school, course_year, privacy_consent_at')
    .order('created_at').range(from, to));

  return {
    sheet: 'Users',
    columns: [
      { header: 'Name', width: 26 }, { header: 'Email', width: 32 }, { header: 'Role', width: 11 },
      { header: 'Joined (PH time)', type: 'datetime', width: 22 }, { header: 'Student verification', width: 18 },
      { header: 'Student ID', width: 16 }, { header: 'School', width: 30 }, { header: 'Course / Year', width: 14 },
      { header: 'Privacy consent (PH time)', type: 'datetime', width: 24 },
    ],
    rows: users.map((u) => [
      u.full_name, u.email, capitalize(u.role), u.created_at, capitalize(u.verification_status),
      u.student_id, u.school, u.course_year, u.privacy_consent_at,
    ]),
    fileBase: `users-${todayInManila()}`,
  };
}

export function buildExport(type: ExportType, supabase: SupabaseClient, params: ExportParams) {
  switch (type) {
    case 'registrations': return registrationsExport(supabase, params);
    case 'rosters': return rostersExport(supabase, params);
    case 'matches': return matchesExport(supabase, params);
    case 'feedback': return feedbackExport(supabase, params);
    case 'users': return usersExport(supabase);
  }
}
