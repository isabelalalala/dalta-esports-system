'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Profile, Team, Tournament } from '@/utils/types';

export default function TournamentDetailsPage() {
  const supabase = createClient();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/login');
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setProfile(profileData);

        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setTournament(data);

        // Teams I captain for this tournament's game (only captains can register)
        if (data.game_id) {
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('*, games(*), team_members(count)')
            .eq('captain_id', session.user.id)
            .eq('game_id', data.game_id)
            .order('created_at', { ascending: false });

          if (teamsError) throw teamsError;
          setTeams(teamsData || []);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load tournament'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, router, supabase]);

  const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedTeamId) {
    alert('Please select a team.');
    return;
  }

  setRegistering(true);

  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      router.push('/auth/login');
      return;
    }

    // The database checks the rules (deadline, game, team size, tournament full,
    // already registered) and returns a readable error if one fails.
    const { error: regError } = await supabase
      .from('tournament_registrations')
      .insert([
        {
          tournament_id: id,
          team_id: selectedTeamId,
          user_id: session.session.user.id,
        },
      ]);

    if (regError) throw regError;

    alert('Team registered successfully!');
    setShowForm(false);
    setSelectedTeamId('');
  } catch (err) {
    alert(getErrorMessage(err, 'Registration failed'));
  } finally {
    setRegistering(false);
  }
};

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) return;

    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      router.push('/tournaments');
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete tournament'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;
  if (error) return <div className="min-h-screen bg-[#0a0a0c] text-red-500 p-10 text-center">{error}</div>;
  if (!tournament) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Tournament not found.</div>;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'staff';

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/tournaments" className="text-[#00d2ff] hover:underline mb-6 inline-block">
          ← Back to Tournaments
        </Link>

        <div className="bg-[#1a1a2e] border border-[#00d2ff] p-8 rounded-xl shadow-lg">
          <h1 className="text-4xl font-bold text-[#00d2ff] mb-4">{tournament.name}</h1>
          <p className="text-gray-300 text-lg mb-6">{tournament.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#0a0a0c] p-4 rounded-lg border border-[#00d2ff]/20">
              <span className="text-gray-400 block text-sm">GAME</span>
              <span className="text-xl font-semibold">{tournament.game}</span>
            </div>
            <div className="bg-[#0a0a0c] p-4 rounded-lg border border-[#00d2ff]/20">
              <span className="text-gray-400 block text-sm">START DATE</span>
              <span className="text-xl font-semibold">
                {new Date(tournament.start_date).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* ADMIN CONTROLS */}
          {isAdmin ? (
            <div className="space-y-4">
              <div className="bg-yellow-600/10 border border-yellow-600 p-4 rounded-lg">
                <p className="text-yellow-400 font-semibold mb-4">Admin Panel</p>
                <div className="flex gap-3 flex-wrap">
                  <Link href={`/tournaments/${id}/edit`}>
                    <button className="bg-[#00d2ff] text-black px-6 py-2 rounded-lg font-bold hover:bg-[#00b8e6] transition">
                      Edit Tournament
                    </button>
                  </Link>
                  <Link href={`/tournaments/${id}/registrations`}>
                    <button className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition">
                      View Registrations
                    </button>
                  </Link>
                  <button 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Tournament'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* PLAYER REGISTRATION */
            <>
              {!showForm ? (
  <button 
    onClick={() => setShowForm(true)}
    className="w-full bg-[#00d2ff] text-black font-bold py-3 rounded-lg hover:bg-[#00b8e6] transition"
  >
    Register Team for Tournament
  </button>
) : (
  <form onSubmit={handleRegister} className="mt-6 p-6 bg-[#0a0a0c] rounded-lg border border-[#00d2ff] space-y-4">
    <div>
      <label className="block text-[#00d2ff] mb-2 font-semibold">
        Select Your Team
      </label>

      {!tournament.game_id ? (
        <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded">
          This tournament has no game set yet, so teams can&apos;t register. Ask an admin to edit it.
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded">
          You don&apos;t captain a {tournament.game} team yet. Create one first on the{' '}
          <Link href="/teams" className="font-bold underline hover:text-white">Teams</Link> page.
        </div>
      ) : (
        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="w-full bg-[#1a1a2e] border border-[#00d2ff]/50 rounded p-3 text-white outline-none focus:border-[#00d2ff]"
          required
        >
          <option value="">-- Select Team --</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} ({team.team_members?.[0]?.count || 0} / {team.games?.max_players} players)
            </option>
          ))}
        </select>
      )}
    </div>

    <div className="flex gap-2">
      <button
        type="submit"
        disabled={registering || teams.length === 0}
        className="bg-[#00d2ff] text-black px-6 py-2 rounded font-bold hover:bg-[#00b8e6] transition disabled:opacity-50"
      >
        {registering ? 'Processing...' : 'Confirm Registration'}
      </button>
      <button
        type="button"
        onClick={() => {
          setShowForm(false);
          setSelectedTeamId('');
        }}
        className="text-gray-400 px-6 py-2 hover:text-white transition"
      >
        Cancel
      </button>
    </div>
  </form>
)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
