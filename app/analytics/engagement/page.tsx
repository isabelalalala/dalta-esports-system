'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import ReportFilters, { filterNames, useFilterOptions } from '@/components/ReportFilters';
import EngagementSection from '../EngagementSection';
import {
  buildCsv, describeFilters, downloadCsv, emptyFilters, engagementCsv, fetchEngagementReport, validateFilters,
  type EngagementReport, type ReportFilters as Filters,
} from '@/utils/reports';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';

// "View engagement stats" (use case, Tournament Staff). Admins can open it too.
export default function EngagementPage() {
  const supabase = createClient();
  const { options, error: optionsError } = useFilterOptions();
  const [role, setRole] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [report, setReport] = useState<EngagementReport | null>(null);
  // Stream id -> people watching right now (stream_presence heartbeats, see /live/[id])
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Increase this to load the report again ("Refresh")
  const [reloadCount, setReloadCount] = useState(0);

  const filterError = validateFilters(filters);

  // Load the report whenever the filters change
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (myRole !== 'admin' && myRole !== 'staff') return;
        if (filterError) return;

        setError('');
        setReport(await fetchEngagementReport(supabase, filters));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the engagement stats'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, filters, filterError, reloadCount]);

  // Live viewers: listen to the presence channel of every live stream.
  // liveKey only changes when the list of live streams changes.
  const liveKey = (report?.streams ?? []).filter((s) => s.status === 'live').map((s) => s.id).join(',');

  useEffect(() => {
    if (!liveKey) return;
    const ids = liveKey.split(',');

    const loadCounts = async () => {
      const { data } = await supabase.rpc('get_live_viewer_counts', { p_stream_ids: ids });
      const rows = (data ?? []) as { stream_id: string; viewers: number }[];
      setLiveCounts((counts) => ({
        ...counts,
        ...Object.fromEntries(ids.map((id) => [id, rows.find((r) => r.stream_id === id)?.viewers ?? 0])),
      }));
    };

    loadCounts();
    // Heartbeats stay fresh for 90 s; polling every 30 s keeps the count current.
    const timer = setInterval(loadCounts, 30_000);
    return () => clearInterval(timer);
  }, [supabase, liveKey]);

  const handleCsv = () => {
    if (!report) return;
    downloadCsv(`engagement-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(engagementCsv(report)));
  };

  if (loading) return <PageLoading />;

  // Hiding the page is only for convenience; report_engagement() also refuses other roles.
  // The role couldn't be loaded: show why, not "only admins"
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin' && role !== 'staff') {
    return (
      <div className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only organizers can view engagement stats.{' '}
        <Link href="/dashboard" className="text-gold underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10 print:bg-white print:text-black print:p-0">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <Link href={role === 'admin' ? '/analytics' : '/dashboard'} className="inline-block text-gold hover:underline mb-6 print:hidden">
            ← Back to {role === 'admin' ? 'Analytics' : 'Dashboard'}
          </Link>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold print:text-black">Engagement Stats</h1>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button onClick={() => setReloadCount((n) => n + 1)} className="border border-gold text-gold px-4 py-2 font-bold hover:bg-gold/10">
                Refresh
              </button>
              <button onClick={handleCsv} disabled={!report} className="border border-gold text-gold px-4 py-2 font-bold hover:bg-gold/10 disabled:opacity-50">
                Download CSV
              </button>
              <button onClick={() => window.print()} disabled={!report} className="bg-gold text-black px-4 py-2 font-bold hover:bg-golddark disabled:opacity-50">
                Print / PDF
              </button>
            </div>
          </div>
          <p className="hidden print:block text-sm mt-1">
            {describeFilters(filterNames(filters, options))} · Printed {new Date().toLocaleString()}
          </p>
        </div>

        <ReportFilters value={filters} onChange={setFilters} options={options} />

        {(error || optionsError || filterError) && (
          <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">
            {filterError || error || optionsError}
          </div>
        )}

        {report && <EngagementSection report={report} liveCounts={liveCounts} />}
      </div>
    </div>
  );
}
