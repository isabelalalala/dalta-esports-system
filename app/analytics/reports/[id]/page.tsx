'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import ActivitySection from '../../ActivitySection';
import SentimentSection from '../../SentimentSection';
import EngagementSection from '../../EngagementSection';
import {
  activityCsv, buildCsv, dateInManila, describeFilters, downloadCsv, engagementCsv, sentimentCsv, type SavedReport,
} from '@/utils/reports';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Download, Printer } from 'lucide-react';

// A generated report, shown from its saved copy ("display after report": print or export).
export default function SavedReportPage() {
  const supabase = createClient();
  const params = useParams();
  usePageTitle('Saved report');
  const id = params?.id as string;
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // RLS returns nothing to anyone but admins, so a missing row also covers "not allowed"
        const { data, error: loadError } = await supabase
          .from('analytics_reports')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (loadError) throw loadError;
        if (!data) throw new Error('Report not found, or only admins can view it.');
        setReport(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the report'));
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [supabase, id]);

  if (loading) return <PageLoading />;
  if (!report) {
    return <PageError message={error || 'Report not found. It may have been deleted.'} backHref="/analytics" backLabel="Back to Analytics" />;
  }

  const generatedAt = new Date(report.generated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const handleCsv = () => {
    const header = {
      title: 'DALTA Esports analytics report',
      columns: ['Filters', 'Generated'],
      rows: [[describeFilters(report.filters), generatedAt]],
    };
    const csv = buildCsv([
      header,
      ...activityCsv(report.data.activity),
      ...sentimentCsv(report.data.sentiment),
      ...engagementCsv(report.data.engagement),
    ]);
    downloadCsv(`analytics-report-${dateInManila(report.generated_at)}.csv`, csv);
  };

  return (
    <div className="w-full space-y-8 uppercase text-stone-950 print:p-0">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4 print:hidden">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Analytics Report Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Analytics
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCsv}
              className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 text-xs tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-4 py-2 text-xs tracking-wider border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            DALTA Esports Analytics Report
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            {describeFilters(report.filters)} · Generated {generatedAt}
          </p>
        </div>
      </section>

      {/* Print header visible only during print */}
      <div className="hidden print:block border-b border-stone-300 pb-4 mb-6">
        <h1 className="text-2xl font-black text-black uppercase">DALTA Esports Analytics Report</h1>
        <p className="text-xs text-stone-600 mt-1">
          {describeFilters(report.filters)} · Generated {generatedAt}
        </p>
      </div>

      {/* 2. Report Sections */}
      <div className="space-y-10">
        <ActivitySection report={report.data.activity} />
        <SentimentSection report={report.data.sentiment} />
        <EngagementSection report={report.data.engagement} />
      </div>
    </div>
  );
}
