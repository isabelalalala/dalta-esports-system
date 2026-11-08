// Shared code for the Administrative Reports (Module 6).
// The numbers come from the report_* database functions (see migrations 202610162300_admin_reports
// and 202611081700_report_insights); this file has their types, the filter handling, chart colors,
// the data helpers the charts and the written interpretations share, and the CSV export.
// No server-only imports: used by the report pages AND by POST /api/reports/generate.
import type { SupabaseClient as BaseClient } from '@supabase/supabase-js';
import type { Database } from '@/utils/database.types';
import type { Sentiment, StreamStatus, Tournament } from '@/utils/types';
import { getTournamentStatus, roundLabel, statusLabels, toDateInput } from '@/utils/tournaments';
import { csvCell } from '@/utils/csv';
import type { ReportInsights } from '@/utils/report-insights';

type SupabaseClient = BaseClient<Database>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

// Which audience texts the sentiment part of a report uses (Phase 5 "data source" filter)
export type DataSource = 'all' | 'feedback' | 'comments';

export const DATA_SOURCES: { value: DataSource; label: string }[] = [
  { value: 'all', label: 'Feedback and comments' },
  { value: 'feedback', label: 'Feedback only' },
  { value: 'comments', label: 'Stream comments only' },
];

export function isDataSource(value: unknown): value is DataSource {
  return value === 'all' || value === 'feedback' || value === 'comments';
}

// '' = all. Dates are YYYY-MM-DD and inclusive. source only matters for the admin report.
export interface ReportFilters {
  tournamentId: string;
  gameId: string;
  from: string;
  to: string;
  source: DataSource;
}

export const emptyFilters: ReportFilters = { tournamentId: '', gameId: '', from: '', to: '', source: 'all' };

// Turns the filters into the arguments of the report functions.
// An empty filter is left out, so the function uses its default (null = all).
export function toRpcArgs(filters: ReportFilters) {
  return {
    p_tournament_id: filters.tournamentId || undefined,
    p_game_id: filters.gameId || undefined,
    p_from: filters.from || undefined,
    p_to: filters.to || undefined,
  };
}

