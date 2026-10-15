'use client';

import ReportChart from '@/components/ReportChart';
import { streamMatchLabel, type EngagementReport } from '@/utils/reports';
import { NoData, ReportCard, ReportTable, StatTile, capitalize, formatDay, formatRating } from './ReportParts';

interface Props {
  report: EngagementReport;
  // Stream id -> people watching right now. Only given on the live engagement page,
  // not for saved reports (a saved "now" would be out of date).
  liveCounts?: Record<string, number>;
}

// "Viewership & Audience Engagement Stats" (Tournament Staff, also part of the admin's report)
export default function EngagementSection({ report, liveCounts }: Props) {
  const t = report.totals;
  const topStreams = report.streams.filter((s) => s.views > 0).slice(0, 10);
  const watchingNow = liveCounts ? Object.values(liveCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-[#00d2ff] print:text-black">Viewership &amp; Audience Engagement</h2>
      <p className="text-sm text-gray-400 print:text-gray-600">
        A view = one logged-in person opening a stream on one day. Organizers&apos; own visits are not counted.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {liveCounts && <StatTile label="Watching now" value={watchingNow} note={`${t.live_streams} live streams`} />}
        <StatTile label="Streams" value={t.streams} note={liveCounts ? undefined : `${t.live_streams} live`} />
        <StatTile label="Views" value={t.views} />
        <StatTile label="Unique viewers" value={t.unique_viewers} />
        <StatTile label="Feedback" value={t.feedback} />
        <StatTile label="Avg rating" value={formatRating(t.avg_rating)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Views per stream" note="Top 10 streams.">
          {topStreams.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Views per stream" horizontal
              labels={topStreams.map((s) => s.title)}
              series={[
                { label: 'Views', data: topStreams.map((s) => s.views) },
                { label: 'Unique viewers', data: topStreams.map((s) => s.unique_viewers) },
              ]} />
          )}
        </ReportCard>

        <ReportCard title="Views per day">
          {report.views_by_day.length === 0 ? <NoData /> : (
            <ReportChart type="line" title="Views per day"
              labels={report.views_by_day.map((d) => formatDay(d.day))}
              series={[
                { label: 'Views', data: report.views_by_day.map((d) => d.views) },
                { label: 'Unique viewers', data: report.views_by_day.map((d) => d.unique_viewers) },
              ]} />
          )}
        </ReportCard>
      </div>

      <ReportCard title="Streams" note="Match is shown when a stream is linked to one match.">
        <ReportTable
          columns={['Stream', 'Tournament', 'Match', 'Status', ...(liveCounts ? ['Watching now'] : []), 'Views', 'Unique viewers']}
          rows={report.streams.map((s) => [
            s.title,
            `${s.tournament_name} (${s.game})`,
            streamMatchLabel(s) || '–',
            s.status === 'live' ? '● Live' : capitalize(s.status),
            ...(liveCounts ? [s.status === 'live' ? liveCounts[s.id] ?? 0 : '–'] : []),
            s.views,
            s.unique_viewers,
          ])}
        />
      </ReportCard>

      <ReportCard title="Feedback per tournament">
        <ReportTable
          columns={['Tournament', 'Feedback', 'Avg rating']}
          rows={report.feedback_by_tournament.map((f) => [f.tournament_name ?? 'General', f.count, formatRating(f.avg_rating)])}
        />
      </ReportCard>
    </section>
  );
}
