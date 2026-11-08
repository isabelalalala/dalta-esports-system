// Written interpretations for the administrative report (Phase 5).
//
// How it works, so the AI can never invent a number:
// 1. buildInsightRequest() computes the statistics in code and writes them as plain "facts"
//    (short sentences with the real numbers) for every chart, plus key findings and
//    recommendations chosen by fixed rules.
// 2. On the server, Gemini only REWORDS those facts into 2-3 readable sentences per chart
//    (utils/gemini.ts writeReportInsights, called by POST /api/reports/generate).
// 3. acceptDraft() checks every number in Gemini's text against the numbers in the facts. Any text
//    with a number that isn't in the facts (or the wrong length) is thrown away and the computed
//    sentences are used instead (rulesInsights). Without Gemini, the computed sentences are shown.
//
// No server-only imports: the report page also uses rulesInsights() for reports saved before
// Phase 5, and the unit tests run it directly.
import {
  registrationsOverTime, sentimentForSource, sentimentShareByWeek, sourceNoun,
  type DataSource, type FullReport, type SentimentReport,
} from '@/utils/reports';
import { getTournamentStatus, statusLabels } from '@/utils/tournaments';

// Every chart that gets an interpretation, with the title shown on the report
export const CHART_TITLES = {
  registrations_over_time: 'Registrations over time',
  teams_per_game: 'Teams per game',
  users_by_role: 'New accounts by role',
  signups_per_month: 'Sign-ups per month',
  tournaments_by_status: 'Tournaments by status',
  registrations_by_status: 'Registrations by status',
  matches_by_status: 'Matches by status',
  sentiment_distribution: 'Sentiment distribution',
  sentiment_trend: 'Sentiment trend',
  top_topics: 'Top topics',
  sentiment_per_tournament: 'Sentiment per tournament',
  views_per_stream: 'Engagement per stream',
  views_per_day: 'Views per day',
  moderation_outcomes: 'Moderation outcomes',
  warnings_over_time: 'Warnings over time',
  offense_types: 'Offense types',
} as const;

export type ChartId = keyof typeof CHART_TITLES;

// What is saved with the report (analytics_reports.data.insights)
export interface ReportInsights {
  charts: Partial<Record<ChartId, string>>;
  findings: string[];
  recommendations: string[];
  // Who wrote the wording: Gemini (numbers checked) or the computed sentences
  writer: 'gemini' | 'rules';
  // Why some or all of the text uses the computed sentences
  note?: string;
}

