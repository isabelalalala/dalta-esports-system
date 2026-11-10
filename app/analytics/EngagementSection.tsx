'use client';

import ReportChart from '@/components/ReportChart';
import { streamMatchLabel, type CommentReport, type EngagementReport } from '@/utils/reports';
import { formatTime } from '@/utils/tournaments';
import { NoData, ReportCard, ReportTable, StatTile, capitalize, formatDay, formatRating, type Insights } from './ReportParts';
import LivePulse from '@/components/LivePulse';

interface Props {
  report: EngagementReport;
  // Stream id -> people watching right now. Only given on the live engagement page,
  // not for saved reports (a saved "now" would be out of date).
  liveCounts?: Record<string, number>;
  // Comments per stream (admin report, since Phase 5): shown next to the views
  comments?: CommentReport['by_stream'];
  // Sentiment per minute of the busiest streams (admin report since 202611101000)
  timeline?: CommentReport['timeline'];
  insights?: Insights;
}

// "62.5%", or "–" when there's nothing to divide by
function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '–' : `${Number(value)}%`;
}

// "Viewership & Audience Engagement Stats" (Tournament Staff, also part of the admin's report)
export default function EngagementSection({ report, liveCounts, comments, timeline, insights = {} }: Props) {
  // The busiest stream's chat, minute by minute (the report keeps the 5 busiest; the chart shows
  // the first, the interpretation says when it peaked)
  const busiest = timeline?.[0];
  const t = report.totals;
  const commentCounts = new Map((comments ?? []).map((c) => [c.stream_id, Number(c.total)]));
  const topStreams = report.streams
    .filter((s) => s.views > 0 || (commentCounts.get(s.id) ?? 0) > 0)
    .slice(0, 10);
  const watchingNow = liveCounts ? Object.values(liveCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <section className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-black text-amber-800 uppercase tracking-wider print:text-black">
        Viewership &amp; Audience Engagement
      </h2>
      <p className="text-xs text-stone-500 font-medium normal-case print:text-stone-600">
        A view = one logged-in account opening a stream on one day. Organizer and staff views are excluded.
      </p>

      <div className="grid grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-6 gap-3">
        {liveCounts && <StatTile label="Watching now" value={watchingNow} note={`${t.live_streams} live streams`} />}
        <StatTile label="Streams" value={t.streams} note={liveCounts ? undefined : `${t.live_streams} live`} />
        <StatTile label="Views" value={t.views} />
        <StatTile label="Unique viewers" value={t.unique_viewers} />
        <StatTile label="Feedback" value={t.feedback} />
        <StatTile label="Avg rating" value={formatRating(t.avg_rating)} />
      </div>

      <div className="grid grid-cols-1 @5xl:grid-cols-2 gap-4">
        <ReportCard title="Engagement per stream" note={comments ? 'Top 10 streams: views, unique viewers and comments.' : 'Top 10 streams.'} insight={insights.views_per_stream}>
          {topStreams.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Engagement per stream" horizontal heightClass="h-80"
              labels={topStreams.map((s) => s.title)}
              categoryTitle="Stream" valueTitle="Count"
              series={[
                { label: 'Views', data: topStreams.map((s) => s.views) },
                { label: 'Unique viewers', data: topStreams.map((s) => s.unique_viewers) },
                ...(comments ? [{ label: 'Comments', data: topStreams.map((s) => commentCounts.get(s.id) ?? 0) }] : []),
              ]} />
          )}
        </ReportCard>

        {busiest && busiest.minutes.length > 0 && (
          <ReportCard
            title="Comment sentiment over time"
            note={`"${busiest.title}" (${busiest.tournament_name}), the stream with the most comments: visible comments per minute, Philippine time.`}
            insight={insights.comment_timeline}
          >
            <ReportChart type="line" stacked title={`Comment sentiment over time: ${busiest.title}`}
              labels={busiest.minutes.map((m) => formatTime(m.minute))}
              categoryTitle="Time (PH)" valueTitle="Comments (count)"
              series={[
                { label: 'Negative', tone: 'negative', data: busiest.minutes.map((m) => Number(m.negative)) },
                { label: 'Neutral', tone: 'neutral', data: busiest.minutes.map((m) => Number(m.neutral)) },
                { label: 'Positive', tone: 'positive', data: busiest.minutes.map((m) => Number(m.positive)) },
              ]} />
          </ReportCard>
        )}

        <ReportCard title="Views per day" insight={insights.views_per_day}>
          {report.views_by_day.length === 0 ? <NoData /> : (
            <ReportChart type="line" title="Views per day"
              labels={report.views_by_day.map((d) => formatDay(d.day))}
              categoryTitle="Date" valueTitle="Views (count)"
              series={[
                { label: 'Views', data: report.views_by_day.map((d) => d.views) },
                { label: 'Unique viewers', data: report.views_by_day.map((d) => d.unique_viewers) },
              ]} />
          )}
        </ReportCard>
      </div>

      <ReportCard title="Streams" note="Match is shown when a stream is linked to one match.">
        <ReportTable
          columns={['Stream', 'Tournament', 'Match', 'Status', ...(liveCounts ? ['Watching now'] : []), 'Views', 'Unique viewers', ...(comments ? ['Comments'] : [])]}
          rows={report.streams.map((s) => [
            s.title,
            `${s.tournament_name} (${s.game})`,
            streamMatchLabel(s) || '–',
            s.status === 'live' ? <span className="inline-flex items-center gap-1.5"><LivePulse size="xs" /> Live</span> : capitalize(s.status),
            ...(liveCounts ? [s.status === 'live' ? liveCounts[s.id] ?? 0 : '–'] : []),
            s.views,
            s.unique_viewers,
            ...(comments ? [commentCounts.get(s.id) ?? 0] : []),
          ])}
        />
      </ReportCard>

      <ReportCard title="Feedback per tournament">
        <ReportTable
          columns={['Tournament', 'Feedback', 'Avg rating']}
          rows={report.feedback_by_tournament.map((f) => [f.tournament_name ?? 'General', f.count, formatRating(f.avg_rating)])}
        />
      </ReportCard>

      {/* Pick'em predictions (reports saved before this feature don't have them) */}
      <h3 className="text-lg sm:text-xl font-black text-amber-800 uppercase tracking-wider print:text-black pt-4">
        Pick&apos;em Predictions
      </h3>
      {report.predictions_by_tournament === undefined ? (
        <NoData text="No prediction data in this report (it was saved before pick'em was added)." />
      ) : (
        <>
          <p className="text-xs text-stone-500 font-medium normal-case print:text-stone-600">
            Participation = player and spectator accounts that made at least one pick. Accuracy = share of correct picks on finished matches.
          </p>
          <div className="grid grid-cols-2 @3xl:grid-cols-4 gap-3">
            <StatTile label="Predictions" value={t.predictions ?? 0} />
            <StatTile label="Predictors" value={t.predictors ?? 0} note={`of ${t.audience_accounts ?? 0} audience accounts`} />
            <StatTile label="Participation" value={formatPercent(t.prediction_participation)} />
            <StatTile label="Accuracy" value={formatPercent(t.prediction_accuracy)} />
          </div>
          <ReportCard title="Predictions per tournament">
            {report.predictions_by_tournament.length === 0 ? <NoData /> : (
              <ReportTable
                columns={['Tournament', 'Predictions', 'Predictors', 'Decided', 'Accuracy']}
                rows={report.predictions_by_tournament.map((p) => [p.tournament_name, p.predictions, p.predictors, p.decided, formatPercent(p.accuracy)])}
              />
            )}
          </ReportCard>
        </>
      )}
    </section>
  );
}
