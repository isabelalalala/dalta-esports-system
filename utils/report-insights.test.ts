import { describe, expect, it } from 'vitest';
import {
  acceptDraft, buildInsightRequest, fmtDay, numbersIn, onlyKnownNumbers, rulesInsights,
} from './report-insights';
import {
  combineSentiment, registrationsOverTime, sentimentForSource, sentimentShareByWeek, weekStart,
  type FullReport, type SentimentReport,
} from './reports';

const sentiment = (overrides: Partial<SentimentReport> = {}): SentimentReport => ({
  totals: { total: 20, positive: 12, neutral: 4, negative: 4, pending: 0, avg_rating: 4.2, avg_score: 0.3 },
  by_week: [
    { week: '2026-10-26', total: 10, positive: 5, neutral: 2, negative: 3, pending: 0, avg_rating: 4 },
    { week: '2026-11-02', total: 10, positive: 7, neutral: 2, negative: 1, pending: 0, avg_rating: 4.4 },
  ],
  by_tournament: [
    { tournament_id: 't1', tournament_name: 'SLEC MLBB', total: 20, positive: 12, neutral: 4, negative: 4, pending: 0, avg_rating: 4.2, avg_score: 0.3 },
  ],
  topics: [
    { topic: 'stream quality', total: 8, positive: 2, neutral: 1, negative: 5 },
    { topic: 'casting', total: 6, positive: 6, neutral: 0, negative: 0 },
  ],
  negative_examples: [],
  ...overrides,
});

const report = (): FullReport => ({
  activity: {
    totals: { users: 10, tournaments: 1, registrations: 6, teams: 6, players_in_teams: 30, matches_played: 2, matches_total: 5 },
    users_by_role: [{ role: 'player', count: 8 }, { role: 'spectator', count: 2 }],
    signups_by_month: [{ month: '2026-10-01', count: 4 }, { month: '2026-11-01', count: 6 }],
    registrations_by_status: [{ status: 'approved', count: 4 }, { status: 'pending', count: 2 }],
    matches_by_status: [{ status: 'completed', count: 2 }, { status: 'scheduled', count: 3 }],
    teams_by_game: [{ game: 'MLBB', count: 5 }, { game: 'Tekken 8', count: 1 }],
    registrations_by_day: [
      { day: '2026-11-01', total: 2, approved: 1 },
      { day: '2026-11-04', total: 4, approved: 3 },
    ],
    tournaments: [],
  },
  sentiment: sentiment(),
  engagement: {
    totals: { streams: 2, live_streams: 0, views: 40, unique_viewers: 25, feedback: 20, avg_rating: 4.2 },
    streams: [
      { id: 's1', title: 'Finals', status: 'ended', tournament_name: 'SLEC MLBB', game: 'MLBB', round: null, match_number: null, round_count: null, views: 30, unique_viewers: 20 },
      { id: 's2', title: 'Groups', status: 'ended', tournament_name: 'SLEC MLBB', game: 'MLBB', round: null, match_number: null, round_count: null, views: 10, unique_viewers: 5 },
    ],
    views_by_day: [{ day: '2026-11-05', views: 40, unique_viewers: 25 }],
    feedback_by_tournament: [],
  },
  comments: {
    ...sentiment({
      totals: { total: 10, positive: 2, neutral: 3, negative: 5, pending: 1, avg_rating: null, avg_score: -0.2 },
      by_week: [{ week: '2026-11-02', total: 10, positive: 2, neutral: 3, negative: 5, pending: 1, avg_rating: null }],
    }),
    by_stream: [{ stream_id: 's1', title: 'Finals', tournament_name: 'SLEC MLBB', total: 7 }],
  },
});

