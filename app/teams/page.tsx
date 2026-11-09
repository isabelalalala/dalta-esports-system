'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getErrorMessage } from '@/utils/errors';
import type { Game, Team } from '@/utils/types';
import TeamInvites from '@/components/TeamInvites';
import TeamDirectory from '@/components/TeamDirectory';
import AskToJoin from '@/components/AskToJoin';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import { can } from '@/utils/permissions';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Plus, Shield, AlertCircle } from 'lucide-react';
import GameBadge from '@/components/GameBadge';

const inputClass =
  'w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

// My open join requests, with the team's name (for the My teams tab)
interface MyJoinRequest {
  id: string;
  team_id: string;
  teams: { name: string; games: { name: string } | null } | null;
}

export default function TeamsPage() {
  usePageTitle('Teams');
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  // Games the player has a game profile (IGN) for: a team can only be created for these
  const [profileGameIds, setProfileGameIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [gameId, setGameId] = useState('');
  const [description, setDescription] = useState('');
  // Open to join requests right away (can be changed later on the team page)
  const [recruiting, setRecruiting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [role, setRole] = useState('');
  const [myRequests, setMyRequests] = useState<MyJoinRequest[]>([]);
  // The tab lives in the URL (?tab=mine|all, ?recruiting=1), so the nav links open the right view
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'mine' || tabParam === 'all' ? tabParam : null;
  const recruitingParam = searchParams.get('recruiting') === '1';
  const searchParam = (searchParams.get('q') ?? '').slice(0, 100);
  const setTab = (t: 'mine' | 'all') => router.replace(`/teams?tab=${t}`, { scroll: false });
  const [myId, setMyId] = useState('');

  // Live updates for "My teams": any roster change (someone joins or leaves one of my teams; rosters
  // are small, so any team_members change just reloads), my join requests and my invites.
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  useRealtimeRefresh(myId ? `my-teams-${myId}` : null, [
    { table: 'team_members' },
    { table: 'team_join_requests', filter: `user_id=eq.${myId}` },
    { table: 'team_invites', filter: `invited_user_id=eq.${myId}` },
  ], reload, 800);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        setMyId(session.user.id);

        const [gamesRes, teamsRes, profilesRes, roleRes, requestsRes] = await Promise.all([
          supabase.from('games').select('*').order('name'),
          supabase
            .from('team_members')
            .select('teams(*, games(*), team_members(count))')
            .eq('user_id', session.user.id),
          supabase.from('player_game_profiles').select('game_id').eq('user_id', session.user.id),
          supabase.from('profiles').select('role').eq('id', session.user.id).single(),
          supabase
            .from('team_join_requests')
            .select('id, team_id, teams(name, games(name))')
            .eq('user_id', session.user.id)
            .eq('status', 'pending'),
        ]);
        if (gamesRes.error) throw gamesRes.error;
        if (teamsRes.error) throw teamsRes.error;
        if (profilesRes.error) throw profilesRes.error;
        if (roleRes.error) throw roleRes.error;
        if (requestsRes.error) throw requestsRes.error;
        setRole(roleRes.data.role);
        setMyRequests((requestsRes.data || []) as unknown as MyJoinRequest[]);
        setProfileGameIds((profilesRes.data || []).map((p) => p.game_id));
        setGames(gamesRes.data || []);
        setTeams((teamsRes.data || []).map((row) => row.teams as unknown as Team));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load teams'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  const selectedGameIsSolo = (games.find((g) => g.id === gameId)?.max_players ?? 2) <= 1;

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { error: insertError } = await supabase.from('teams').insert([
        {
          name: newTeamName.trim(),
          game_id: gameId,
          description: description.trim() || null,
          captain_id: session.user.id,
          // Solo games can't recruit (one player per team)
          recruiting: recruiting && !selectedGameIsSolo,
        },
      ]);
      if (insertError) throw insertError;

      setNewTeamName('');
      setGameId('');
      setDescription('');
      setRecruiting(false);
      setShowCreate(false);
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create team'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading label="Loading teams..." />;
  }

  // Only players have teams of their own; everyone else just browses the directory
  const isPlayer = can(role, 'team.create');
  const activeTab = isPlayer ? (tab ?? 'mine') : 'all';
  // Who is looking at the cards (decides the join button)
  const viewer = {
    isPlayer,
    profileGameIds,
    myGameIds: teams.map((t) => t.game_id),
    myRequests: Object.fromEntries(myRequests.map((r) => [r.team_id, r.id])),
  };
  const openCreate = () => {
    setTab('mine');
    setShowCreate(true);
  };
  const tabClass = (t: 'mine' | 'all') =>
    `px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
      activeTab === t ? 'bg-gold text-stone-950 shadow-xs' : 'text-stone-700 hover:bg-stone-100'
    }`;

  return (
    // The layout (SiteNavLayout) renders the main element and the page padding
    <div className="w-full text-stone-950">
      {/* Full width like the other sections: the layout's padding is the only side space */}
      <div className="w-full space-y-8">
        {/* 1. Main Hero Container */}
        <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 @5xl:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
          <PageHeroBackground specificKey="divisions_hero_bg_path" alt="DALTA Esports Teams Banner" />

          {/* Action Bar inside Hero: Back link & Create Team CTA */}
          <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
            >
              ← Back to Dashboard
            </Link>

            {/* Only players create teams (the database refuses others anyway) */}
            {isPlayer && (
              <button
                onClick={() => {
                  setTab('mine');
                  setShowCreate(!showCreate);
                }}
                className="bg-gold text-stone-950 px-5 py-2.5 rounded-xl font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {showCreate ? 'Close Form' : 'Create Team'}
              </button>
            )}
          </div>

          <div className="relative z-10 max-w-prose mx-auto space-y-3 pt-2">
            <h1
              className="animate-hero-title text-display font-black tracking-wider uppercase leading-tight text-white"
            >
              Teams
            </h1>
            <p
              className="animate-hero-tagline text-xs sm:text-sm font-semibold leading-relaxed text-white"
            >
              Manage your squads, or browse every team and ask to join one that is recruiting.
            </p>
          </div>
        </section>

        {/* Global Notifications */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-3 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs: my teams / every team (players only: others have no teams of their own) */}
        {isPlayer && (
          <div role="tablist" aria-label="Teams" className="inline-flex flex-wrap gap-1 p-1 rounded-2xl border border-stone-200/90 bg-white shadow-2xs">
            <button role="tab" aria-selected={activeTab === 'mine'} onClick={() => setTab('mine')} className={tabClass('mine')}>
              My teams
            </button>
            <button role="tab" aria-selected={activeTab === 'all'} onClick={() => setTab('all')} className={tabClass('all')}>
              All teams
            </button>
          </div>
        )}

        {/* Organizers manage teams (incl. removing them) on /admin/teams */}
        {can(role, 'team.remove') && (
          <Link
            href="/admin/teams"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-maroon hover:underline"
          >
            <Shield className="w-4 h-4" /> Manage teams
          </Link>
        )}

        {activeTab === 'all' ? (
          <TeamDirectory
            key={recruitingParam ? 'recruiting' : 'all'}
            initialRecruitingOnly={recruitingParam}
            initialSearch={searchParam}
            games={games}
            viewer={viewer}
            reloadKey={reloadCount}
            onCreateTeam={isPlayer ? openCreate : undefined}
            onChanged={() => setReloadCount((n) => n + 1)}
          />
        ) : (
        <>
        {/* Open Invites Section */}
        <TeamInvites onAnswered={() => setReloadCount((n) => n + 1)} />

        {/* My open join requests */}
        {myRequests.length > 0 && (
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">Join requests sent</h2>
            <ul className="space-y-3">
              {myRequests.map((r) => (
                <li
                  key={r.id}
                  className="p-4 rounded-2xl border border-stone-200/80 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <Link href={`/teams/${r.team_id}`} className="font-black text-stone-950 hover:text-maroon break-words">
                      {r.teams?.name || 'Team'}
                    </Link>
                    <GameBadge name={r.teams?.games?.name} size="xs" withName nameClassName="text-stone-500 font-semibold" />
                  </div>
                  <AskToJoin teamId={r.team_id} requestId={r.id} onChanged={() => setReloadCount((n) => n + 1)} compact />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Create Team Form Card */}
        {showCreate && (
          <form
            onSubmit={handleCreateTeam}
            className="animate-stagger-1 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-md space-y-6"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">
                  Create New Team
                </h2>
                <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                  You will automatically become the team captain for this squad.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-stone-700 tracking-wider">
                  Team Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. FUEGO ALTA"
                  aria-label="Team Name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-stone-700 tracking-wider">
                  Game Discipline *
                </label>
                <select
                  aria-label="Select Game"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">-- Select Game Discipline --</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id} disabled={!profileGameIds.includes(g.id)}>
                      {g.name} (Max {g.max_players} {g.max_players === 1 ? 'Player' : 'Players'})
                      {!profileGameIds.includes(g.id) && ' (add game profile first)'}
                    </option>
                  ))}
                </select>
                {/* The captain needs an IGN for the team's game, like every invited player */}
                {games.some((g) => !profileGameIds.includes(g.id)) && (
                  <p className="mt-2 text-xs font-medium text-stone-500 normal-case">
                    You can only create a team for a game you have a game profile (IGN) for.{' '}
                    <Link href="/profile" className="font-bold text-maroon underline">
                      Add one on your Profile
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-stone-700 tracking-wider">
                Team Description (Optional)
              </label>
              <textarea
                placeholder="Brief squad biography, goals, or division notes..."
                aria-label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </div>

            {/* Recruiting: shows the team as open in All teams so players can ask to join */}
            <label
              className={`flex items-start gap-3 rounded-2xl border p-4 normal-case ${
                selectedGameIsSolo
                  ? 'border-stone-200 bg-stone-50 text-stone-500 cursor-not-allowed'
                  : 'border-stone-200 bg-white hover:border-gold cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={recruiting && !selectedGameIsSolo}
                onChange={(e) => setRecruiting(e.target.checked)}
                disabled={selectedGameIsSolo}
                className="mt-0.5 h-4 w-4 accent-amber-600"
              />
              <span>
                <span className="block text-sm font-bold text-stone-950">Open for recruiting</span>
                <span className="block text-xs text-stone-600 font-medium mt-0.5">
                  {selectedGameIsSolo
                    ? 'Solo games have one player per team, so they can’t recruit.'
                    : 'Players can find your team under All teams and ask to join. You accept or decline each request, and you can turn this off any time on the team page.'}
                </span>
              </span>
            </label>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? 'Creating Squad...' : 'Confirm Team Creation'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-3 text-xs tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* My teams: the same cards as All teams (list_teams with p_mine) */}
        {!error && (
          <TeamDirectory
            mine
            games={games}
            viewer={viewer}
            reloadKey={reloadCount}
            onCreateTeam={isPlayer && !showCreate ? openCreate : undefined}
            onChanged={() => setReloadCount((n) => n + 1)}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
}
