'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import type { Team } from '@/utils/types';

export default function TeamsPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [game, setGame] = useState('');
  // Increase this to make the effect below load the teams again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('teams')
        .select('*, team_members(count)')
        .order('created_at', { ascending: false });

      setTeams(data || []);
      setLoading(false);
    };

    fetchTeams();
  }, [supabase, reloadCount]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // 1. Create Team
    const { data: team, error } = await supabase
      .from('teams')
      .insert([{ name: newTeamName, game, captain_id: session.user.id }])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    // 2. Add creator as captain in team_members
    await supabase.from('team_members').insert([
      { team_id: team.id, user_id: session.user.id, role: 'captain' }
    ]);

    setNewTeamName('');
    setGame('');
    setShowCreate(false);
    setReloadCount((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">My Teams</h1>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className="bg-[#00d2ff] text-black px-6 py-2 rounded font-bold hover:bg-[#00b8e6]"
          >
            {showCreate ? 'Cancel' : '+ Create Team'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreateTeam} className="mb-8 p-6 bg-[#1a1a2e] border border-[#00d2ff] rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" placeholder="Team Name" 
                value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)}
                className="bg-[#0a0a0c] border border-gray-700 p-3 rounded text-white outline-none focus:border-[#00d2ff]"
                required
              />
              <input 
                type="text" placeholder="Game (e.g. DOTA 2)" 
                value={game} onChange={(e) => setGame(e.target.value)}
                className="bg-[#0a0a0c] border border-gray-700 p-3 rounded text-white outline-none focus:border-[#00d2ff]"
                required
              />
            </div>
            <button type="submit" className="mt-4 w-full bg-[#00d2ff] text-black py-3 rounded font-bold">
              Confirm Creation
            </button>
          </form>
        )}

        {loading && <p className="text-gray-400 animate-pulse">Loading teams...</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map(team => (
            <div key={team.id} className="bg-[#111116] border border-[#00d2ff]/20 p-6 rounded-lg hover:border-[#00d2ff] transition">
              <h2 className="text-2xl font-bold text-[#00d2ff]">{team.name}</h2>
              <p className="text-gray-400 mt-1 uppercase text-xs font-bold tracking-widest">{team.game}</p>
              <div className="mt-4 flex justify-between items-center text-sm">
                <span className="text-gray-500">Members: {team.team_members?.[0]?.count || 0}</span>
                <Link href={`/teams/${team.id}`} className="text-[#00d2ff] hover:underline font-bold">
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
