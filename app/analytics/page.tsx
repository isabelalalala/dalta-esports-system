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

type ReportListItem = Pick<SavedReport, 'id' | 'filters' | 'generated_at'> & {
  generator: { full_name: string | null; email: string } | null;
};

// "Generate analytics report" (use case, Organizing Committee).
// Generating calculates the reports and saves them (D5), then shows the saved report.
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
  // Increase this to load the saved reports again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');

        // Staff only get the engagement stats
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
        setError(getErrorMessage(err, 'Failed to load saved reports'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, router, reloadCount]);

  const handleGenerate = async () => {
    const filterError = validateFilters(filters);
    if (filterError) {
      setError(filterError);
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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

  if (loading || role === 'staff') {
    return <PageLoading />;
  }

  // Hiding the page is only for convenience; RLS and the report functions also refuse other roles.
  // The role couldn't be loaded: show why, not "only admins"
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin') {
    return (
      <main id="main-content" className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only organizers can view reports.{' '}
        <Link href="/dashboard" className="text-gold underline">Back to Dashboard</Link>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Analytics &amp; Reports</h1>
            <Link href="/analytics/engagement" className="border border-gold text-gold px-4 py-2 font-bold hover:bg-gold/10">
              Live engagement stats →
            </Link>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            A report has three parts: tournament activity, sentiment analysis and viewer engagement.
            It is saved, so you can open, print or export it again later.
          </p>
        </div>

        {(error || optionsError) && (
          <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error || optionsError}</div>
        )}

        <ReportFilters value={filters} onChange={setFilters} options={options} />

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-gold text-black px-6 py-3 font-bold hover:bg-golddark transition disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate report'}
        </button>

        <div>
          <h2 className="text-2xl font-bold text-gold mb-3">Saved reports</h2>
          {reports.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No reports generated yet.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="bg-sitecard border border-brown p-4 flex flex-wrap items-center gap-3">
                  <Link href={`/analytics/reports/${r.id}`} className="flex-1 min-w-0 hover:underline">
                    <p className="font-bold">{describeFilters(r.filters)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.generated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}by {r.generator?.full_name || r.generator?.email || 'deleted user'}
                    </p>
                  </Link>
                  <button onClick={() => handleDelete(r.id)} className="text-red-400 text-sm hover:underline">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
