'use client';

import Link from 'next/link';
import ReportChart from '@/components/ReportChart';
import { SENTIMENTS, sentimentColors, type SentimentReport } from '@/utils/reports';
import type { Sentiment } from '@/utils/types';
import { NoData, ReportCard, ReportTable, StatTile, capitalize, formatDay, formatRating } from './ReportParts';

// "Sentiment Analysis Report & viewer feedback insights" (Organizing Committee)
export default function SentimentSection({ report }: { report: SentimentReport }) {
  const t = report.totals;
  const classified = t.positive + t.neutral + t.negative;
  const percent = (n: number) => (classified ? `${Math.round((n / classified) * 100)}%` : '–');

  // Common concerns: topics people mention in negative feedback, most frequent first
  const concerns = report.topics
    .filter((x) => x.negative > 0)
    .sort((a, b) => b.negative - a.negative)
    .slice(0, 8);

  // One series per sentiment, with its fixed color (used by the stacked charts)
  const sentimentSeries = (rows: Record<Sentiment, number>[]) =>
    SENTIMENTS.map((s) => ({ label: capitalize(s), color: sentimentColors[s], data: rows.map((r) => r[s]) }));

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-[#00d2ff] print:text-black">Sentiment Analysis Report</h2>

      {t.pending > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-200 px-4 py-3 rounded-lg print:hidden">
          {t.pending} feedback {t.pending === 1 ? 'is' : 'are'} not classified yet, so they only count towards the
          rating.{' '}
          <Link href="/admin/feedback" className="underline">Classify them on Feedback Analysis</Link>, then generate again.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile label="Feedback" value={t.total} />
        <StatTile label="Avg rating" value={formatRating(t.avg_rating)} />
        <StatTile label="Positive" value={t.positive} note={percent(t.positive)} />
        <StatTile label="Neutral" value={t.neutral} note={percent(t.neutral)} />
        <StatTile label="Negative" value={t.negative} note={percent(t.negative)} />
        <StatTile label="Not classified" value={t.pending} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Sentiment breakdown" note="Classified feedback only.">
          {classified === 0 ? <NoData /> : (
            <ReportChart type="doughnut" title="Sentiment breakdown"
              labels={SENTIMENTS.map(capitalize)}
              series={[{ label: 'Feedback', data: [t.positive, t.neutral, t.negative], colors: SENTIMENTS.map((s) => sentimentColors[s]) }]} />
          )}
        </ReportCard>

        <ReportCard title="Sentiment over time" note="Feedback per week (weeks start on Monday).">
          {report.by_week.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Feedback per week by sentiment" stacked
              labels={report.by_week.map((w) => formatDay(w.week))}
              series={sentimentSeries(report.by_week)} />
          )}
        </ReportCard>

        <ReportCard title="Common concerns" note="Topics mentioned in negative feedback.">
          {concerns.length === 0 ? <NoData text="No negative topics for these filters." /> : (
            <ReportChart type="bar" title="Common concerns" horizontal
              labels={concerns.map((c) => c.topic)}
              series={[{ label: 'Negative mentions', color: sentimentColors.negative, data: concerns.map((c) => c.negative) }]} />
          )}
        </ReportCard>

        <ReportCard title="Sentiment per tournament">
          {report.by_tournament.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Sentiment per tournament" stacked horizontal
              labels={report.by_tournament.map((x) => x.tournament_name ?? 'General')}
              series={sentimentSeries(report.by_tournament)} />
          )}
        </ReportCard>
      </div>

      <ReportCard title="Per tournament" note="Score: -1 very negative … 1 very positive.">
        <ReportTable
          columns={['Tournament', 'Feedback', 'Positive', 'Neutral', 'Negative', 'Not classified', 'Avg rating', 'Avg score']}
          rows={report.by_tournament.map((x) => [
            x.tournament_name ?? 'General', x.total, x.positive, x.neutral, x.negative, x.pending,
            formatRating(x.avg_rating), x.avg_score === null ? '–' : Number(x.avg_score).toFixed(2),
          ])}
        />
      </ReportCard>

      <ReportCard title="All topics">
        <ReportTable
          columns={['Topic', 'Mentions', 'Positive', 'Neutral', 'Negative']}
          rows={report.topics.map((x) => [x.topic, x.total, x.positive, x.neutral, x.negative])}
        />
      </ReportCard>

      {report.negative_examples.length > 0 && (
        <ReportCard title="Examples of negative feedback">
          <ul className="space-y-3">
            {report.negative_examples.map((f, i) => (
              <li key={i} className="border-l-2 border-[#e66767] pl-3">
                <p className="text-gray-200 whitespace-pre-wrap print:text-black">{f.comment}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {f.rating} ★ · {f.tournament_name ?? 'General'} ·{' '}
                  {new Date(f.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  {f.topics.length > 0 && ` · ${f.topics.join(', ')}`}
                </p>
              </li>
            ))}
          </ul>
        </ReportCard>
      )}
    </section>
  );
}
