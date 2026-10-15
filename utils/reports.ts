// Shared code for the Administrative Reports (Module 6).
// The numbers come from the report_* database functions (see migration 202610162300_admin_reports);
// this file has their types, the filter handling, chart colors and the CSV export.
import type { createClient } from '@/utils/supabase/client';
import type { Sentiment, StreamStatus, Tournament } from '@/utils/types';
import { getTournamentStatus, roundLabel, statusLabels, toDateInput } from '@/utils/tournaments';

type SupabaseClient = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

// '' = all. Dates are YYYY-MM-DD and inclusive.
export interface ReportFilters {
  tournamentId: string;
  gameId: string;
  from: string;
  to: string;
}

export const emptyFilters: ReportFilters = { tournamentId: '', gameId: '', from: '', to: '' };

// Turns the filters into the arguments of the report functions (null = all)
export function toRpcArgs(filters: ReportFilters) {
  return {
    p_tournament_id: filters.tournamentId || null,
    p_game_id: filters.gameId || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
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
}

// Everything an admin's generated report contains (saved in analytics_reports.data)
export interface FullReport {
  activity: ActivityReport;
  sentiment: SentimentReport;
  engagement: EngagementReport;
}

// A row of analytics_reports. filters holds readable names, not ids.
export interface SavedReport {
  id: string;
  filters: { tournament?: string; game?: string; from?: string; to?: string };
  data: FullReport;
  generated_by: string | null;
  generated_at: string;
}

export async function fetchEngagementReport(supabase: SupabaseClient, filters: ReportFilters) {
  const { data, error } = await supabase.rpc('report_engagement', toRpcArgs(filters));
  if (error) throw error;
  return data as EngagementReport;
}

// Runs all three reports at the same time (admin only)
export async function fetchFullReport(supabase: SupabaseClient, filters: ReportFilters): Promise<FullReport> {
  const args = toRpcArgs(filters);
  const [activity, sentiment, engagement] = await Promise.all([
    supabase.rpc('report_activity', args),
    supabase.rpc('report_sentiment', args),
    supabase.rpc('report_engagement', args),
  ]);
  if (activity.error) throw activity.error;
  if (sentiment.error) throw sentiment.error;
  if (engagement.error) throw engagement.error;
  return { activity: activity.data, sentiment: sentiment.data, engagement: engagement.data };
}

// Readable filters, e.g. "All tournaments · MLBB · 2026-10-01 to 2026-10-31"
export function describeFilters(f: SavedReport['filters']) {
  const parts = [f.tournament || 'All tournaments', f.game || 'All games'];
  if (f.from || f.to) parts.push(`${f.from || '…'} to ${f.to || '…'}`);
  else parts.push('All dates');
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Chart colors (checked for color-blind safety on the dark card background #1a1a2e)
// ---------------------------------------------------------------------------

// Sentiment is a scale from bad to good: red ↔ neutral gray ↔ blue.
// (Red next to green is hard to tell apart for many color-blind viewers, so positive is blue.)
export const sentimentColors: Record<Sentiment, string> = {
  positive: '#3987e5',
  neutral: '#b5b4ad',
  negative: '#e66767',
};

export const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative'];

// Different things (roles, games, statuses) get colors in this fixed order
export const categoryColors = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

// Text and grid colors for charts on the dark background
export const chartText = '#9ca3af';
export const chartGrid = '#2c2c3e';

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

type CsvValue = string | number | null | undefined;

export interface CsvSection {
  title: string;
  columns: string[];
  rows: CsvValue[][];
}

// One CSV value. Quotes values with commas, quotes or line breaks.
// Text starting with = + - @ is prefixed with ' so Excel doesn't run it as a formula
// (feedback comments are typed by users).
function csvCell(value: CsvValue) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Several tables in one CSV file: a title line, the header, the rows, then a blank line
export function buildCsv(sections: CsvSection[]) {
  return sections
    .map((s) => [s.title, s.columns.map(csvCell).join(','), ...s.rows.map((r) => r.map(csvCell).join(','))].join('\r\n'))
    .join('\r\n\r\n');
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
      columns: ['Feedback', 'Positive', 'Neutral', 'Negative', 'Not classified', 'Average rating', 'Average score'],
      rows: [[t.total, t.positive, t.neutral, t.negative, t.pending, t.avg_rating, t.avg_score]],
    },
    {
      title: 'Sentiment by week',
      columns: ['Week of', 'Feedback', 'Positive', 'Neutral', 'Negative', 'Not classified', 'Average rating'],
      rows: r.by_week.map((w) => [w.week, w.total, w.positive, w.neutral, w.negative, w.pending, w.avg_rating]),
    },
    {
      title: 'Sentiment by tournament',
      columns: ['Tournament', 'Feedback', 'Positive', 'Neutral', 'Negative', 'Not classified', 'Average rating', 'Average score'],
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
  ];
}

// "Final · Match 1", or '' when the stream isn't linked to one match
export function streamMatchLabel(s: EngagementReport['streams'][number]) {
  if (s.round === null || s.match_number === null) return '';
  return `${roundLabel(s.round, s.round_count ?? s.round)} · Match ${s.match_number}`;
}
