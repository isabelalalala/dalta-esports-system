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

// "View engagement stats" (use case, Tournament Staff). Admins can open it too.
export default function EngagementPage() {
  const supabase = createClient();
  const { options, error: optionsError } = useFilterOptions();
  const [role, setRole] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [report, setReport] = useState<EngagementReport | null>(null);
  // Stream id -> people watching right now (Supabase Realtime Presence, see /live/[id])
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
        const { data: myRole } = await supabase.rpc('get_my_role');
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
    const channels = liveKey.split(',').map((streamId) => {
      const channel = supabase.channel(`viewers-${streamId}`);
      // 'sync' fires whenever someone starts or stops watching
      channel
        .on('presence', { event: 'sync' }, () => {
          const watching = Object.keys(channel.presenceState()).length;
          setLiveCounts((counts) => ({ ...counts, [streamId]: watching }));
        })
        .subscribe();
      return channel;
    });

    // Stop listening when the live streams change or the page closes
    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [supabase, liveKey]);

  const handleCsv = () => {
    if (!report) return;
    downloadCsv(`engagement-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(engagementCsv(report)));
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;

  // Hiding the page is only for convenience; report_engagement() also refuses other roles.
  if (role !== 'admin' && role !== 'staff') {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">
        Only organizers can view engagement stats.{' '}
        <Link href="/dashboard" className="text-[#00d2ff] underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white px-4 py-10 print:bg-white print:text-black print:p-0">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <Link href={role === 'admin' ? '/analytics' : '/dashboard'} className="inline-block text-[#00d2ff] hover:underline mb-6 print:hidden">
            ← Back to {role === 'admin' ? 'Analytics' : 'Dashboard'}
          </Link>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-4xl font-bold text-[#00d2ff] print:text-black">Engagement Stats</h1>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button onClick={() => setReloadCount((n) => n + 1)} className="border border-[#00d2ff] text-[#00d2ff] px-4 py-2 rounded-lg font-bold hover:bg-[#00d2ff]/10">
                Refresh
              </button>
              <button onClick={handleCsv} disabled={!report} className="border border-[#00d2ff] text-[#00d2ff] px-4 py-2 rounded-lg font-bold hover:bg-[#00d2ff]/10 disabled:opacity-50">
                Download CSV
              </button>
              <button onClick={() => window.print()} disabled={!report} className="bg-[#00d2ff] text-black px-4 py-2 rounded-lg font-bold hover:bg-[#00b8e6] disabled:opacity-50">
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
          <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
            {filterError || error || optionsError}
          </div>
        )}

        {report && <EngagementSection report={report} liveCounts={liveCounts} />}
      </div>
    </div>
  );
}
