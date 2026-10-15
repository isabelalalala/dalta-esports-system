'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { RosterMember, Team } from '@/utils/types';

export default function ManageTeamPage() {
  const supabase = createClient();
  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Increase this to make the effect below load the team again
  const [reloadCount, setReloadCount] = useState(0);

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

        // Names and emails come from a database function that only answers
        // for members of this team (and admin/staff).
        const { data: rosterData, error: rosterError } = await supabase
          .rpc('get_team_roster', { p_team_id: id });
        if (rosterError) throw rosterError;
        setRoster(rosterData || []);

        // Only the captain is allowed to read the code, so for everyone else this is empty.
        const { data: codeData } = await supabase
          .from('team_join_codes')
          .select('join_code')
          .eq('team_id', id)
          .maybeSingle();
        setJoinCode(codeData?.join_code || '');
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load team'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, supabase, reloadCount]);

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

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/teams" className="text-[#00d2ff] hover:underline mb-6 inline-block">
          ← Back to My Teams
        </Link>

        <div className="bg-[#1a1a2e] border border-[#00d2ff] p-8 rounded-xl">
          <h1 className="text-4xl font-bold text-[#00d2ff]">{team.name}</h1>
          <p className="text-gray-400 mt-1 uppercase text-xs font-bold tracking-widest">{team.games?.name}</p>

          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {isCaptain && joinCode && (
            <div className="mt-6 bg-[#0a0a0c] border border-[#00d2ff]/30 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Share this code with your players so they can join:</p>
              <p className="text-3xl font-mono font-bold tracking-widest text-[#00d2ff] mt-1">{joinCode}</p>
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
              You need at least {minPlayers} players before you can register for a tournament.
            </p>
          )}

          {!isMember && (
            <p className="mt-4 text-gray-400">Only members of this team can see the roster.</p>
          )}

          <ul className="mt-4 divide-y divide-[#00d2ff]/20">
            {roster.map((member) => (
              <li key={member.user_id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold">
                    {member.full_name || member.email}
                    {member.role === 'captain' && <span className="ml-2 text-yellow-400 text-sm">Captain</span>}
                  </p>
                  {member.full_name && <p className="text-gray-500 text-sm">{member.email}</p>}
                </div>

                {isCaptain && member.role !== 'captain' && (
                  <button
                    onClick={() => removeMember(member.user_id, `Remove ${member.full_name || member.email} from the team?`)}
                    disabled={busy}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

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
