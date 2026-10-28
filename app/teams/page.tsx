'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Game, Team } from '@/utils/types';
import TeamInvites from '@/components/TeamInvites';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Users, Plus, Shield, AlertCircle, Gamepad2 } from 'lucide-react';

const inputClass =
  'w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-[#FFCC37] focus:ring-2 focus:ring-[#FFCC37]/25 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

// Match game name or id to official logo asset
function getGameLogo(game: string, gameId?: string | null): string | null {
  const g = (game || '').toLowerCase().trim();
  const id = (gameId || '').toLowerCase().trim();

  if (g.includes('mlbb') || g.includes('mobile legends') || id.includes('mlbb')) {
    return '/MLBB LOGO.png';
  }
  if (g.includes('valo') || g.includes('valorant') || id.includes('valo')) {
    return '/VALO LOGO.png';
  }
  if (g.includes('tekken') || id.includes('tekken')) {
    return '/TEKKEMN 8 LOGO.png';
  }
  if (g.includes('codm') || g.includes('call of duty') || id.includes('cod')) {
    return '/CODM LOGO.png';
  }
  return null;
}

export default function TeamsPage() {
  usePageTitle('My Teams');
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [gameId, setGameId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const [gamesRes, teamsRes] = await Promise.all([
          supabase.from('games').select('*').order('name'),
          supabase
            .from('team_members')
            .select('teams(*, games(*), team_members(count))')
            .eq('user_id', session.user.id),
        ]);
        if (gamesRes.error) throw gamesRes.error;
        if (teamsRes.error) throw teamsRes.error;
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
        },
      ]);
      if (insertError) throw insertError;

      setNewTeamName('');
      setGameId('');
      setDescription('');
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

  return (
    <main
      id="main-content"
      className="flex-1 w-full min-h-[calc(100vh-160px)] bg-white text-stone-950 px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-10 uppercase"
    >
      <div className="w-full max-w-6xl mx-auto space-y-8">
        {/* 1. Main Hero Container */}
        <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
          <PageHeroBackground specificKey="divisions_hero_bg_path" alt="DALTA Esports Teams Banner" />

          {/* Action Bar inside Hero: Back link & Create Team CTA */}
          <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
            >
              ← Back to Dashboard
            </Link>

            <button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-gold text-stone-950 px-5 py-2.5 rounded-xl font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              {showCreate ? 'Close Form' : 'Create Team'}
            </button>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
            <h1
              className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
              style={{ color: '#ffffff' }}
            >
              My Teams
            </h1>
            <p
              className="animate-hero-tagline text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider leading-relaxed"
              style={{ color: '#ffffff' }}
            >
              Manage your competitive squads, rosters, and tournament lineups.
            </p>
          </div>
        </section>

        {/* Global Notifications */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Open Invites Section */}
        <TeamInvites onAnswered={() => setReloadCount((n) => n + 1)} />

        {/* Create Team Form Card */}
        {showCreate && (
          <form
            onSubmit={handleCreateTeam}
            className="animate-stagger-1 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-md space-y-6"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-[#5B271E]/10 border border-[#5B271E]/20 text-[#5B271E] grid place-items-center shadow-2xs">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
                    <option key={g.id} value={g.id}>
                      {g.name} (Max {g.max_players} {g.max_players === 1 ? 'Player' : 'Players'})
                    </option>
                  ))}
                </select>
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

        {/* Empty State */}
        {!error && teams.length === 0 && (
          <div className="animate-stagger-1 w-full rounded-3xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-14 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-stone-200/80 grid place-items-center text-stone-600 mb-1">
              <Users className="w-6 h-6" />
            </div>
            <p className="font-black text-stone-900 text-base uppercase tracking-wider">
              You are not on any team yet.
            </p>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wide max-w-md">
              Click &quot;+ Create Team&quot; above to start a roster, or ask a team captain to send you an invite.
            </p>
          </div>
        )}

        {/* 2. Teams Grid */}
        {teams.length > 0 && (
          <div className="animate-stagger-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full">
            {teams.map((team) => {
              const logo = getGameLogo(team.games?.name || '', team.game_id);
              const membersCount = team.team_members?.[0]?.count || 0;
              const maxPlayers = team.games?.max_players || 5;

              return (
                <div
                  key={team.id}
                  className="group rounded-3xl border border-stone-200/90 bg-white shadow-xs hover:shadow-xl hover:-translate-y-1.5 hover:border-[#FFCC37]/80 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  {/* Game Showcase Header */}
                  <div className="relative aspect-video bg-[#0e0c0b] border-b border-stone-100 overflow-hidden flex items-center justify-center">
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle at 85% 85%, rgba(164, 148, 140, 0.35) 0%, rgba(35, 30, 27, 0.7) 45%, #0e0c0b 100%)',
                      }}
                    />
                    {logo ? (
                      <div className="relative z-10 w-24 h-24 group-hover:scale-105 transition-transform duration-300">
                        <Image
                          src={logo}
                          alt={team.games?.name || 'Game Logo'}
                          fill
                          sizes="120px"
                          className="object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                        />
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center gap-1.5 text-stone-400">
                        <Gamepad2 className="w-8 h-8" />
                        <span className="text-xs font-black tracking-wider uppercase text-stone-300">
                          {team.games?.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Team Card Details */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-black text-[#5B271E] tracking-widest uppercase bg-[#5B271E]/10 px-2.5 py-0.5 rounded-md">
                          {team.games?.name}
                        </span>
                        <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                          {membersCount} / {maxPlayers} Players
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-black text-stone-950 uppercase tracking-wide group-hover:text-[#5B271E] transition-colors break-words">
                        {team.name}
                      </h2>
                      {team.description && (
                        <p className="text-xs text-stone-600 font-medium tracking-wide mt-2 line-clamp-2 normal-case">
                          {team.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-xs text-stone-500 font-semibold tracking-wider">
                        Roster Status
                      </span>
                      <Link
                        href={`/teams/${team.id}`}
                        className="inline-flex items-center gap-1 text-xs font-black text-[#5B271E] group-hover:text-[#FFCC37] uppercase tracking-wider transition-colors"
                      >
                        Manage Team →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
