'use client';

import Link from 'next/link';
import ReportChart from '@/components/ReportChart';
import { SENTIMENTS, sentimentShareByWeek, type SentimentReport } from '@/utils/reports';
import type { Sentiment } from '@/utils/types';
import { NoData, ReportCard, ReportTable, StatTile, capitalize, formatDay, formatRating, type Insights } from './ReportParts';
import { Star } from 'lucide-react';

interface Props {
  report: SentimentReport;
  // What the items are, e.g. "feedback entries", "comments", "feedback entries and comments"
  noun?: string;
  // The data source shown under the heading, e.g. "Feedback and comments"
  sourceText?: string;
  insights?: Insights;
}

// "Sentiment Analysis Report & viewer feedback insights" (Organizing Committee).
// report is feedback, stream comments, or both combined (the data source filter).
export default function SentimentSection({ report, noun = 'feedback entries', sourceText, insights = {} }: Props) {
  const t = report.totals;
  const classified = t.positive + t.neutral + t.negative;
  const percent = (n: number) => (classified ? `${Math.round((n / classified) * 100)}%` : '–');
  const weeks = sentimentShareByWeek(report.by_week);
  const topics = [...report.topics].sort((a, b) => b.total - a.total).slice(0, 10);
  const hasRating = t.avg_rating !== null && t.avg_rating !== undefined;

  // One series per sentiment, with its fixed color (used by the stacked charts)
  const sentimentSeries = (rows: Record<Sentiment, number>[]) =>
    SENTIMENTS.map((s) => ({ label: capitalize(s), tone: s, data: rows.map((r) => r[s]) }));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-amber-800 uppercase tracking-wider print:text-black">
          Sentiment Analysis Report
        </h2>
        {sourceText && <p className="text-xs text-stone-500 font-medium normal-case mt-1">Data source: {sourceText}</p>}
      </div>

      {t.pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs font-bold tracking-wide print:hidden">
          {t.pending} {noun} {t.pending === 1 ? 'is' : 'are'} pending analysis, so {t.pending === 1 ? 'it is' : 'they are'} not in
          the sentiment charts.{' '}
          <Link href="/admin/moderation" className="underline hover:text-amber-700">Retry the analysis</Link>, then generate again.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile label="Items" value={t.total} note={noun} />
        {hasRating && <StatTile label="Avg rating" value={formatRating(t.avg_rating)} note="feedback only" />}
        <StatTile label="Positive" value={t.positive} note={percent(t.positive)} />
        <StatTile label="Neutral" value={t.neutral} note={percent(t.neutral)} />
        <StatTile label="Negative" value={t.negative} note={percent(t.negative)} />
        <StatTile label="Pending analysis" value={t.pending} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Sentiment distribution" note={`Analysed ${noun} only (parts of the whole).`} insight={insights.sentiment_distribution}>
          {classified === 0 ? <NoData /> : (
            <ReportChart type="doughnut" title="Sentiment distribution"
              labels={SENTIMENTS.map(capitalize)}
              categoryTitle="Sentiment"
              series={[{ label: capitalize(noun), data: [t.positive, t.neutral, t.negative], tones: SENTIMENTS }]} />
          )}
        </ReportCard>

        <ReportCard title="Sentiment trend" note="Share of each sentiment per week (weeks start on Monday)." insight={insights.sentiment_trend}>
          {weeks.length === 0 ? <NoData /> : (
            <ReportChart type="line" title="Sentiment trend" unit="%"
              labels={weeks.map((w) => formatDay(w.week))}
              categoryTitle="Week starting" valueTitle={`Share of analysed ${noun} (%)`}
              series={SENTIMENTS.map((s) => ({ label: capitalize(s), tone: s, data: weeks.map((w) => w[s]) }))} />
          )}
        </ReportCard>

        <ReportCard title="Top topics" note="The 10 most mentioned topics, split by sentiment." insight={insights.top_topics}>
          {topics.length === 0 ? <NoData text="No topics for these filters." /> : (
            <ReportChart type="bar" title="Top topics" stacked horizontal heightClass="h-80"
              labels={topics.map((x) => x.topic)}
              categoryTitle="Topic" valueTitle="Mentions (count)"
              series={sentimentSeries(topics)} />
          )}
        </ReportCard>

        <ReportCard title="Sentiment per tournament" insight={insights.sentiment_per_tournament}>
          {report.by_tournament.length === 0 ? <NoData /> : (
            <ReportChart type="bar" title="Sentiment per tournament" stacked horizontal
              labels={report.by_tournament.map((x) => x.tournament_name ?? 'General')}
              categoryTitle="Tournament" valueTitle={`${capitalize(noun)} (count)`}
              series={sentimentSeries(report.by_tournament)} />
          )}
        </ReportCard>
      </div>

      <ReportCard title="Per tournament" note="Score: -1 very negative … 1 very positive.">
        <ReportTable
          columns={['Tournament', 'Items', 'Positive', 'Neutral', 'Negative', 'Pending analysis', ...(hasRating ? ['Avg rating'] : []), 'Avg score']}
          rows={report.by_tournament.map((x) => [
            x.tournament_name ?? 'General', x.total, x.positive, x.neutral, x.negative, x.pending,
            ...(hasRating ? [formatRating(x.avg_rating)] : []),
            x.avg_score === null ? '–' : Number(x.avg_score).toFixed(2),
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
        <ReportCard title="Examples of negative feedback and comments" note="Hidden comments are never shown here; no names.">
          <ul className="space-y-3">
            {report.negative_examples.map((f, i) => (
              <li key={i} className="border-l-2 border-negative pl-3">
                <p className="text-stone-800 whitespace-pre-wrap break-words print:text-black">{f.comment}</p>
                <p className="text-xs text-stone-500 mt-1">
                  {f.rating ? <>{f.rating} <Star className="inline h-3 w-3 fill-yellow-400 text-yellow-400" /> · </> : 'Comment · '}
                  {f.tournament_name ?? 'General'} ·{' '}
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
