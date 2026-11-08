'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { SENTIMENTS, sentimentColors } from '@/utils/reports';
import ReportChart from '@/components/ReportChart';
import SectionHint from '@/components/SectionHint';
import { SectionLoading } from '@/components/PageLoading';

interface Split { label: string; total: number; positive: number; neutral: number; negative: number }
interface DaySplit { day: string; total: number; positive: number; neutral: number; negative: number }

// The shape report_comment_sentiment() returns (202611081500_comments_moderation)
interface CommentReport {
  total: number;
  analysed: number;
  pending: number;
  by_sentiment: Record<'positive' | 'neutral' | 'negative', number>;
  flagged: { profane: number; hidden: number; restored: number; warnings: number };
  per_stream: Split[];
  per_tournament: Split[];
  per_day: DaySplit[];
  top_topics: { topic: string; count: number }[];
}

const sentimentSeries = (rows: (Split | DaySplit)[]) =>
  SENTIMENTS.map((s) => ({
    label: s[0].toUpperCase() + s.slice(1),
    data: rows.map((r) => r[s]),
    color: sentimentColors[s],
  }));

// Admin dashboard (4.4): sentiment of live stream comments next to feedback sentiment — totals,
// flagged items, per stream, per tournament, over time and top topics. Admin only (the function
// checks the role).
export default function CommentSentiment({ tournaments }: { tournaments: { id: string; name: string }[] }) {
  const supabase = createClient();
  const [tournamentId, setTournamentId] = useState('');
  const [report, setReport] = useState<CommentReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .rpc('report_comment_sentiment', { p_tournament_id: tournamentId || undefined })
      .then(({ data, error: rpcError }) => {
        if (rpcError) setError(getErrorMessage(rpcError, 'Comment sentiment could not be loaded.'));
        else {
          setError('');
          setReport(data as unknown as CommentReport);
        }
      });
  }, [supabase, tournamentId]);

  return (
    <section className="rounded-3xl border border-stone-200/90 bg-white p-4 sm:p-6 shadow-xs space-y-5" aria-labelledby="comment-sentiment-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 id="comment-sentiment-title" className="text-xl font-black flex items-center gap-1.5">
          Stream comment sentiment
          <SectionHint text="Live chat comments analysed by the same AI as feedback. Hidden = offensive comments; profanity stays visible but is flagged." />
        </h2>
        <select
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
          aria-label="Tournament"
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm"
        >
          <option value="">All tournaments</option>
          {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-bold text-red-700">{error}</p>
      ) : !report ? (
        <SectionLoading />
      ) : report.total === 0 ? (
        <p className="text-stone-600">No comments yet{tournamentId ? ' for this tournament' : ''}.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              ['Comments', report.total],
              ['Positive', report.by_sentiment.positive],
              ['Neutral', report.by_sentiment.neutral],
              ['Negative', report.by_sentiment.negative],
              ['Profanity', report.flagged.profane],
              ['Hidden', report.flagged.hidden],
              ['Warnings', report.flagged.warnings],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <dt className="text-xs font-black uppercase tracking-wider text-stone-600">{label}</dt>
                <dd className="text-2xl font-black tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {report.pending > 0 && (
            <p className="text-sm text-stone-600">{report.pending} comment(s) still waiting for analysis.</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-black">Sentiment over time</h3>
              <ReportChart
                type="line"
                title="Comments per day by sentiment"
                labels={report.per_day.map((d) => d.day)}
                series={sentimentSeries(report.per_day)}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-black">Top topics</h3>
              <ReportChart
                type="bar"
                horizontal
                title="Most mentioned comment topics"
                labels={report.top_topics.map((t) => t.topic)}
                series={[{ label: 'Comments', data: report.top_topics.map((t) => t.count) }]}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-black">Per stream (top 10)</h3>
              <ReportChart
                type="bar"
                horizontal
                stacked
                title="Comments per stream by sentiment"
                labels={report.per_stream.map((s) => s.label)}
                series={sentimentSeries(report.per_stream)}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="text-sm font-black">Per tournament</h3>
              <ReportChart
                type="bar"
                horizontal
                stacked
                title="Comments per tournament by sentiment"
                labels={report.per_tournament.map((s) => s.label)}
                series={sentimentSeries(report.per_tournament)}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
