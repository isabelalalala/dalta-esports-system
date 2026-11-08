'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Game, TeamListEntry } from '@/utils/types';
import AskToJoin from '@/components/AskToJoin';
import { SectionLoading } from '@/components/PageLoading';
import { Search, Users } from 'lucide-react';

const PAGE_SIZE = 30;

interface Props {
  games: Game[];
  // Only players can ask to join
  isPlayer: boolean;
  // Teams I'm on, and the games I already have a team for (one team per game)
  myTeamIds: string[];
  myGameIds: string[];
  // Games I have a game profile (IGN) for: needed to join a team of that game
  profileGameIds: string[];
  // My open join requests: team id -> request id
  myRequests: Record<string, string>;
  onChanged: () => void;
  // Start with "Recruiting only" on (the nav's Recruiting link: /teams?tab=all&recruiting=1)
  initialRecruitingOnly?: boolean;
}

// "All teams": every team, searchable, from list_teams() (captain name and roster count
// come from the database because profiles are private).
export default function TeamDirectory({
  games, isPlayer, myTeamIds, myGameIds, profileGameIds, myRequests, onChanged, initialRecruitingOnly = false,
}: Props) {
  const supabase = createClient();
  const [search, setSearch] = useState('');
  // The search sent to the database, a moment after typing stops
  const [query, setQuery] = useState('');
  const [gameId, setGameId] = useState('');
  const [recruitingOnly, setRecruitingOnly] = useState(initialRecruitingOnly);
  const [teams, setTeams] = useState<TeamListEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = async (offset: number) => {
    const { data, error: rpcError } = await supabase.rpc('list_teams', {
      p_search: query || undefined,
      p_game_id: gameId || undefined,
      p_recruiting_only: recruitingOnly,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    if (rpcError) throw rpcError;
    return (data || []) as TeamListEntry[];
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const page = await fetchPage(0);
        setTeams(page);
        setHasMore(page.length === PAGE_SIZE);
        setError('');
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load teams.'));
      } finally {
        setLoading(false);
      }
    };
    load();
    // fetchPage only reads the filters listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, query, gameId, recruitingOnly]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage(teams.length);
      setTeams((current) => [...current, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load more teams.'));
    } finally {
      setLoadingMore(false);
    }
  };

  // What the player can do on a card (the database checks the same rules again)
  const joinState = (t: TeamListEntry) => {
    if (!isPlayer || !t.recruiting || myTeamIds.includes(t.id)) return null;
    if (myRequests[t.id]) return 'requested';
    if (t.member_count >= t.max_players) return 'full';
    if (myGameIds.includes(t.game_id)) return null;
    if (!profileGameIds.includes(t.game_id)) return 'no-profile';
    return 'can-ask';
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-4 sm:p-6 shadow-xs flex flex-col @3xl:flex-row gap-3 @3xl:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search teams</span>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team name..."
            className="w-full pl-10 pr-3 py-3 rounded-xl bg-white text-stone-950 border border-stone-300 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none font-medium text-sm"
          />
        </label>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          aria-label="Filter by game"
          className="@3xl:w-56 p-3 rounded-xl bg-white text-stone-950 border border-stone-300 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none font-medium text-sm"
        >
          <option value="">All games</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm font-bold text-stone-800 normal-case shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={recruitingOnly}
            onChange={(e) => setRecruitingOnly(e.target.checked)}
            className="h-4 w-4 accent-amber-600"
          />
          Recruiting only
        </label>
      </div>

      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}

      {loading ? (
        <SectionLoading label="Loading teams..." />
      ) : teams.length === 0 && !error ? (
        <div className="rounded-3xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-12 text-center flex flex-col items-center gap-2">
          <Users className="w-6 h-6 text-stone-500" />
          <p className="font-black text-stone-900">No teams found.</p>
          <p className="text-xs text-stone-500 font-medium">Try another name or game.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 @3xl:grid-cols-2 @5xl:grid-cols-3 gap-4 sm:gap-6">
          {teams.map((t) => {
            const state = joinState(t);
            return (
              <li
                key={t.id}
                className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-maroon tracking-widest uppercase bg-maroon/10 px-2.5 py-0.5 rounded-md">
                    {t.game_name}
                  </span>
                  <div className="flex items-center gap-2">
                    {t.recruiting && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Recruiting
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                      {t.member_count} / {t.max_players}
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-stone-950 uppercase tracking-wide break-words">
                    {t.name}
                  </h3>
                  <p className="text-xs text-stone-600 font-semibold mt-0.5 break-words">
                    Captain: {t.captain_name || 'Unknown'}
                  </p>
                  {t.description && (
                    <p className="text-xs text-stone-600 font-medium mt-2 line-clamp-2 break-words">{t.description}</p>
                  )}
                </div>

                <div className="mt-auto pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/teams/${t.id}`}
                    className="text-xs font-black text-maroon hover:text-amber-700 uppercase tracking-wider"
                  >
                    View team →
                  </Link>
                  {state === 'can-ask' && (
                    <AskToJoin teamId={t.id} requestId={null} onChanged={onChanged} compact />
                  )}
                  {state === 'requested' && (
                    <AskToJoin teamId={t.id} requestId={myRequests[t.id]} onChanged={onChanged} compact />
                  )}
                  {state === 'full' && (
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Roster full</span>
                  )}
                  {state === 'no-profile' && (
                    <Link href="/profile" className="text-[11px] font-bold text-stone-600 hover:text-maroon underline">
                      Add a {t.game_name} profile to join
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-xl border border-stone-300 bg-white text-stone-800 font-black px-5 py-2.5 text-xs uppercase tracking-wider shadow-2xs hover:border-amber-400 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