// What Gemini receives: only computed sentences and filter names (no personal data)
export interface InsightRequest {
  context: string;
  charts: { id: ChartId; title: string; facts: string[] }[];
  findings: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Small formatting helpers (fixed English month names: the server's locale must not matter)
// ---------------------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Nov 5" for 2026-11-05
export function fmtDay(day: string) {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

// "Nov 2026" for 2026-11-01
export function fmtMonth(day: string) {
  const [y, m] = day.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

const n = (value: unknown) => Number(value ?? 0);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
// "3 registrations were" / "1 registration was"
const wasWere = (count: number, one: string, many = `${one}s`) => `${plural(count, one, many)} ${count === 1 ? 'was' : 'were'}`;
const isAre = (count: number) => (count === 1 ? 'is' : 'are');
const wasWord = (count: number) => (count === 1 ? 'was' : 'were');
const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
// "up 15 percentage points" / "down 4 percentage points" / "no change"
const change = (diff: number) =>
  diff === 0 ? 'no change' : `${diff > 0 ? 'up' : 'down'} ${plural(Math.abs(diff), 'percentage point')}`;
const sum = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
const maxBy = <T>(rows: T[], pick: (row: T) => number) =>
  rows.reduce<T | undefined>((best, row) => (best === undefined || pick(row) > pick(best) ? row : best), undefined);

export const OFFENSE_LABELS: Record<string, string> = {
  bullying: 'bullying',
  harassment: 'harassment',
  hate_speech: 'hate speech',
  threat: 'threats',
  sexual: 'sexual content',
};

// ---------------------------------------------------------------------------
// Facts per chart. Each returns [] when the chart has no data (the chart then shows "No data"
// and gets no interpretation). The most important fact comes first: without Gemini the first
// three are shown.
// ---------------------------------------------------------------------------
function registrationsFacts(data: FullReport) {
  const { unit, points } = registrationsOverTime(data.activity.registrations_by_day);
  const total = sum(points, (p) => p.total);
  if (total === 0) return [];
  const approved = sum(points, (p) => p.approved);
  const peak = maxBy(points, (p) => p.total)!;
  const facts = [
    `${wasWere(total, 'registration')} made between ${fmtDay(points[0].date)} and ${fmtDay(points[points.length - 1].date)}.`,
    `The busiest ${unit} was ${unit === 'week' ? 'the week of ' : ''}${fmtDay(peak.date)} with ${plural(peak.total, 'registration')}.`,
    `${approved} of them (${pct(approved, total)}%) are approved.`,
  ];
  if (points.length >= 4) {
    const half = Math.floor(points.length / 2);
    const first = sum(points.slice(0, half), (p) => p.total);
    const second = sum(points.slice(half), (p) => p.total);
    facts.push(`The second half of the period had ${plural(second, 'registration')}, compared with ${first} in the first half.`);
  }
  return facts;
}

function teamsFacts(data: FullReport) {
  const rows = [...data.activity.teams_by_game].sort((a, b) => n(b.count) - n(a.count));
  const total = sum(rows, (r) => n(r.count));
  if (total === 0) return [];
  const top = rows[0];
  const facts = [`${top.game} has the most teams: ${n(top.count)} of ${total} (${pct(n(top.count), total)}%).`];
  if (rows.length > 1) {
    const last = rows[rows.length - 1];
    facts.push(`${last.game} has the fewest, with ${plural(n(last.count), 'team')}.`);
  }
  facts.push(`Teams were created for ${plural(rows.length, 'game')} in this period.`);
  return facts;
}

function usersFacts(data: FullReport) {
  const rows = [...data.activity.users_by_role].sort((a, b) => n(b.count) - n(a.count));
  const total = sum(rows, (r) => n(r.count));
  if (total === 0) return [];
  const facts = [`${wasWere(total, 'new account')} created: ${joinList(rows.map((r) => plural(n(r.count), r.role)))}.`];
  facts.push(`${cap(rows[0].role)}s make up ${pct(n(rows[0].count), total)}% of the new accounts.`);
  return facts;
}

function signupsFacts(data: FullReport) {
  const rows = data.activity.signups_by_month;
  if (rows.length === 0) return [];
  const peak = maxBy(rows, (r) => n(r.count))!;
  const facts = [`Sign-ups peaked in ${fmtMonth(peak.month)} with ${plural(n(peak.count), 'new account')}.`];
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    facts.push(`The latest month, ${fmtMonth(last.month)}, had ${n(last.count)}, compared with ${n(prev.count)} in ${fmtMonth(prev.month)}.`);
  }
  return facts;
}

// Same status logic as ActivitySection (from the dates, like everywhere in the app)
export function tournamentStatusCounts(data: FullReport) {
  const counts = new Map<string, number>();
  for (const t of data.activity.tournaments) {
    const label = statusLabels[getTournamentStatus(t)];
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return counts;
}

function tournamentsFacts(data: FullReport) {
  const counts = [...tournamentStatusCounts(data).entries()].sort((a, b) => b[1] - a[1]);
  const total = sum(counts, (c) => c[1]);
  if (total === 0) return [];
  return [
    `This report covers ${plural(total, 'tournament')}: ${joinList(counts.map(([label, count]) => `${count} ${label.toLowerCase()}`))}.`,
  ];
}

function statusCount(rows: { status: string; count: number }[], status: string) {
  return n(rows.find((r) => r.status === status)?.count);
}

function registrationStatusFacts(data: FullReport) {
  const rows = data.activity.registrations_by_status;
  const total = sum(rows, (r) => n(r.count));
  if (total === 0) return [];
  const approved = statusCount(rows, 'approved');
  const facts = [`${approved} of ${total} registrations (${pct(approved, total)}%) were approved.`];
  const pending = statusCount(rows, 'pending');
  if (pending > 0) facts.push(`${pending} ${isAre(pending)} still pending.`);
  const rejected = statusCount(rows, 'rejected');
  const cancelled = statusCount(rows, 'cancelled');
  if (rejected + cancelled > 0) facts.push(`${rejected} ${wasWord(rejected)} rejected and ${cancelled} ${wasWord(cancelled)} cancelled.`);
  return facts;
}

function matchStatusFacts(data: FullReport) {
  const rows = data.activity.matches_by_status;
  const total = sum(rows, (r) => n(r.count));
  if (total === 0) return [];
  const completed = statusCount(rows, 'completed');
  const facts = [`${completed} of ${total} matches (${pct(completed, total)}%) are completed.`];
  const live = statusCount(rows, 'live');
  const scheduled = statusCount(rows, 'scheduled');
  facts.push(`${scheduled} ${isAre(scheduled)} scheduled and ${live} ${isAre(live)} live right now.`);
  return facts;
}

function analysedCount(t: { positive: number; neutral: number; negative: number }) {
  return n(t.positive) + n(t.neutral) + n(t.negative);
}

function distributionFacts(s: SentimentReport, noun: string) {
  const t = s.totals;
  const analysed = analysedCount(t);
  if (n(t.total) === 0) return [];
  if (analysed === 0) return [`None of the ${n(t.total)} ${noun} have been analysed yet.`];
  const facts = [
    `Of ${analysed} analysed ${noun}, ${pct(n(t.positive), analysed)}% were positive, ` +
      `${pct(n(t.neutral), analysed)}% neutral and ${pct(n(t.negative), analysed)}% negative.`,
  ];
  if (n(t.pending) > 0) facts.push(`${n(t.pending)} more ${isAre(n(t.pending))} still waiting for analysis and not counted.`);
  if (t.avg_rating !== null && t.avg_rating !== undefined) {
    facts.push(`The average star rating of the feedback was ${Number(t.avg_rating).toFixed(1)} out of 5.`);
  }
  return facts;
}

export function trendWeeks(s: SentimentReport) {
  return sentimentShareByWeek(s.by_week);
}

function trendFacts(s: SentimentReport, noun: string) {
  const weeks = trendWeeks(s);
  if (weeks.length === 0) return [];
  if (weeks.length === 1) {
    return [`All analysed ${noun} are from the week of ${fmtDay(weeks[0].week)} (${weeks[0].positive}% positive), so there is no trend yet.`];
  }
  const a = weeks[0];
  const b = weeks[weeks.length - 1];
  const best = maxBy(weeks, (w) => w.positive)!;
  return [
    `The positive share went from ${a.positive}% in the week of ${fmtDay(a.week)} to ${b.positive}% in the week of ${fmtDay(b.week)} (${change(b.positive - a.positive)}).`,
    `The negative share went from ${a.negative}% to ${b.negative}% over the same weeks.`,
    `The most positive week was the week of ${fmtDay(best.week)}, at ${best.positive}% of ${best.analysed} analysed.`,
  ];
}

export function topTopics(s: SentimentReport) {
  return [...s.topics].sort((a, b) => n(b.total) - n(a.total)).slice(0, 10);
}

function topicFacts(s: SentimentReport) {
  const topics = topTopics(s);
  if (topics.length === 0) return [];
  const top = topics[0];
  const facts = [
    `"${top.topic}" was the most mentioned topic (${plural(n(top.total), 'mention')}: ${n(top.positive)} positive, ${n(top.negative)} negative).`,
  ];
  const worst = maxBy(topics.filter((t) => n(t.negative) > 0), (t) => n(t.negative));
  if (worst) facts.push(`"${worst.topic}" had the most negative mentions (${n(worst.negative)} of ${n(worst.total)}).`);
  const best = maxBy(topics.filter((t) => n(t.positive) > 0), (t) => n(t.positive));
  if (best && best.topic !== top.topic) facts.push(`"${best.topic}" received the most praise (${plural(n(best.positive), 'positive mention')}).`);
  return facts;
}

function perTournamentFacts(s: SentimentReport, noun: string) {
  const rows = s.by_tournament;
  if (rows.length === 0) return [];
  const name = (r: SentimentReport['by_tournament'][number]) => r.tournament_name ?? 'General feedback';
  const most = maxBy(rows, (r) => n(r.total))!;
  const facts = [`${name(most)} received the most ${noun} (${n(most.total)}).`];
  const analysed = rows.filter((r) => analysedCount(r) > 0);
  if (analysed.length >= 2) {
    const share = (r: (typeof rows)[number]) => pct(n(r.positive), analysedCount(r));
    const best = maxBy(analysed, share)!;
    const worst = maxBy(analysed, (r) => -share(r))!;
    facts.push(
      `The highest positive share was ${name(best)} (${share(best)}% of ${analysedCount(best)} analysed) and the lowest was ` +
        `${name(worst)} (${share(worst)}% of ${analysedCount(worst)}).`,
    );
  }
  return facts;
}

// Views per stream joined with comments per stream (by stream id)
export function streamEngagement(data: FullReport) {
  const comments = new Map((data.comments?.by_stream ?? []).map((c) => [c.stream_id, n(c.total)]));
  return data.engagement.streams.map((s) => ({
    id: s.id,
    title: s.title,
    views: n(s.views),
    unique_viewers: n(s.unique_viewers),
    comments: comments.get(s.id) ?? 0,
  }));
}

function streamFacts(data: FullReport) {
  const streams = streamEngagement(data);
  const withViews = streams.filter((s) => s.views > 0);
  const withComments = streams.filter((s) => s.comments > 0);
  if (withViews.length === 0 && withComments.length === 0) return [];
  const facts: string[] = [];
  const totalViews = sum(streams, (s) => s.views);
  if (withViews.length > 0) {
    const top = maxBy(withViews, (s) => s.views)!;
    facts.push(`"${top.title}" had the most views: ${plural(top.views, 'view')} from ${plural(top.unique_viewers, 'unique viewer')}.`);
    if (withViews.length > 1) facts.push(`That is ${pct(top.views, totalViews)}% of all ${totalViews} views.`);
  }
  if (data.comments && withComments.length > 0) {
    const top = maxBy(withComments, (s) => s.comments)!;
    facts.push(`"${top.title}" had the most comments (${top.comments}).`);
  }
  const zero = streams.length - withViews.length;
  if (zero > 0) facts.push(`${zero} of ${plural(streams.length, 'stream')} had no recorded views.`);
  return facts;
}

function viewsPerDayFacts(data: FullReport) {
  const days = data.engagement.views_by_day.filter((d) => n(d.views) > 0);
  if (days.length === 0) return [];
  const peak = maxBy(days, (d) => n(d.views))!;
  const total = sum(days, (d) => n(d.views));
  return [
    `Views peaked on ${fmtDay(peak.day)} with ${plural(n(peak.views), 'view')} from ${plural(n(peak.unique_viewers), 'unique viewer')}.`,
    `There were ${plural(total, 'view')} over ${plural(days.length, 'day')} with viewing, about ${Math.round(total / days.length)} per day.`,
  ];
}

function moderationFacts(data: FullReport) {
  const m = data.moderation?.totals;
  if (!m || n(m.comments) + n(m.feedback) === 0) return [];
  const facts: string[] = [];
  const touched = n(m.comments_hidden) + n(m.comments_removed) + n(m.comments_restored) + n(m.feedback_hidden) + n(m.feedback_removed);
  if (touched === 0) facts.push(`No comment or feedback had to be hidden or removed (${plural(n(m.comments), 'comment')} and ${n(m.feedback)} feedback entries checked).`);
  else {
    facts.push(
      `${plural(n(m.comments_hidden), 'comment')} ${isAre(n(m.comments_hidden))} hidden as offensive and waiting for review, ` +
        `${n(m.comments_removed)} ${wasWord(n(m.comments_removed))} removed and ${n(m.comments_restored)} ` +
        `${wasWord(n(m.comments_restored))} restored by a moderator.`,
    );
  }
  if (n(m.comments) > 0) facts.push(`${n(m.comments_profane)} of ${plural(n(m.comments), 'comment')} contained profanity but stayed visible.`);
  if (n(m.feedback_hidden) + n(m.feedback_removed) > 0) {
    facts.push(`${plural(n(m.feedback_hidden), 'feedback entry', 'feedback entries')} ${isAre(n(m.feedback_hidden))} hidden and ${n(m.feedback_removed)} ${wasWord(n(m.feedback_removed))} removed.`);
  }
  return facts;
}

function warningFacts(data: FullReport) {
  const m = data.moderation;
  if (!m || n(m.totals.warnings) === 0) return [];
  const t = m.totals;
  const facts = [
    `${wasWere(n(t.warnings), 'warning')} issued: ${n(t.profanity_warnings)} for profanity and ${n(t.offensive_warnings)} for offensive content.`,
    `${n(t.ai_warnings)} came from the AI and ${n(t.moderator_warnings)} from moderators; ${n(t.removed_warnings)} ${n(t.removed_warnings) === 1 ? 'was' : 'were'} later removed.`,
  ];
  if (n(t.accounts_flagged) + n(t.accounts_banned) > 0) {
    facts.push(`${plural(n(t.accounts_flagged), 'account')} reached 5 warnings and ${n(t.accounts_banned)} ${n(t.accounts_banned) === 1 ? 'was' : 'were'} banned.`);
  }
  if (m.warnings_by_week.length > 1) {
    const peak = maxBy(m.warnings_by_week, (w) => n(w.profanity) + n(w.offensive))!;
    facts.push(`The busiest week was the week of ${fmtDay(peak.week)} with ${plural(n(peak.profanity) + n(peak.offensive), 'warning')}.`);
  }
  return facts;
}

function offenseFacts(data: FullReport) {
  const rows = [...(data.moderation?.offense_types ?? [])].sort((a, b) => n(b.count) - n(a.count));
  const total = sum(rows, (r) => n(r.count));
  if (total === 0) return [];
  const label = (type: string) => OFFENSE_LABELS[type] ?? type;
  const facts = [`${cap(label(rows[0].offense_type))} was the most common offense (${n(rows[0].count)} of ${total} offensive items).`];
  if (rows.length > 1) facts.push(`Next was ${label(rows[1].offense_type)} with ${n(rows[1].count)}.`);
  return facts;
}

// ---------------------------------------------------------------------------
// Key findings and recommendations (fixed rules on the same numbers)
// ---------------------------------------------------------------------------
function summary(data: FullReport, s: SentimentReport, noun: string) {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const a = data.activity;

  const regTotal = sum(a.registrations_by_status, (r) => n(r.count));
  if (regTotal > 0) {
    const approved = statusCount(a.registrations_by_status, 'approved');
    findings.push(`${wasWere(regTotal, 'registration')} received, and ${pct(approved, regTotal)}% of them are approved.`);
  }
  const teams = [...a.teams_by_game].sort((x, y) => n(y.count) - n(x.count));
  const teamTotal = sum(teams, (r) => n(r.count));
  if (teamTotal > 0) findings.push(`${teams[0].game} is the most popular game with ${n(teams[0].count)} of ${plural(teamTotal, 'new team')}.`);

  const dist = distributionFacts(s, noun);
  if (dist.length > 0) findings.push(dist[0]);
  const weeks = trendWeeks(s);
  if (weeks.length >= 2) findings.push(trendFacts(s, noun)[0]);
  const concern = maxBy(topTopics(s).filter((t) => n(t.negative) > 0), (t) => n(t.negative));
  if (concern) findings.push(`The main concern in negative ${noun} was "${concern.topic}" (${plural(n(concern.negative), 'negative mention')}).`);

  const e = data.engagement.totals;
  if (n(e.streams) > 0) {
    findings.push(`${plural(n(e.streams), 'stream')} drew ${plural(n(e.views), 'view')} from ${plural(n(e.unique_viewers), 'unique viewer')}.`);
  }
  const m = data.moderation?.totals;
  if (m && n(m.warnings) > 0) {
    const hiddenOrRemoved = n(m.comments_hidden) + n(m.comments_removed);
    findings.push(`${wasWere(n(m.warnings), 'warning')} issued and ${wasWere(hiddenOrRemoved, 'comment')} hidden or removed.`);
  }

  // Recommendations, most urgent first
  const analysed = analysedCount(s.totals);
  const negShare = pct(n(s.totals.negative), analysed);
  if (concern && negShare >= 25) {
    recommendations.push(`Look into "${concern.topic}": negative ${noun} make up ${negShare}% and this is their most common topic (${n(concern.negative)} mentions).`);
  } else if (concern) {
    recommendations.push(`Keep an eye on "${concern.topic}", the most common topic in negative ${noun} (${plural(n(concern.negative), 'mention')}).`);
  }
  if (weeks.length >= 2) {
    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    if (last.positive - first.positive <= -10) {
      recommendations.push(`Find out what changed before the week of ${fmtDay(last.week)}: the positive share fell from ${first.positive}% to ${last.positive}%.`);
    } else if (last.positive - first.positive >= 10) {
      recommendations.push(`Keep what changed before the week of ${fmtDay(last.week)}: the positive share rose from ${first.positive}% to ${last.positive}%.`);
    }
  }
  if (m && n(m.comments_hidden) + n(m.feedback_hidden) > 0) {
    const hidden = n(m.comments_hidden) + n(m.feedback_hidden);
    recommendations.push(`Review the ${plural(hidden, 'hidden item')} on the Moderation page so ${hidden === 1 ? "it doesn't" : "they don't"} stay waiting.`);
  }
  if (m && n(m.pending_bans_now) > 0) {
    recommendations.push(`Decide on the ${plural(n(m.pending_bans_now), 'account')} waiting for a ban decision.`);
  }
  if (m && n(m.offensive_warnings) >= 3) {
    recommendations.push(`Remind viewers of the Code of Conduct before streams: ${n(m.offensive_warnings)} warnings were for offensive content.`);
  }
  const pendingRegs = statusCount(a.registrations_by_status, 'pending');
  if (pendingRegs > 0) recommendations.push(`Review the ${plural(pendingRegs, 'pending registration')} before the registration deadlines.`);
  if (n(s.totals.pending) > 0) {
    recommendations.push(`Retry the ${n(s.totals.pending)} ${noun} still waiting for AI analysis, then generate the report again.`);
  }
  const streams = streamEngagement(data);
  const withViews = streams.filter((x) => x.views > 0);
  const totalViews = sum(streams, (x) => x.views);
  const topStream = maxBy(withViews, (x) => x.views);
  if (topStream && withViews.length >= 2 && pct(topStream.views, totalViews) >= 60) {
    recommendations.push(`Promote the other streams: "${topStream.title}" alone drew ${pct(topStream.views, totalViews)}% of all views.`);
  }
  const zeroViews = streams.length - withViews.length;
  if (zeroViews > 0) recommendations.push(`Share stream links earlier: ${plural(zeroViews, 'stream')} had no recorded views.`);
  if (teams.length >= 2) {
    const last = teams[teams.length - 1];
    if (n(last.count) * 3 <= n(teams[0].count)) {
      recommendations.push(`Reach out to ${last.game} players: it has ${plural(n(last.count), 'new team')} compared with ${n(teams[0].count)} for ${teams[0].game}.`);
    }
  }
  if (recommendations.length === 0) {
    recommendations.push('No problems stand out in these numbers. Keep the current approach and compare with the next report.');
  }

  return { findings: findings.slice(0, 6), recommendations: recommendations.slice(0, 5) };
}

// Everything the report's text is built from. filtersText = describeFilters(...) of the report.
export function buildInsightRequest(data: FullReport, source: DataSource | undefined, filtersText: string): InsightRequest {
  const s = sentimentForSource(data, source);
  const noun = sourceNoun(data, source);
  const facts: Record<ChartId, string[]> = {
    registrations_over_time: registrationsFacts(data),
    teams_per_game: teamsFacts(data),
    users_by_role: usersFacts(data),
    signups_per_month: signupsFacts(data),
    tournaments_by_status: tournamentsFacts(data),
    registrations_by_status: registrationStatusFacts(data),
    matches_by_status: matchStatusFacts(data),
    sentiment_distribution: distributionFacts(s, noun),
    sentiment_trend: trendFacts(s, noun),
    top_topics: topicFacts(s),
    sentiment_per_tournament: perTournamentFacts(s, noun),
    views_per_stream: streamFacts(data),
    views_per_day: viewsPerDayFacts(data),
    moderation_outcomes: moderationFacts(data),
    warnings_over_time: warningFacts(data),
    offense_types: offenseFacts(data),
  };
  return {
    context: `DALTA Esports administrative report for the Organizing Committee. Filters: ${filtersText}.`,
    charts: (Object.keys(CHART_TITLES) as ChartId[])
      .filter((id) => facts[id].length > 0)
      .map((id) => ({ id, title: CHART_TITLES[id], facts: facts[id] })),
    ...summary(data, s, noun),
  };
}

// The computed sentences as the report text (no AI): the first three facts of each chart
export function rulesInsights(request: InsightRequest, note?: string): ReportInsights {
  const charts: ReportInsights['charts'] = {};
  for (const c of request.charts) charts[c.id] = c.facts.slice(0, 3).join(' ');
  return { charts, findings: request.findings, recommendations: request.recommendations, writer: 'rules', ...(note ? { note } : {}) };
}

// ---------------------------------------------------------------------------
// Checking the AI's wording
// ---------------------------------------------------------------------------

// Every number in a text, normalised: "1,250" -> "1250", "4.0" -> "4", "63%" -> "63"
export function numbersIn(text: string): string[] {
  const clean = text.replace(/(\d),(?=\d{3}\b)/g, '$1');
  return (clean.match(/\d+(?:\.\d+)?/g) ?? []).map((x) => String(Number(x)));
}

function allowedNumbers(texts: string[]) {
  return new Set(texts.flatMap(numbersIn));
}

// True when every number in text also appears in the allowed set
export function onlyKnownNumbers(text: string, allowed: Set<string>) {
  return numbersIn(text).every((x) => allowed.has(x));
}

// 1-4 sentences, not empty, not an essay
function sentenceCount(text: string) {
  return text.split(/[.!?](?:\s|$)/).filter((part) => part.trim().length > 0).length;
}

function validText(value: unknown, allowed: Set<string>, maxLength: number, maxSentences: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 10 &&
    value.length <= maxLength &&
    sentenceCount(value) <= maxSentences &&
    onlyKnownNumbers(value, allowed)
  );
}

// Takes Gemini's answer (already JSON-parsed, shape unknown) and keeps only the parts that pass the
// checks; everything else falls back to the computed sentences.
export function acceptDraft(draft: unknown, request: InsightRequest): ReportInsights {
  const fallback = rulesInsights(request);
  const d = (draft && typeof draft === 'object' ? draft : {}) as {
    charts?: unknown; findings?: unknown; recommendations?: unknown;
  };
  const drafted = new Map<string, unknown>();
  if (Array.isArray(d.charts)) {
    for (const c of d.charts) {
      if (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string') {
        drafted.set((c as { id: string }).id, (c as { text?: unknown }).text);
      }
    }
  }

  const charts: ReportInsights['charts'] = {};
  let rejected = 0;
  let accepted = 0;
  for (const c of request.charts) {
    const allowed = allowedNumbers([...c.facts, request.context]);
    const text = drafted.get(c.id);
    if (validText(text, allowed, 700, 4)) {
      charts[c.id] = text.trim();
      accepted++;
    } else {
      charts[c.id] = fallback.charts[c.id];
      rejected++;
    }
  }

  // Findings and recommendations may combine numbers from any chart
  const allAllowed = allowedNumbers([
    request.context, ...request.findings, ...request.recommendations, ...request.charts.flatMap((c) => c.facts),
  ]);
  const listOk = (value: unknown, max: number): value is string[] =>
    Array.isArray(value) && value.length >= 1 && value.length <= max && value.every((x) => validText(x, allAllowed, 320, 2));
  const findingsOk = listOk(d.findings, 8);
  const recommendationsOk = listOk(d.recommendations, 6);
  if (!findingsOk) rejected++;
  if (!recommendationsOk) rejected++;

  const usedAi = accepted > 0 || findingsOk || recommendationsOk;
  return {
    charts,
    findings: findingsOk ? (d.findings as string[]).map((x) => x.trim()) : fallback.findings,
    recommendations: recommendationsOk ? (d.recommendations as string[]).map((x) => x.trim()) : fallback.recommendations,
    writer: usedAi ? 'gemini' : 'rules',
    ...(rejected > 0
      ? { note: `${plural(rejected, 'part')} of the AI wording failed the number check or length limit, so the computed sentences are shown there.` }
      : {}),
  };
}
