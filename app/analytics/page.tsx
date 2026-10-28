'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import ReportFilters, { filterNames, useFilterOptions } from '@/components/ReportFilters';
import {
  describeFilters, emptyFilters, fetchFullReport, validateFilters,
  type ReportFilters as Filters, type SavedReport,
} from '@/utils/reports';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';

type ReportListItem = Pick<SavedReport, 'id' | 'filters' | 'generated_at'> & {
  generator: { full_name: string | null; email: string } | null;
};

export default function AnalyticsPage() {
  const supabase = createClient();
  const router = useRouter();
  usePageTitle('Analytics');
  const { options, error: optionsError } = useFilterOptions();
  const [role, setRole] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');

        if (myRole === 'staff') {
          router.replace('/analytics/engagement');
          return;
        }
        if (myRole !== 'admin') return;

        const { data, error: listError } = await supabase
          .from('analytics_reports')
          .select('id, filters, generated_at, generator:profiles(full_name, email)')
          .order('generated_at', { ascending: false })
          .limit(50);
        if (listError) throw listError;
        setReports((data as unknown as ReportListItem[]) || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load reports'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, router, reloadCount]);

  const handleGenerate = async () => {
    const filterError = validateFilters(filters);
    if (filterError) return setError(filterError);

    setGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in to generate a report.');

      const data = await fetchFullReport(supabase, filters);
      const { data: saved, error: saveError } = await supabase
        .from('analytics_reports')
        .insert([{ filters: filterNames(filters, options), data, generated_by: session.user.id }])
        .select('id')
        .single();
      if (saveError) throw saveError;
      router.push(`/analytics/reports/${saved.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate the report'));
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved report?')) return;
    setError('');
    try {
      const { data, error: deleteError } = await supabase.from('analytics_reports').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('The report could not be deleted.');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete the report'));
    }
  };

  if (loading || role === 'staff') return <PageLoading />;
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only administrators can view analytics reports.</p>
        <Link href="/dashboard" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Analytics Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/analytics/engagement"
            className="inline-flex items-center gap-1.5 text-xs font-black bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl transition-all"
          >
            Live Engagement Stats →
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Analytics &amp; Reports
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Generate comprehensive reports on tournament activity, sentiment analysis, and audience engagement.
          </p>
        </div>
      </section>

      {/* 2. Filter Form & Saved Reports */}
      <div className="space-y-6 text-stone-950">
        {(error || optionsError) && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error || optionsError}
          </div>
        )}

        <ReportFilters value={filters} onChange={setFilters} options={options} />

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3.5 text-xs tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          {generating ? 'Compiling Analytics...' : 'Generate New Report'}
        </button>

        <div className="space-y-4 pt-4">
          <div className="pb-2 border-b border-stone-200">
            <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">
              Saved Reports Archive
            </h2>
          </div>

          {reports.length === 0 ? (
            <p className="text-stone-500 text-center py-10 font-bold tracking-wider">No saved reports generated yet.</p>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs hover:border-stone-300 transition-all flex flex-wrap items-center justify-between gap-4 text-stone-950"
                >
                  <Link href={`/analytics/reports/${r.id}`} className="flex-1 min-w-0 group">
                    <p className="font-extrabold text-stone-950 text-sm tracking-wide group-hover:text-amber-700 transition-colors">
                      {describeFilters(r.filters)}
                    </p>
                    <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5 normal-case">
                      {new Date(r.generated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}Generated by {r.generator?.full_name || r.generator?.email || 'System'}
                    </p>
                  </Link>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
