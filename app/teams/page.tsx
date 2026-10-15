'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Game, Team } from '@/utils/types';
import TeamInvites from '@/components/TeamInvites';

export default function TeamsPage() {
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
  // Increase this to make the effect below load the teams again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .order('name');
        if (gamesError) throw gamesError;
        setGames(gamesData || []);

        // Teams I'm a member of (as captain or player), with the game and member count
        const { data: memberRows, error: teamsError } = await supabase
          .from('team_members')
          .select('teams(*, games(*), team_members(count))')
          .eq('user_id', session.user.id);
        if (teamsError) throw teamsError;
        setTeams((memberRows || []).map((row) => row.teams as unknown as Team));
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // The database adds me as the captain member automatically.
      const { error: insertError } = await supabase
        .from('teams')
        .insert([{
          name: newTeamName.trim(),
          game_id: gameId,
          description: description.trim() || null,
          captain_id: session.user.id,
        }]);
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

  return (
    <div className="min-h-screen bg-sitebg text-white p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-gold hover:underline mb-6 inline-block">
          ← Back to Dashboard
        </Link>

        <div className="flex justify-between items-center mb-8">
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">My Teams</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark"
          >
            {showCreate ? 'Cancel' : '+ Create Team'}
          </button>
        </div>

        {/* Open invites; accepting adds the new team to the list below */}
        <TeamInvites onAnswered={() => setReloadCount((n) => n + 1)} />

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">
            {error}
          </div>
        )}

        {showCreate && (
          <form onSubmit={handleCreateTeam} className="mb-8 p-6 bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text" placeholder="Team Name"
                value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)}
                className="bg-sitebg border border-gray-700 p-3 text-white outline-none focus:border-gold"
                required
              />
              <select
                value={gameId} onChange={(e) => setGameId(e.target.value)}
                className="bg-sitebg border border-gray-700 p-3 text-white outline-none focus:border-gold"
                required
              >
                <option value="">-- Select Game --</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} (up to {g.max_players} {g.max_players === 1 ? 'player' : 'players'})
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Description (optional)"
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-4 w-full bg-sitebg border border-gray-700 p-3 text-white outline-none focus:border-gold"
            />
            <button
              type="submit" disabled={saving}
              className="mt-4 w-full bg-gold text-black py-3 font-bold disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Confirm Creation'}
            </button>
          </form>
        )}

        {loading && <p className="text-gray-400 animate-pulse">Loading teams...</p>}

        {!loading && teams.length === 0 && (
          <p className="text-gray-400">You&apos;re not on any team yet. Create one, or ask a captain to add you. Captains can only add players who have a game profile for that game on their My Profile page.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map(team => (
            <div key={team.id} className="bg-[#111116] border border-brown p-6 hover:border-gold transition">
              <h2 className="text-2xl font-bold text-gold">{team.name}</h2>
              <p className="text-gray-400 mt-1 uppercase text-xs font-bold tracking-widest">{team.games?.name}</p>
              {team.description && <p className="text-gray-300 mt-3 text-sm">{team.description}</p>}
              <div className="mt-4 flex justify-between items-center text-sm">
                <span className="text-gray-500">
                  Members: {team.team_members?.[0]?.count || 0} / {team.games?.max_players}
                </span>
                <Link href={`/teams/${team.id}`} className="text-gold hover:underline font-bold">
                  Manage Team →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
