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
  activityCsv, buildCsv, describeFilters, downloadCsv, engagementCsv, sentimentCsv, type SavedReport,
} from '@/utils/reports';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';

// A generated report, shown from its saved copy ("display after report": print or export).
export default function SavedReportPage() {
  const supabase = createClient();
  const params = useParams();
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
    downloadCsv(`analytics-report-${report.generated_at.slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10 print:bg-white print:text-black print:p-0">
      <div className="max-w-6xl mx-auto space-y-10">
        <div>
          <Link href="/analytics" className="inline-block text-gold hover:underline mb-6 print:hidden">
            ← Back to Analytics
          </Link>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold print:text-black">DALTA Esports Analytics Report</h1>
              <p className="text-gray-400 mt-1 print:text-gray-700">
                {describeFilters(report.filters)} · Generated {generatedAt}
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button onClick={handleCsv} className="border border-gold text-gold px-4 py-2 font-bold hover:bg-gold/10">
                Download CSV
              </button>
              <button onClick={() => window.print()} className="bg-gold text-black px-4 py-2 font-bold hover:bg-golddark">
                Print / PDF
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 print:hidden">
            To save as PDF, choose &quot;Save as PDF&quot; as the printer.
          </p>
        </div>

        <ActivitySection report={report.data.activity} />
        <SentimentSection report={report.data.sentiment} />
        <EngagementSection report={report.data.engagement} />
      </div>
    </div>
  );
}
