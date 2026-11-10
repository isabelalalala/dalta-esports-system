'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Game, TeamListEntry } from '@/utils/types';
import { usePageTitle } from '@/utils/page-title';
import { can } from '@/utils/permissions';
import { formatDateTime } from '@/utils/tournaments';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import RemoveTeamDialog from '@/components/RemoveTeamDialog';
import { Trash2 } from 'lucide-react';
import GameBadge from '@/components/GameBadge';

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-500 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none text-base sm:text-sm';

interface RemovedRow {
  id: string;
  name: string;
  removed_at: string | null;
  games: { name: string } | null;
  team_removals: { reason: string; removed_at: string }[];
}

// Team management for organizers (admin/staff): every active team with a Remove action,
// and the removed teams with their reason (restore happens on the team page, admin only).
export default function AdminTeamsPage() {
  const supabase = createClient();
  usePageTitle('Team Management');
  const [role, setRole] = useState('');
  const [tab, setTab] = useState<'active' | 'removed'>('active');
  const [games, setGames] = useState<Game[]>([]);
  const [gameId, setGameId] = useState('');
  const [search, setSearch] = useState('');
  const [teams, setTeams] = useState<TeamListEntry[]>([]);
  const [removed, setRemoved] = useState<RemovedRow[]>([]);
  const [removing, setRemoving] = useState<TeamListEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // Search waits a moment after typing so every key press isn't a request
    const timer = setTimeout(async () => {
      try {
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role');
        if (roleError) throw roleError;
        setRole(myRole ?? '');
        if (!can(myRole, 'team.remove')) return;

        const gamesRes = await supabase.from('games').select('*').order('name');
        if (gamesRes.error) throw gamesRes.error;
        setGames(gamesRes.data || []);

        if (tab === 'active') {
          const { data, error: listError } = await supabase.rpc('list_teams', {
            p_search: search.trim() || undefined,
            p_game_id: gameId || undefined,
            p_limit: 100,
          });
          if (listError) throw listError;
          setTeams((data || []) as TeamListEntry[]);
        } else {
          let query = supabase
            .from('teams')
            .select('id, name, removed_at, games(name), team_removals(reason, removed_at)')
            .eq('is_removed', true)
            .order('removed_at', { ascending: false })
            .limit(100);
          if (gameId) query = query.eq('game_id', gameId);
          if (search.trim()) query = query.ilike('name', `%${search.trim().replace(/[%_]/g, '')}%`);
          const { data, error: listError } = await query;
          if (listError) throw listError;
          setRemoved((data || []) as unknown as RemovedRow[]);
        }
        setError('');
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load teams'));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [supabase, tab, gameId, search, reloadCount]);

  if (loading) return <PageLoading />;
  if (!role && error) return <PageError message={error} />;
  if (!can(role, 'team.remove')) {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center space-y-4">
        <p className="font-extrabold text-stone-900">Only tournament organizers can manage teams.</p>
        <Link href="/dashboard" className="inline-block text-maroon font-bold underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const tabClass = (t: 'active' | 'removed') =>
    `px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
      tab === t ? 'bg-gold text-stone-950 shadow-xs' : 'text-stone-700 hover:bg-stone-100'
    }`;

  return (
    <div className="w-full space-y-8">
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="divisions_hero_bg_path" alt="DALTA Esports Teams Banner" />
        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1 className="text-display font-black tracking-wider uppercase leading-tight text-white">
            Team Management
          </h1>
          <p className="text-base sm:text-lg font-medium leading-relaxed text-white">
            Every team in the system. Remove a team that breaks the rules; the record stays for reports.
          </p>
        </div>
      </section>

      <div className="space-y-6 text-stone-950">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm font-bold">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm font-bold">
            {message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div role="tablist" aria-label="Team status" className="inline-flex flex-wrap gap-1 p-1 rounded-2xl border border-stone-200/90 bg-white shadow-2xs">
            <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')} className={tabClass('active')}>
              Active
            </button>
            <button role="tab" aria-selected={tab === 'removed'} onClick={() => setTab('removed')} className={tabClass('removed')}>
              Removed
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team name"
              aria-label="Search team name"
              className={inputClass}
            />
            <select value={gameId} onChange={(e) => setGameId(e.target.value)} aria-label="Game" className={inputClass}>
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {tab === 'active' ? (
          teams.length === 0 ? (
            <p className="rounded-2xl border border-stone-200/90 bg-white p-6 text-center text-stone-600">No teams found.</p>
          ) : (
            <ul className="space-y-3">
              {teams.map((t) => (
                <li
                  key={t.id}
                  className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <Link href={`/teams/${t.id}`} className="font-black text-stone-950 hover:text-maroon break-words">
                      {t.name}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-stone-600 break-words">
                      <GameBadge name={t.game_name} game={t.game_id} size="xs" withName /> · Captain: {t.captain_name || 'Unnamed'} · {t.member_count}/{t.max_players} players
                      {t.recruiting && ' · Recruiting'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                      href={`/teams/${t.id}`}
                      className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-black uppercase tracking-wider"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => setRemoving(t)}
                      className="px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : removed.length === 0 ? (
          <p className="rounded-2xl border border-stone-200/90 bg-white p-6 text-center text-stone-600">No removed teams.</p>
        ) : (
          <ul className="space-y-3">
            {removed.map((t) => {
              // The latest removal holds the current reason (a team can be removed again after a restore)
              const latest = [...t.team_removals].sort((a, b) => b.removed_at.localeCompare(a.removed_at))[0];
              return (
                <li key={t.id} className="bg-white border border-stone-200/90 rounded-2xl shadow-xs p-4 sm:p-5 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Link href={`/teams/${t.id}`} className="font-black text-stone-950 hover:text-maroon break-words">
                      {t.name}
                    </Link>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-stone-600">
                      <GameBadge name={t.games?.name} size="xs" withName /> · removed {formatDateTime(t.removed_at)}
                    </span>
                  </div>
                  {latest && <p className="text-sm text-stone-800 break-words">Reason: {latest.reason}</p>}
                  {can(role, 'team.restore') && (
                    <Link href={`/teams/${t.id}`} className="inline-block text-sm font-bold text-maroon underline">
                      Open to restore
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {removing && (
        <RemoveTeamDialog
          team={{ id: removing.id, name: removing.name, gameName: removing.game_name }}
          onClose={() => setRemoving(null)}
          onRemoved={(summary) => {
            setRemoving(null);
            setMessage(summary);
            setReloadCount((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