describe('report data helpers', () => {
  it('fills missing days with zero', () => {
    const { unit, points } = registrationsOverTime(report().activity.registrations_by_day);
    expect(unit).toBe('day');
    expect(points.map((p) => p.total)).toEqual([2, 0, 0, 4]);
  });

  it('switches to weeks for long periods', () => {
    const { unit, points } = registrationsOverTime([
      { day: '2026-01-05', total: 1, approved: 1 },
      { day: '2026-04-01', total: 2, approved: 0 },
    ]);
    expect(unit).toBe('week');
    expect(points[0].date).toBe('2026-01-05');
    expect(points.reduce((a, p) => a + p.total, 0)).toBe(3);
  });

  it('uses Monday weeks like Postgres', () => {
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // a Sunday
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
  });

  it('computes weekly shares from analysed items only', () => {
    expect(sentimentShareByWeek(sentiment().by_week)[1]).toMatchObject({ positive: 70, negative: 10, analysed: 10 });
  });

  it('combines feedback and comments', () => {
    const all = combineSentiment(sentiment(), report().comments!);
    expect(all.totals).toMatchObject({ total: 30, positive: 14, negative: 9, pending: 1, avg_rating: 4.2 });
    expect(all.by_week.find((w) => w.week === '2026-11-02')?.positive).toBe(9);
    expect(all.topics[0]).toMatchObject({ topic: 'stream quality', total: 16 });
  });

  it('picks the data source', () => {
    const r = report();
    expect(sentimentForSource(r, 'feedback')).toBe(r.sentiment);
    expect(sentimentForSource(r, 'comments')).toBe(r.comments);
    expect(sentimentForSource({ ...r, comments: undefined }, 'comments')).toBe(r.sentiment);
  });
});

describe('interpretation facts', () => {
  const request = buildInsightRequest(report(), 'feedback', 'All tournaments');
  const chart = (id: string) => request.charts.find((c) => c.id === id)!;

  it('states the sentiment trend from the real numbers', () => {
    expect(chart('sentiment_trend').facts[0]).toBe(
      'The positive share went from 50% in the week of Oct 26 to 70% in the week of Nov 2 (up 20 percentage points).',
    );
  });

  it('describes the distribution with percentages and rating', () => {
    expect(chart('sentiment_distribution').facts).toEqual([
      'Of 20 analysed feedback entries, 60% were positive, 20% neutral and 20% negative.',
      'The average star rating of the feedback was 4.2 out of 5.',
    ]);
  });

  it('joins comments into engagement per stream', () => {
    expect(chart('views_per_stream').facts).toContain('"Finals" had the most comments (7).');
  });

  it('skips charts without data', () => {
    expect(request.charts.find((c) => c.id === 'warnings_over_time')).toBeUndefined();
  });

  it('builds findings and rule-based recommendations', () => {
    expect(request.findings[0]).toBe('6 registrations were received, and 67% of them are approved.');
    expect(request.recommendations).toContain('Review the 2 pending registrations before the registration deadlines.');
    expect(request.recommendations.some((r) => r.includes('"stream quality"'))).toBe(true);
  });

  it('formats days without the locale', () => {
    expect(fmtDay('2026-11-05')).toBe('Nov 5');
  });
});

describe('checking the AI wording', () => {
  const request = buildInsightRequest(report(), 'feedback', 'All tournaments');

  it('extracts normalised numbers', () => {
    expect(numbersIn('1,250 views, 63% and 4.0 stars')).toEqual(['1250', '63', '4']);
    expect(onlyKnownNumbers('Up to 70%', new Set(['70']))).toBe(true);
    expect(onlyKnownNumbers('About 71%', new Set(['70']))).toBe(false);
  });

  it('keeps wording whose numbers all come from the facts', () => {
    const result = acceptDraft({
      charts: [{ id: 'sentiment_trend', text: 'Feedback became more positive: 50% in the week of Oct 26, 70% by Nov 2.' }],
      findings: ['6 registrations came in and 67% are approved.'],
      recommendations: ['Look at "stream quality" first.'],
    }, request);
    expect(result.writer).toBe('gemini');
    expect(result.charts.sentiment_trend).toContain('70% by Nov 2');
    expect(result.findings).toEqual(['6 registrations came in and 67% are approved.']);
  });

  it('falls back when the AI adds a number', () => {
    const result = acceptDraft({
      charts: [{ id: 'sentiment_trend', text: 'Positive feedback rose by 25% after the update.' }],
      findings: ['Attendance grew by 300%.'],
      recommendations: [],
    }, request);
    expect(result.charts.sentiment_trend).toBe(rulesInsights(request).charts.sentiment_trend);
    expect(result.findings).toEqual(request.findings);
    expect(result.note).toBeTruthy();
  });

  it('survives garbage', () => {
    const result = acceptDraft('not an object', request);
    expect(result.writer).toBe('rules');
    expect(result.charts).toEqual(rulesInsights(request).charts);
  });
});
