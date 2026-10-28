'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { ACTION_GROUPS, describeActivity, type ActivityLog } from '@/utils/activity';
import { usePageTitle } from '@/utils/page-title';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import PageHeroBackground from '@/components/site/PageHeroBackground';

const PAGE_SIZE = 50;

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

interface Filters {
  action: string;
  actor: string;
  from: string;
  to: string;
}

const emptyFilters: Filters = { action: '', actor: '', from: '', to: '' };

function startOfDay(date: string, addDays = 0) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
}

async function fetchPage(supabase: ReturnType<typeof createClient>, filters: Filters, offset: number) {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filters.action.startsWith('group:')) {
    const group = ACTION_GROUPS.find((g) => `group:${g.label}` === filters.action);
    query = query.in('action', group ? group.actions.map((a) => a.value) : []);
  } else if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.actor === 'none') query = query.is('actor_id', null);
  else if (filters.actor) query = query.eq('actor_id', filters.actor);
  if (filters.from) query = query.gte('created_at', startOfDay(filters.from));
  if (filters.to) query = query.lt('created_at', startOfDay(filters.to, 1));

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ActivityLog[];
}

export default function ActivityLogPage() {
  const supabase = createClient();
  usePageTitle('Activity log');
  const [role, setRole] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [actors, setActors] = useState<{ actor_id: string; actor_name: string | null }[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (myRole !== 'admin') return;

        if (filters.from && filters.to && filters.from > filters.to) {
          setError('The "from" date must be on or before the "to" date.');
          return;
        }
        setError('');

        const [page, actorList] = await Promise.all([fetchPage(supabase, filters, 0), supabase.rpc('activity_log_actors')]);
        setLogs(page);
        setHasMore(page.length === PAGE_SIZE);
        if (!actorList.error) setActors(actorList.data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load the activity log'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, filters]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage(supabase, filters, logs.length);
      setLogs((current) => [...current, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load more entries'));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <PageLoading />;
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only administrators can view the activity log.</p>
        <Link href="/dashboard" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const sortedActors = [...actors].sort((a, b) => (a.actor_name || '').localeCompare(b.actor_name || ''));

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Activity Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Activity Log
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            Recorded automatically by the database. Entries cannot be edited or deleted and are kept for one year.
          </p>
        </div>
      </section>

      {/* 2. Filters & Log Timeline */}
      <div className="space-y-6 text-stone-950">
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-stone-950 tracking-wider">Log Filters</h2>
            {(filters.action || filters.actor || filters.from || filters.to) && (
              <button
                onClick={() => setFilters(emptyFilters)}
                className="text-xs font-extrabold text-amber-700 hover:text-amber-800 underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider">
              <span>Action Category</span>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className={inputClass}
              >
                <option value="">All actions</option>
                {ACTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    <option value={`group:${group.label}`}>All {group.label.toLowerCase()}</option>
                    {group.actions.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider">
              <span>User / Actor</span>
              <select
                value={filters.actor}
                onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
                className={inputClass}
              >
                <option value="">Everyone</option>
                {sortedActors.map((a) => (
                  <option key={a.actor_id} value={a.actor_id}>{a.actor_name || 'Unnamed user'}</option>
                ))}
                <option value="none">System / Deleted account</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider">
              <span>From Date</span>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-black text-stone-800 tracking-wider">
              <span>To Date</span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}

        {/* Entries List */}
        {logs.length === 0 && error ? null : logs.length === 0 ? (
          <p className="text-stone-500 text-center py-12 font-bold tracking-wider">No activity matches these filters.</p>
        ) : (
          <div className="bg-white border border-stone-200/90 rounded-2xl divide-y divide-stone-200/80 shadow-xs overflow-hidden">
            {logs.map((log) => {
              const tournamentId =
                log.details.tournament_id ?? (log.entity_type === 'tournament' ? log.entity_id : null);
              const showLink = tournamentId && log.action !== 'tournament.deleted';
              return (
                <div
                  key={log.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <time className="text-xs text-stone-500 font-bold sm:w-44 shrink-0" dateTime={log.created_at}>
                      {new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                    <p className="font-extrabold text-stone-900 text-xs sm:text-sm tracking-wide">
                      {describeActivity(log)}
                    </p>
                  </div>
                  {showLink && (
                    <Link
                      href={`/tournaments/${tournamentId}`}
                      className="text-xs font-black text-amber-700 hover:text-amber-800 underline shrink-0"
                    >
                      View Tournament →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="text-center pt-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-900 font-black px-6 py-2.5 text-xs uppercase tracking-widest shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? 'Loading...' : 'Load More Entries'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
