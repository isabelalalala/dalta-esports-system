'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import ReportFilters, { filterNames, useFilterOptions } from '@/components/ReportFilters';
import EngagementSection from '../EngagementSection';
import {
  buildCsv, describeFilters, downloadCsv, emptyFilters, engagementCsv, fetchEngagementReport, todayInManila, validateFilters,
  type EngagementReport, type ReportFilters as Filters,
} from '@/utils/reports';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Download, Printer, RotateCw } from 'lucide-react';

// "View engagement stats" (use case, Tournament Staff). Admins can open it too.
export default function EngagementPage() {
  const supabase = createClient();
  usePageTitle('Engagement analytics');
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
    // Debounce: each filter change runs report_engagement; coalesce quick edits
    const timer = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(timer);
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
    downloadCsv(`engagement-${todayInManila()}.csv`, buildCsv(engagementCsv(report)));
  };

  if (loading) return <PageLoading />;

  // Hiding the page is only for convenience; report_engagement() also refuses other roles.
  // The role couldn't be loaded: show why, not "only admins"
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin' && role !== 'staff') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only organizers can view engagement stats.</p>
        <Link href="/dashboard" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 uppercase text-stone-950 print:p-0">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4 print:hidden">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Engagement Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href={role === 'admin' ? '/analytics' : '/dashboard'}
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to {role === 'admin' ? 'Analytics' : 'Dashboard'}
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setReloadCount((n) => n + 1)}
              className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2 text-xs tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleCsv}
              disabled={!report}
              className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2 text-xs tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer backdrop-blur-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              disabled={!report}
              className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-4 py-2 text-xs tracking-wider border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
            Engagement Stats
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Live stream viewership, audience retention, and tournament broadcast analytics.
          </p>
        </div>
      </section>

      {/* Print header visible only during print */}
      <div className="hidden print:block border-b border-stone-300 pb-4 mb-6">
        <h1 className="text-2xl font-black text-black uppercase">Engagement Stats</h1>
        <p className="text-xs text-stone-600 mt-1">
          {describeFilters(filterNames(filters, options))} · Printed {new Date().toLocaleString()}
        </p>
      </div>

      {/* 2. Filters Box */}
      <div className="space-y-4 print:hidden">
        <ReportFilters value={filters} onChange={setFilters} options={options} />

        {(error || optionsError || filterError) && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs"
          >
            {filterError || error || optionsError}
          </div>
        )}
      </div>

      {/* 3. Engagement Metrics & Charts */}
      {report && (
        <div className="space-y-8">
          <EngagementSection report={report} liveCounts={liveCounts} />
        </div>
      )}
    </div>
  );
}
