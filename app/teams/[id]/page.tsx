'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { PlayerSearchResult, RosterMember, Team } from '@/utils/types';

const inputClass =
  'w-full bg-[#0a0a0c] border border-gray-700 p-3 rounded text-white outline-none focus:border-[#00d2ff]';

export default function ManageTeamPage() {
  const supabase = createClient();
  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Increase this to make the effect below load the team again
  const [reloadCount, setReloadCount] = useState(0);

  // Edit team form (captain only)
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Add member search (captain only)
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[] | null>(null);

  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*, games(*)')
          .eq('id', id)
          .single();
        if (teamError) throw teamError;
        setTeam(teamData);

        // Names, IGNs and in-game roles come from a database function,
        // because players can't read other people's profiles directly.
        const { data: rosterData, error: rosterError } = await supabase
          .rpc('get_team_roster', { p_team_id: id });
        if (rosterError) throw rosterError;
        setRoster(rosterData || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load team'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, supabase, reloadCount]);

  const startEditing = () => {
    if (!team) return;
    setName(team.name);
    setDescription(team.description || '');
    setEditing(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ name: name.trim(), description: description.trim() || null })
        .eq('id', id);
      if (updateError) throw updateError;
      setEditing(false);
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save team'));
    } finally {
      setBusy(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    setBusy(true);
    setError('');

    try {
      // Only returns players with a game profile for this game who aren't on a team for it yet
      const { data, error: searchError } = await supabase
        .rpc('search_players', { p_game_id: team.game_id, p_search: search });
      if (searchError) throw searchError;
      setResults(data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Search failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (player: PlayerSearchResult) => {
    setBusy(true);
    setError('');

    try {
      // The database checks the roster size and one-team-per-game
      const { error: insertError } = await supabase
        .from('team_members')
        .insert([{ team_id: id, user_id: player.user_id, role: 'player' }]);
      if (insertError) throw insertError;

      // Take the added player out of the results list
      setResults((current) => (current || []).filter((p) => p.user_id !== player.user_id));
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add player'));
    } finally {
      setBusy(false);
    }
  };

  // Used for "Remove" (captain removing a player) and "Leave team" (removing yourself)
  const removeMember = async (memberId: string, confirmText: string) => {
    if (!confirm(confirmText)) return;
    setBusy(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', id)
        .eq('user_id', memberId);
      if (deleteError) throw deleteError;

      if (memberId === userId) {
        router.push('/teams');
      } else {
        setReloadCount((n) => n + 1);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove member'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!confirm('Delete this team? It will also be withdrawn from every tournament it registered for.')) return;
    setBusy(true);
    setError('');

    try {
      const { error: deleteError } = await supabase.from('teams').delete().eq('id', id);
      if (deleteError) throw deleteError;
      router.push('/teams');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete team'));
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;
  if (!team) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-red-500 p-10 text-center">
        {error || 'Team not found.'}
      </div>
    );
  }

  const isCaptain = team.captain_id === userId;
  const isMember = roster.some((m) => m.user_id === userId);
  const maxPlayers = team.games?.max_players ?? 0;
  const minPlayers = team.games?.min_players ?? 0;
  const isFull = roster.length >= maxPlayers;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/teams" className="text-[#00d2ff] hover:underline mb-6 inline-block">
          ← Back to My Teams
        </Link>

        <div className="bg-[#1a1a2e] border border-[#00d2ff] p-8 rounded-xl">
          {editing ? (
            <form onSubmit={handleSaveTeam} className="space-y-3">
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Team Name" className={inputClass} required
              />
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)" rows={3} className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="submit" disabled={busy}
                  className="bg-[#00d2ff] text-black px-6 py-2 rounded font-bold hover:bg-[#00b8e6] transition disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button" onClick={() => setEditing(false)}
                  className="text-gray-400 px-6 py-2 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-start gap-4">
              <div>
                <h1 className="text-4xl font-bold text-[#00d2ff]">{team.name}</h1>
                <p className="text-gray-400 mt-1 uppercase text-xs font-bold tracking-widest">{team.games?.name}</p>
                {team.description && <p className="text-gray-300 mt-4">{team.description}</p>}
              </div>
              {isCaptain && (
                <button onClick={startEditing} className="text-[#00d2ff] hover:underline font-semibold text-sm">
                  Edit
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="mt-8 flex justify-between items-baseline">
            <h2 className="text-xl font-bold">Roster</h2>
            <span className="text-gray-400 text-sm">
              {roster.length} / {maxPlayers} players
            </span>
          </div>

          {roster.length < minPlayers && (
            <p className="mt-2 text-yellow-400 text-sm">
              The team needs at least {minPlayers} players before it can register for a tournament.
            </p>
          )}

          <ul className="mt-4 divide-y divide-[#00d2ff]/20">
            {roster.map((member) => (
              <li key={member.user_id} className="py-3 flex justify-between items-center gap-4">
                <div>
                  <p className="font-semibold">
                    {member.ign || <span className="text-gray-500 italic">No IGN</span>}
                    {member.in_game_role && <span className="text-gray-400 font-normal"> · {member.in_game_role}</span>}
                    {member.role === 'captain' && <span className="ml-2 text-yellow-400 text-sm">Captain</span>}
                  </p>
                  {member.full_name && <p className="text-gray-500 text-sm">{member.full_name}</p>}
                </div>

                {isCaptain && member.role !== 'captain' && (
                  <button
                    onClick={() => removeMember(member.user_id, `Remove ${member.ign || member.full_name || 'this player'} from the team?`)}
                    disabled={busy}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Add members (captain only; the database also enforces this) */}
          {isCaptain && (
            <div className="mt-8 bg-[#0a0a0c] border border-[#00d2ff]/30 p-4 rounded-lg">
              <h3 className="font-bold mb-1">Add a player</h3>
              {isFull ? (
                <p className="text-gray-400 text-sm">The team is full.</p>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-3">
                    Search by IGN or name. Only players with a {team.games?.name} game profile who
                    aren&apos;t on another {team.games?.name} team are shown.
                  </p>
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="IGN or name" className={inputClass} required
                    />
                    <button
                      type="submit" disabled={busy}
                      className="bg-[#00d2ff] text-black px-6 rounded font-bold hover:bg-[#00b8e6] transition disabled:opacity-50"
                    >
                      Search
                    </button>
                  </form>

                  {results && results.length === 0 && (
                    <p className="mt-3 text-gray-500 text-sm">No players found.</p>
                  )}

                  {results && results.length > 0 && (
                    <ul className="mt-3 divide-y divide-[#00d2ff]/20">
                      {results.map((player) => (
                        <li key={player.user_id} className="py-2 flex justify-between items-center gap-4">
                          <div>
                            <p className="font-semibold">
                              {player.ign}
                              {player.in_game_role && <span className="text-gray-400 font-normal"> · {player.in_game_role}</span>}
                              {player.rank && <span className="text-gray-500 font-normal"> · {player.rank}</span>}
                            </p>
                            {player.full_name && <p className="text-gray-500 text-sm">{player.full_name}</p>}
                          </div>
                          <button
                            onClick={() => handleAddMember(player)}
                            disabled={busy}
                            className="text-[#00d2ff] hover:underline font-semibold text-sm disabled:opacity-50"
                          >
                            Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            {isCaptain ? (
              <button
                onClick={handleDeleteTeam}
                disabled={busy}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition disabled:opacity-50"
              >
                Delete Team
              </button>
            ) : isMember && (
              <button
                onClick={() => removeMember(userId, 'Leave this team?')}
                disabled={busy}
                className="border border-red-500 text-red-400 hover:bg-red-500 hover:text-white px-6 py-2 rounded-lg font-bold transition disabled:opacity-50"
              >
                Leave Team
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
