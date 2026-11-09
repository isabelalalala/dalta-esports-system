'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Game, TeamListEntry } from '@/utils/types';
import { fieldFor, parseSchema } from '@/utils/game-profiles';
import { TEAM_SORTS, type TeamSort } from '@/utils/team-cards';
import TeamCard, { type TeamCardViewer } from '@/components/TeamCard';
import { SectionLoading } from '@/components/PageLoading';
import { Plus, Search, Users } from 'lucide-react';

const PAGE_SIZE = 30;

interface Props {
  games: Game[];
  viewer: TeamCardViewer;
  onChanged: () => void;
  // "My teams" tab: only the viewer's teams, no filters
  mine?: boolean;
  // Empty state button (players only); omitted = no button
  onCreateTeam?: () => void;
  // Start with "Recruiting only" on (the nav's Recruiting link: /teams?tab=all&recruiting=1)
  initialRecruitingOnly?: boolean;
  // Search text from the URL (/teams?tab=all&q=...), e.g. coming from the site search
  initialSearch?: string;
  // Bump to reload (e.g. after a roster change)
  reloadKey?: number;
}

const fieldClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none font-medium text-sm disabled:opacity-60';

// "All teams" (and the "My teams" grid): team cards from list_teams() (captain, avatars and roster
// count come from the database because profiles are private). Filters: search, game, role and
// rank (from the chosen game's profile form, Phase 8), recruiting only; sorting; a result count.
export default function TeamDirectory({
  games, viewer, onChanged, mine = false, onCreateTeam, initialRecruitingOnly = false, initialSearch = '', reloadKey = 0,
}: Props) {
  const supabase = createClient();
  const [search, setSearch] = useState(initialSearch);
  // The search sent to the database, a moment after typing stops
  const [query, setQuery] = useState(initialSearch);
  const [gameId, setGameId] = useState('');
  const [role, setRole] = useState('');
  const [rank, setRank] = useState('');
  const [sort, setSort] = useState<TeamSort>(initialRecruitingOnly ? 'recruiting' : 'newest');
  const [recruitingOnly, setRecruitingOnly] = useState(initialRecruitingOnly);
  const [teams, setTeams] = useState<TeamListEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Role and rank lists of the chosen game (its profile form)
  const schemas = useMemo(() => Object.fromEntries(games.map((g) => [g.id, g.profile_schema])), [games]);
  const selectedSchema = parseSchema(gameId ? schemas[gameId] : null);
  const roleOptions = fieldFor(selectedSchema, 'role')?.options ?? [];
  const rankOptions = fieldFor(selectedSchema, 'rank')?.options ?? [];

  const fetchPage = async (offset: number) => {
    const { data, error: rpcError } = await supabase.rpc('list_teams', {
      p_search: mine ? undefined : query || undefined,
      p_game_id: mine ? undefined : gameId || undefined,
      p_recruiting_only: !mine && recruitingOnly,
      p_role: mine ? undefined : role || undefined,
      p_rank: mine ? undefined : rank || undefined,
      p_sort: mine ? 'name' : sort,
      p_mine: mine,
      p_limit: mine ? 100 : PAGE_SIZE,
      p_offset: offset,
    });
    if (rpcError) throw rpcError;
    return (data || []) as unknown as TeamListEntry[];
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const page = await fetchPage(0);
        setTeams(page);
        setTotal(page[0]?.total_count ?? 0);
        setHasMore(!mine && page.length === PAGE_SIZE);
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
  }, [supabase, query, gameId, role, rank, sort, recruitingOnly, mine, reloadKey]);

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

  const filtered = Boolean(query || gameId || role || rank || recruitingOnly);

  return (
    <div className="space-y-5">
      {!mine && (
        <div className="rounded-3xl border border-stone-200/90 bg-white p-4 sm:p-6 shadow-xs space-y-3">
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))]">
            <label className="relative col-span-full @3xl:col-span-2">
              <span className="sr-only">Search teams</span>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team name..."
                className={`${fieldClass} pl-10`}
              />
            </label>
            <select
              value={gameId}
              onChange={(e) => {
                setGameId(e.target.value);
                // Roles and ranks belong to one game
                setRole('');
                setRank('');
              }}
              aria-label="Filter by game"
              className={fieldClass}
            >
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-label="Filter by role the team is looking for"
              disabled={!gameId || roleOptions.length === 0}
              title={gameId ? undefined : 'Pick a game first'}
              className={fieldClass}
            >
              <option value="">{gameId ? 'Any role' : 'Role (pick a game)'}</option>
              {roleOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <select
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              aria-label="Your rank: teams that accept it"
              disabled={!gameId || rankOptions.length === 0}
              title={gameId ? undefined : 'Pick a game first'}
              className={fieldClass}
            >
              <option value="">{gameId ? 'Any rank' : 'Rank (pick a game)'}</option>
              {rankOptions.map((o) => (
                <option key={o.id} value={o.id}>My rank: {o.label}</option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as TeamSort)} aria-label="Sort teams" className={fieldClass}>
              {TEAM_SORTS.map((s) => (
                <option key={s.value} value={s.value}>Sort: {s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-bold text-stone-800 normal-case cursor-pointer">
              <input
                type="checkbox"
                checked={recruitingOnly}
                onChange={(e) => setRecruitingOnly(e.target.checked)}
                className="h-4 w-4 accent-amber-600"
              />
              Recruiting only
            </label>
            {!loading && !error && (
              <p className="text-sm font-black text-stone-700" aria-live="polite">
                {total} {total === 1 ? 'team' : 'teams'}
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}

      {loading ? (
        <SectionLoading label="Loading teams..." />
      ) : teams.length === 0 && !error ? (
        <div className="rounded-3xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-12 text-center flex flex-col items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-stone-200/80 text-stone-600">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <p className="font-black text-stone-900">
            {mine ? 'You are not on any team yet.' : filtered ? 'No teams match these filters.' : 'No teams yet. Be the first!'}
          </p>
          <p className="max-w-prose text-sm text-stone-600 font-medium">
            {mine
              ? 'Create a team, wait for a captain to invite you, or open All teams and ask to join one that is recruiting.'
              : filtered
              ? 'Try another name, game, role or rank, or turn off "Recruiting only".'
              : 'Start a squad for your game and invite your friends.'}
          </p>
          {onCreateTeam && (
            <button type="button" onClick={onCreateTeam} className="btn btn-primary mt-1">
              <Plus className="size-4" aria-hidden="true" /> Create team
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4 sm:gap-6">
          {teams.map((t) => (
            <li key={t.id} className="min-w-0">
              <TeamCard team={t} profileSchema={schemas[t.game_id]} viewer={viewer} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button type="button" onClick={handleLoadMore} disabled={loadingMore} className="btn btn-secondary">
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