// Returns an error message, or '' if the filters are fine
export function validateFilters(filters: ReportFilters) {
  if (filters.from && filters.to && filters.from > filters.to) {
    return 'The "from" date must be on or before the "to" date.';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Report shapes (what the database functions return)
// ---------------------------------------------------------------------------

export interface ActivityReport {
  totals: {
    users: number;
    tournaments: number;
    registrations: number;
    teams: number;
    players_in_teams: number;
    matches_played: number;
    matches_total: number;
  };
  users_by_role: { role: string; count: number }[];
  signups_by_month: { month: string; count: number }[];
  registrations_by_status: { status: string; count: number }[];
  matches_by_status: { status: string; count: number }[];
  teams_by_game: { game: string; count: number }[];
  // Since 202611081700 (missing in older saved reports)
  registrations_by_day?: { day: string; total: number; approved: number }[];
  tournaments: (Pick<
    Tournament,
    'id' | 'name' | 'game' | 'status' | 'start_date' | 'end_date' | 'registration_deadline' | 'max_participants'
  > & {
    approved_teams: number;
    pending_teams: number;
    matches_played: number;
    matches_total: number;
  })[];
}

interface SentimentCounts {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  pending: number;
}

export interface SentimentReport {
  totals: SentimentCounts & { avg_rating: number | null; avg_score: number | null };
  by_week: (SentimentCounts & { week: string; avg_rating: number | null })[];
  // tournament_name is null for general feedback
  by_tournament: (SentimentCounts & {
    tournament_id: string | null;
    tournament_name: string | null;
    avg_rating: number | null;
    avg_score: number | null;
  })[];
  topics: { topic: string; total: number; positive: number; neutral: number; negative: number }[];
  negative_examples: {
    comment: string;
    rating: number;
    sentiment_score: number | null;
    topics: string[];
    tournament_name: string | null;
    created_at: string;
  }[];
}

export interface EngagementReport {
  totals: {
    streams: number;
    live_streams: number;
    views: number;
    unique_viewers: number;
    feedback: number;
    avg_rating: number | null;
    // Pick'em (since 202610181100; missing in reports saved before that)
    predictions?: number;
    predictors?: number;              // people who picked at least once
    prediction_accuracy?: number | null;  // % of decided picks that were right
    audience_accounts?: number;       // player + spectator accounts
    prediction_participation?: number | null;  // % of those accounts that picked at least once
  };
  streams: {
    id: string;
    title: string;
    status: StreamStatus;
    tournament_name: string;
    game: string;
    // Only filled when the stream is linked to one match
    round: number | null;
    match_number: number | null;
    round_count: number | null;
    views: number;
    unique_viewers: number;
  }[];
  views_by_day: { day: string; views: number; unique_viewers: number }[];
  feedback_by_tournament: { tournament_name: string | null; count: number; avg_rating: number | null }[];
  // Missing in reports saved before pick'em existed
  predictions_by_tournament?: {
    tournament_name: string;
    predictions: number;
    predictors: number;
    decided: number;
    accuracy: number | null;
  }[];
}

// Stream comment sentiment: the same shape as SentimentReport (avg_rating is always null) plus
// comments per stream. report_comments(), since 202611081700.
export interface CommentReport extends SentimentReport {
  by_stream: { stream_id: string; title: string; tournament_name: string; total: number }[];
}

// report_moderation(), since 202611081700
export interface ModerationReport {
  totals: {
    warnings: number;
    active_warnings: number;
    removed_warnings: number;
    ai_warnings: number;
    moderator_warnings: number;
    profanity_warnings: number;
    offensive_warnings: number;
    comments: number;
    comments_profane: number;
    comments_offensive: number;
    comments_hidden: number;
    comments_removed: number;
    comments_restored: number;
    feedback: number;
    feedback_profane: number;
    feedback_offensive: number;
    feedback_hidden: number;
    feedback_removed: number;
    feedback_restored: number;
    accounts_flagged: number;
    accounts_banned: number;
    bans_dismissed: number;
    accounts_unbanned: number;
    pending_bans_now: number;
    banned_now: number;
  };
  warnings_by_week: { week: string; profanity: number; offensive: number }[];
  offense_types: { offense_type: string; count: number }[];
}

// Everything an admin's generated report contains (saved in analytics_reports.data).
// comments, moderation and insights were added in Phase 5: older saved reports don't have them.
export interface FullReport {
  activity: ActivityReport;
  sentiment: SentimentReport;
  engagement: EngagementReport;
  comments?: CommentReport;
  moderation?: ModerationReport;
  insights?: ReportInsights;
}

// A row of analytics_reports. filters holds readable names, not ids.
export interface SavedReport {
  id: string;
  filters: { tournament?: string; game?: string; from?: string; to?: string; source?: DataSource };
  data: FullReport;
  generated_by: string | null;
  generated_at: string;
}

export async function fetchEngagementReport(supabase: SupabaseClient, filters: ReportFilters) {
  const { data, error } = await supabase.rpc('report_engagement', toRpcArgs(filters));
  if (error) throw error;
  return data as unknown as EngagementReport;
}

// Runs all report functions at the same time (admin only; each function checks the role).
// Called by POST /api/reports/generate with the admin's own session.
export async function fetchFullReport(supabase: SupabaseClient, filters: ReportFilters): Promise<FullReport> {
  const args = toRpcArgs(filters);
  const [activity, sentiment, engagement, comments, moderation] = await Promise.all([
    supabase.rpc('report_activity', args),
    supabase.rpc('report_sentiment', args),
    supabase.rpc('report_engagement', args),
    supabase.rpc('report_comments', args),
    supabase.rpc('report_moderation', args),
  ]);
  for (const part of [activity, sentiment, engagement, comments, moderation]) {
    if (part.error) throw part.error;
  }
  // The functions return jsonb; the shapes are the types above
  return {
    activity: activity.data as unknown as ActivityReport,
    sentiment: sentiment.data as unknown as SentimentReport,
    engagement: engagement.data as unknown as EngagementReport,
    comments: comments.data as unknown as CommentReport,
    moderation: moderation.data as unknown as ModerationReport,
  };
}

// Reports saved before Phase 5 have no source: they only covered feedback.
export function sourceLabel(source: DataSource | undefined) {
  return DATA_SOURCES.find((s) => s.value === (source ?? 'feedback'))?.label ?? 'Feedback only';
}

// Readable filters, e.g. "All tournaments · MLBB · 2026-10-01 to 2026-10-31 · Feedback only".
// withSource = false for the staff engagement page, which has no data source.
export function describeFilters(f: SavedReport['filters'], withSource = true) {
  const parts = [f.tournament || 'All tournaments', f.game || 'All games'];
  if (f.from || f.to) parts.push(`${f.from || '…'} to ${f.to || '…'}`);
  else parts.push('All dates');
  if (withSource) parts.push(sourceLabel(f.source));
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Data helpers shared by the charts and the written interpretations, so the text always
// describes exactly what the chart shows.
// ---------------------------------------------------------------------------

// Adds n days to a YYYY-MM-DD date (UTC arithmetic, so no time zone can shift it)
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The Monday of the week a YYYY-MM-DD date falls in (same as Postgres date_trunc('week'))
export function weekStart(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

export interface RegistrationPoint { date: string; total: number; approved: number }

// Registrations over time: every day between the first and last registration (days without any
// count as 0), or every week when that spans more than 9 weeks (a daily line would be unreadable).
export function registrationsOverTime(rows: ActivityReport['registrations_by_day']): {
  unit: 'day' | 'week';
  points: RegistrationPoint[];
} {
  const list = rows ?? [];
  if (list.length === 0) return { unit: 'day', points: [] };
  const byDay = new Map(list.map((r) => [r.day, r]));
  const days: RegistrationPoint[] = [];
  for (let d = list[0].day; d <= list[list.length - 1].day; d = addDays(d, 1)) {
    const r = byDay.get(d);
    days.push({ date: d, total: Number(r?.total ?? 0), approved: Number(r?.approved ?? 0) });
  }
  if (days.length <= 63) return { unit: 'day', points: days };

  const weeks = new Map<string, RegistrationPoint>();
  for (const d of days) {
    const key = weekStart(d.date);
    const w = weeks.get(key) ?? { date: key, total: 0, approved: 0 };
    w.total += d.total;
    w.approved += d.approved;
    weeks.set(key, w);
  }
  return { unit: 'week', points: [...weeks.values()] };
}

// Share of each sentiment among the ANALYSED items of each week (pending ones are left out),
// as whole percentages. Weeks with nothing analysed are skipped.
export function sentimentShareByWeek(rows: SentimentReport['by_week']) {
  return rows
    .map((w) => {
      const analysed = Number(w.positive) + Number(w.neutral) + Number(w.negative);
      const pct = (n: number) => (analysed ? Math.round((Number(n) / analysed) * 100) : 0);
      return { week: w.week, analysed, positive: pct(w.positive), neutral: pct(w.neutral), negative: pct(w.negative) };
    })
    .filter((w) => w.analysed > 0);
}

type Counts = { total: number; positive: number; neutral: number; negative: number };

function addCounts<T extends Counts>(x: T, y: Counts): T {
  return {
    ...x,
    total: Number(x.total) + Number(y.total),
    positive: Number(x.positive) + Number(y.positive),
    neutral: Number(x.neutral) + Number(y.neutral),
    negative: Number(x.negative) + Number(y.negative),
  };
}

// Feedback and comments combined into one SentimentReport (data source "all").
// Counts add up; avg_rating stays the feedback's (comments have none); avg_score is weighted by
// how many items of each source were analysed.
export function combineSentiment(a: SentimentReport, b: SentimentReport): SentimentReport {
  const analysed = (t: Counts) => Number(t.positive) + Number(t.neutral) + Number(t.negative);
  const parts = ([[a.totals.avg_score, analysed(a.totals)], [b.totals.avg_score, analysed(b.totals)]] as const)
    .filter(([score, weight]) => score !== null && weight > 0) as [number, number][];
  const weight = parts.reduce((sum, [, w]) => sum + w, 0);
  const avgScore = weight ? Math.round((parts.reduce((sum, [s, w]) => sum + Number(s) * w, 0) / weight) * 100) / 100 : null;

  const weeks = new Map<string, SentimentReport['by_week'][number]>();
  for (const w of [...a.by_week, ...b.by_week]) {
    const prev = weeks.get(w.week);
    weeks.set(w.week, prev
      ? { ...addCounts(prev, w), pending: Number(prev.pending) + Number(w.pending), avg_rating: prev.avg_rating ?? w.avg_rating }
      : { ...w });
  }
  const tournaments = new Map<string, SentimentReport['by_tournament'][number]>();
  for (const t of [...a.by_tournament, ...b.by_tournament]) {
    const key = t.tournament_id ?? 'general';
    const prev = tournaments.get(key);
    tournaments.set(key, prev
      ? { ...addCounts(prev, t), pending: Number(prev.pending) + Number(t.pending),
          avg_rating: prev.avg_rating ?? t.avg_rating, avg_score: prev.avg_score ?? t.avg_score }
      : { ...t });
  }
  const topics = new Map<string, SentimentReport['topics'][number]>();
  for (const t of [...a.topics, ...b.topics]) {
    const prev = topics.get(t.topic);
    topics.set(t.topic, prev ? addCounts(prev, t) : { ...t });
  }

  return {
    totals: {
      ...addCounts(a.totals, b.totals),
      pending: Number(a.totals.pending) + Number(b.totals.pending),
      avg_rating: a.totals.avg_rating,
      avg_score: avgScore,
    },
    by_week: [...weeks.values()].sort((x, y) => x.week.localeCompare(y.week)),
    by_tournament: [...tournaments.values()].sort((x, y) => y.total - x.total),
    topics: [...topics.values()].sort((x, y) => y.total - x.total).slice(0, 20),
    negative_examples: [...a.negative_examples, ...b.negative_examples]
      .sort((x, y) => (x.sentiment_score ?? 0) - (y.sentiment_score ?? 0))
      .slice(0, 5),
  };
}

// The sentiment data a report shows for its data source. Reports saved before Phase 5 have no
// comment data: they always show feedback.
export function sentimentForSource(data: FullReport, source: DataSource | undefined): SentimentReport {
  if (!data.comments || !source || source === 'feedback') return data.sentiment;
  if (source === 'comments') return data.comments;
  return combineSentiment(data.sentiment, data.comments);
}

// What the sentiment items are called in titles and sentences
export function sourceNoun(data: FullReport, source: DataSource | undefined) {
  if (!data.comments || !source || source === 'feedback') return 'feedback entries';
  return source === 'comments' ? 'comments' : 'feedback entries and comments';
}

// ---------------------------------------------------------------------------
// Chart colors. One palette per theme, each validated for color-blind safety against its own card
// surface (white / the dark theme's card): neighbouring category slots pass CVD ΔE >= 8 in both
// modes. A few light-mode slots are below 3:1 contrast on white, so every chart also has a legend
// and a data table (ReportChart "Show data table"). Printing always uses the light palette.
// ---------------------------------------------------------------------------

export type ChartTheme = 'light' | 'dark';

export const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative'];

export const chartPalettes: Record<ChartTheme, {
  // Different things (roles, games, statuses) get colors in this fixed order
  category: string[];
  // Sentiment is a scale from bad to good: red ↔ neutral gray ↔ blue (red next to green is hard
  // to tell apart for many color-blind viewers, so positive is blue)
  sentiment: Record<Sentiment, string>;
  text: string;
  grid: string;
  // The card color: thin gaps between stacked parts and doughnut slices
  surface: string;
}> = {
  light: {
    category: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    sentiment: { positive: '#2a78d6', neutral: '#a3a29b', negative: '#e34948' },
    text: '#57534e',
    grid: '#e7e5e4',
    surface: '#ffffff',
  },
  dark: {
    category: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    sentiment: { positive: '#3987e5', neutral: '#b5b4ad', negative: '#e66767' },
    text: '#c3c2b7',
    grid: '#3a3532',
    surface: '#1c1917',
  },
};

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

type CsvValue = string | number | null | undefined;

export interface CsvSection {
  title: string;
  columns: string[];
  rows: CsvValue[][];
}

// Several tables in one CSV file: a title line, the header, the rows, then a blank line
export function buildCsv(sections: CsvSection[]) {
  return sections
    .map((s) => [s.title, s.columns.map(csvCell).join(','), ...s.rows.map((r) => r.map(csvCell).join(','))].join('\r\n'))
    .join('\r\n\r\n');
}

// ---------------------------------------------------------------------------
// Philippine dates, for filenames and filter presets. Same UTC+8 logic as the
// server-side helpers in utils/exports.ts (which client code can't import).
// ---------------------------------------------------------------------------
export function dateInManila(iso: string) {
  return new Date(Date.parse(iso) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function todayInManila() {
  return dateInManila(new Date().toISOString());
}

// Starts a download in the browser. The BOM makes Excel read the file as UTF-8 (ñ, ★, ...).
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// The tables of each report, for the CSV export
export function activityCsv(r: ActivityReport): CsvSection[] {
  return [
    {
      title: 'Activity totals',
      columns: ['Users', 'Tournaments', 'Registrations', 'Teams', 'Players in teams', 'Matches played', 'Matches total'],
      rows: [[r.totals.users, r.totals.tournaments, r.totals.registrations, r.totals.teams,
        r.totals.players_in_teams, r.totals.matches_played, r.totals.matches_total]],
    },
    { title: 'Users by role', columns: ['Role', 'Users'], rows: r.users_by_role.map((x) => [x.role, x.count]) },
    { title: 'Sign-ups by month', columns: ['Month', 'Sign-ups'], rows: r.signups_by_month.map((x) => [x.month, x.count]) },
    {
      title: 'Registrations by status',
      columns: ['Status', 'Registrations'],
      rows: r.registrations_by_status.map((x) => [x.status, x.count]),
    },
    { title: 'Matches by status', columns: ['Status', 'Matches'], rows: r.matches_by_status.map((x) => [x.status, x.count]) },
    { title: 'Teams by game', columns: ['Game', 'Teams'], rows: r.teams_by_game.map((x) => [x.game, x.count]) },
    {
      title: 'Tournaments',
      columns: ['Tournament', 'Game', 'Status', 'Start', 'End', 'Max teams', 'Approved teams', 'Pending teams',
        'Matches played', 'Matches total'],
      rows: r.tournaments.map((t) => [t.name, t.game, statusLabels[getTournamentStatus(t)], toDateInput(t.start_date),
        toDateInput(t.end_date), t.max_participants, t.approved_teams, t.pending_teams, t.matches_played, t.matches_total]),
    },
  ];
}

export function sentimentCsv(r: SentimentReport): CsvSection[] {
  const t = r.totals;
  return [
    {
      title: 'Sentiment totals',
      columns: ['Feedback', 'Positive', 'Neutral', 'Negative', 'Pending analysis', 'Average rating', 'Average score'],
      rows: [[t.total, t.positive, t.neutral, t.negative, t.pending, t.avg_rating, t.avg_score]],
    },
    {
      title: 'Sentiment by week',
      columns: ['Week of', 'Feedback', 'Positive', 'Neutral', 'Negative', 'Pending analysis', 'Average rating'],
      rows: r.by_week.map((w) => [w.week, w.total, w.positive, w.neutral, w.negative, w.pending, w.avg_rating]),
    },
    {
      title: 'Sentiment by tournament',
      columns: ['Tournament', 'Feedback', 'Positive', 'Neutral', 'Negative', 'Pending analysis', 'Average rating', 'Average score'],
      rows: r.by_tournament.map((x) => [x.tournament_name ?? 'General', x.total, x.positive, x.neutral, x.negative,
        x.pending, x.avg_rating, x.avg_score]),
    },
    {
      title: 'Topics',
      columns: ['Topic', 'Mentions', 'Positive', 'Neutral', 'Negative'],
      rows: r.topics.map((x) => [x.topic, x.total, x.positive, x.neutral, x.negative]),
    },
  ];
}

export function engagementCsv(r: EngagementReport): CsvSection[] {
  const t = r.totals;
  return [
    {
      title: 'Engagement totals',
      columns: ['Streams', 'Live now', 'Views', 'Unique viewers', 'Feedback', 'Average rating'],
      rows: [[t.streams, t.live_streams, t.views, t.unique_viewers, t.feedback, t.avg_rating]],
    },
    {
      title: 'Views per stream',
      columns: ['Stream', 'Tournament', 'Game', 'Match', 'Status', 'Views', 'Unique viewers'],
      rows: r.streams.map((s) => [s.title, s.tournament_name, s.game, streamMatchLabel(s), s.status, s.views, s.unique_viewers]),
    },
    {
      title: 'Views per day',
      columns: ['Day', 'Views', 'Unique viewers'],
      rows: r.views_by_day.map((d) => [d.day, d.views, d.unique_viewers]),
    },
    {
      title: 'Feedback per tournament',
      columns: ['Tournament', 'Feedback', 'Average rating'],
      rows: r.feedback_by_tournament.map((f) => [f.tournament_name ?? 'General', f.count, f.avg_rating]),
    },
    // Only in reports made after pick'em was added
    ...(r.predictions_by_tournament ? [
      {
        title: "Pick'em totals",
        columns: ['Predictions', 'Predictors', 'Accuracy %', 'Audience accounts', 'Participation %'],
        rows: [[t.predictions ?? 0, t.predictors ?? 0, t.prediction_accuracy ?? null, t.audience_accounts ?? 0, t.prediction_participation ?? null]],
      },
      {
        title: "Pick'em per tournament",
        columns: ['Tournament', 'Predictions', 'Predictors', 'Decided', 'Accuracy %'],
        rows: r.predictions_by_tournament.map((p) => [p.tournament_name, p.predictions, p.predictors, p.decided, p.accuracy]),
      },
    ] : []),
  ];
}

// The same tables for another source, e.g. "Comment sentiment totals"
export function prefixCsv(prefix: string, sections: CsvSection[]): CsvSection[] {
  return sections.map((s) => ({ ...s, title: `${prefix} ${s.title.charAt(0).toLowerCase()}${s.title.slice(1)}` }));
}

export function registrationsCsv(r: ActivityReport): CsvSection[] {
  if (!r.registrations_by_day) return [];
  return [{
    title: 'Registrations per day',
    columns: ['Day', 'Registrations', 'Approved'],
    rows: r.registrations_by_day.map((d) => [d.day, d.total, d.approved]),
  }];
}

export function moderationCsv(r: ModerationReport): CsvSection[] {
  const t = r.totals;
  return [
    {
      title: 'Moderation totals',
      columns: ['Warnings', 'Active', 'Removed', 'From AI', 'From moderators', 'Profanity', 'Offensive',
        'Comments', 'Profane comments', 'Hidden comments', 'Removed comments', 'Restored comments',
        'Feedback', 'Hidden feedback', 'Removed feedback', 'Accounts flagged', 'Bans', 'Bans dismissed', 'Unbanned'],
      rows: [[t.warnings, t.active_warnings, t.removed_warnings, t.ai_warnings, t.moderator_warnings,
        t.profanity_warnings, t.offensive_warnings, t.comments, t.comments_profane, t.comments_hidden,
        t.comments_removed, t.comments_restored, t.feedback, t.feedback_hidden, t.feedback_removed,
        t.accounts_flagged, t.accounts_banned, t.bans_dismissed, t.accounts_unbanned]],
    },
    {
      title: 'Warnings per week',
      columns: ['Week of', 'Profanity', 'Offensive'],
      rows: r.warnings_by_week.map((w) => [w.week, w.profanity, w.offensive]),
    },
    {
      title: 'Offense types',
      columns: ['Type', 'Items'],
      rows: r.offense_types.map((o) => [o.offense_type, o.count]),
    },
  ];
}

// "Final · Match 1", or '' when the stream isn't linked to one match
export function streamMatchLabel(s: EngagementReport['streams'][number]) {
  if (s.round === null || s.match_number === null) return '';
  return `${roundLabel(s.round, s.round_count ?? s.round)} · Match ${s.match_number}`;
}
