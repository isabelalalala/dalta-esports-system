'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { ACTION_GROUPS, describeActivity, type ActivityLog } from '@/utils/activity';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';

const PAGE_SIZE = 50;

const inputClass =
  'border border-brownlight bg-sitebg px-3 py-2 text-white outline-none focus:border-gold';

// action: '' = all, 'group:<label>' = a whole group, otherwise one action.
// actor: '' = everyone, 'none' = no user (SQL Editor or a deleted account), otherwise a user id.
interface Filters {
  action: string;
  actor: string;
  from: string;
  to: string;
}

const emptyFilters: Filters = { action: '', actor: '', from: '', to: '' };

// YYYY-MM-DD (viewer's local day) -> the moment that day starts, for comparing with created_at
function startOfDay(date: string, addDays = 0) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
}

// One page of entries, filtered in the database (the log is too big to load all at once)
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
  // "to" is inclusive: everything before the next day starts
  if (filters.to) query = query.lt('created_at', startOfDay(filters.to, 1));

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ActivityLog[];
}

// Activity log (admin only): who did what, newest first.
export default function ActivityLogPage() {
  const supabase = createClient();
  const [role, setRole] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [actors, setActors] = useState<{ actor_id: string; actor_name: string | null }[]>([]);
  // False once a page came back with fewer than PAGE_SIZE entries
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  // First page, again whenever the filters change
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

  // Hiding the page is only for convenience; RLS returns nothing to other roles.
  // The role couldn't be loaded: show why, not "only admins"
  if (!role && error) return <PageError message={error} />;
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only admins can view the activity log.{' '}
        <Link href="/dashboard" className="text-gold underline">Back to Dashboard</Link>
      </div>
    );
  }

  const sortedActors = [...actors].sort((a, b) => (a.actor_name || '').localeCompare(b.actor_name || ''));

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
            ← Back to Dashboard
          </Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Activity Log</h1>
          <p className="text-gray-400 text-sm mt-2">
            Recorded automatically by the database. Entries can&apos;t be edited or deleted, and are kept for one year.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-sitecard border border-brownlight p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
            Action
            <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className={inputClass}>
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
          <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
            User
            <select value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} className={inputClass}>
              <option value="">Everyone</option>
              {sortedActors.map((a) => (
                <option key={a.actor_id} value={a.actor_id}>{a.actor_name || 'Unnamed user'}</option>
              ))}
              <option value="none">No user (SQL Editor or deleted account)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
            From
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase font-bold text-gray-400">
            To
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={inputClass} />
          </label>
          {(filters.action || filters.actor || filters.from || filters.to) && (
            <button onClick={() => setFilters(emptyFilters)} className="text-sm text-gold hover:underline justify-self-start">
              Clear filters
            </button>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}

        {/* A failed load shows the error above, not "nothing here" */}
        {logs.length === 0 && error ? null : logs.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No activity matches these filters.</p>
        ) : (
          <ul className="bg-sitecard border border-brown divide-y divide-brown">
            {logs.map((log) => {
              // Link to the tournament involved, unless it was deleted
              const tournamentId =
                log.details.tournament_id ?? (log.entity_type === 'tournament' ? log.entity_id : null);
              const showLink = tournamentId && log.action !== 'tournament.deleted';
              return (
                <li key={log.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <time className="text-xs text-gray-500 sm:w-40 shrink-0" dateTime={log.created_at}>
                    {new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </time>
                  <p className="flex-1 text-gray-200">{describeActivity(log)}</p>
                  {showLink && (
                    <Link href={`/tournaments/${tournamentId}`} className="text-xs text-gold hover:underline shrink-0">
                      View tournament
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="border border-gold text-gold px-6 py-2 font-bold hover:bg-gold/10 disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
