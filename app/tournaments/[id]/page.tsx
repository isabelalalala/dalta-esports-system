'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { ACTIVE_REGISTRATION_STATUSES } from '@/utils/types';
import type { Announcement, Match, Profile, Registration, Stream, Team, Tournament } from '@/utils/types';
import { formatDate, getTournamentStatus, statusLabels, statusStyles } from '@/utils/tournaments';
import Bracket from './Bracket';
import AnnouncementCard from '@/components/AnnouncementCard';

export default function TournamentDetailsPage() {
  const supabase = createClient();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  // Pending + approved registrations (the ones that take up a slot)
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [registering, setRegistering] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  // Team id -> team name, for the teams that appear in the bracket
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [liveStreams, setLiveStreams] = useState<Stream[]>([]);
  const [generating, setGenerating] = useState(false);
  // Increase this to make the effect below load everything again
  const [reloadCount, setReloadCount] = useState(0);

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

        // Registrations that take up a slot, with team name and captain
        // (the captain's name is only readable by admin/staff).
        const { data: regsData, error: regsError } = await supabase
          .from('tournament_registrations')
          .select('*, teams(*, captain:profiles(full_name, email))')
          .eq('tournament_id', id)
          .in('status', ACTIVE_REGISTRATION_STATUSES)
          .order('registered_at');

        if (regsError) throw regsError;
        setRegistrations(regsData || []);

        // Bracket matches (empty until an organizer generates the bracket)
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', id)
          .order('round')
          .order('match_number');

        if (matchesError) throw matchesError;
        setMatches(matchesData || []);

        // Names of every team in the bracket, in one query
        const bracketTeamIds = new Set<string>();
        for (const m of matchesData || []) {
          if (m.team_a_id) bracketTeamIds.add(m.team_a_id);
          if (m.team_b_id) bracketTeamIds.add(m.team_b_id);
        }
        if (bracketTeamIds.size > 0) {
          const { data: namesData, error: namesError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', [...bracketTeamIds]);
          if (namesError) throw namesError;
          setTeamNames(Object.fromEntries((namesData || []).map((t) => [t.id, t.name])));
        }

        // Announcements for this tournament, pinned first
        const { data: annData, error: annError } = await supabase
          .from('announcements')
          .select('*')
          .eq('tournament_id', id)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false });
        if (annError) throw annError;
        setAnnouncements(annData || []);

        // Streams of this tournament that are live right now (for the "Watch live" banner)
        const { data: streamsData, error: streamsError } = await supabase
          .from('streams')
          .select('*')
          .eq('tournament_id', id)
          .eq('status', 'live');
        if (streamsError) throw streamsError;
        setLiveStreams(streamsData || []);

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
  }, [id, router, supabase, reloadCount]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) return;

    setRegistering(true);
    setError('');
    setMessage('');

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push('/auth/login');
        return;
      }

      // The database checks the rules (dates, game, team size, tournament full,
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

      setMessage('Registration submitted. An organizer will review it.');
      setShowForm(false);
      setSelectedTeamId('');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setRegistering(false);
    }
  };

  const handleGenerateBracket = async () => {
    const warning = matches.length > 0
      ? 'Generate a new bracket? The current bracket, including any schedule, will be replaced.'
      : 'Generate the bracket from the approved teams? Teams are placed in random order.';
    if (!confirm(warning)) return;

    setGenerating(true);
    setError('');
    setMessage('');

    try {
      // The database shuffles the approved teams, creates every round and
      // refuses if a match has already started.
      const { data: created, error: genError } = await supabase
        .rpc('generate_bracket', { p_tournament_id: id });
      if (genError) throw genError;

      setMessage(`Bracket generated with ${created} matches.`);
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate bracket'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) return;

    setDeleting(true);
    try {
      // .select() returns the deleted rows. If RLS blocked the delete,
      // Supabase gives no error but an empty list, so check for that.
      const { data: deleted, error: deleteError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id)
        .select('id');

      if (deleteError) throw deleteError;
      if (!deleted || deleted.length === 0) throw new Error('Only an administrator can delete tournaments.');

      router.push('/tournaments');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete tournament'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] text-white p-10 text-center">Loading...</div>;
  if (!tournament) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-red-500 p-10 text-center">
        {error || 'Tournament not found.'}
      </div>
    );
  }

  const isOrganizer = profile?.role === 'admin' || profile?.role === 'staff';
  const status = getTournamentStatus(tournament);
  const approvedTeams = registrations.filter((r) => r.status === 'approved');
  const isFull = tournament.max_participants != null && registrations.length >= tournament.max_participants;
  const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);

  // Why the register form is hidden ('' = registration is open)
  let closedReason = '';
  if (status === 'cancelled') closedReason = 'This tournament has been cancelled.';
  else if (status === 'registration_closed') closedReason = 'Registration is closed.';
  else if (status === 'ongoing') closedReason = 'This tournament is in progress.';
  else if (status === 'completed') closedReason = 'This tournament has ended.';
  else if (isFull) closedReason = 'This tournament is full.';

  const details = [
    { label: 'Game', value: tournament.game },
    { label: 'Participants', value: `${registrations.length} / ${tournament.max_participants || '∞'} teams` },
    { label: 'Registration Deadline', value: formatDate(tournament.registration_deadline) },
    { label: 'Start Date', value: formatDate(tournament.start_date) },
    { label: 'End Date', value: formatDate(tournament.end_date) },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/tournaments" className="text-[#00d2ff] hover:underline mb-6 inline-block">
          ← Back to Tournaments
        </Link>

        <div className="bg-[#1a1a2e] border border-[#00d2ff] p-8 rounded-xl shadow-lg space-y-8">
          {/* Title and status */}
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-4xl font-bold text-[#00d2ff]">{tournament.name}</h1>
              <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${statusStyles[status]}`}>
                {statusLabels[status]}
              </span>
            </div>
            {tournament.description && (
              <p className="text-gray-300 text-lg whitespace-pre-wrap">{tournament.description}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>
          )}
          {message && (
            <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3 rounded-lg">{message}</div>
          )}

          {/* Watch live banner */}
          {liveStreams.map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              className="flex items-center justify-between gap-3 bg-red-600/15 border border-red-500 rounded-lg px-4 py-3 hover:bg-red-600/25 transition"
            >
              <span className="font-bold text-red-300">📺 Watch live: {s.title}</span>
              <span className="text-red-300 text-sm">● LIVE →</span>
            </Link>
          ))}

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {details.map((d) => (
              <div key={d.label} className="bg-[#0a0a0c] p-4 rounded-lg border border-[#00d2ff]/20">
                <span className="text-gray-400 block text-xs uppercase font-bold">{d.label}</span>
                <span className="text-lg font-semibold">{d.value}</span>
              </div>
            ))}
          </div>

          {/* Announcements for this tournament */}
          {announcements.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-3">Announcements</h2>
              <div className="space-y-3">
                {announcements.map((a) => (
                  <AnnouncementCard key={a.id} announcement={a} showTournament={false} />
                ))}
              </div>
            </div>
          )}

          {/* Rules */}
          <div>
            <h2 className="text-xl font-bold mb-2">Rules</h2>
            {tournament.rules ? (
              <p className="text-gray-300 whitespace-pre-wrap bg-[#0a0a0c] p-4 rounded-lg border border-[#00d2ff]/20">
                {tournament.rules}
              </p>
            ) : (
              <p className="text-gray-500">No rules posted yet.</p>
            )}
          </div>

          {/* Bracket */}
          {matches.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-3">Bracket</h2>
              <Bracket matches={matches} teamNames={teamNames} />
            </div>
          )}

          {/* Approved teams */}
          <div>
            <h2 className="text-xl font-bold mb-2">Approved Teams ({approvedTeams.length})</h2>
            {approvedTeams.length === 0 ? (
              <p className="text-gray-500">No approved teams yet.</p>
            ) : (
              <ul className="divide-y divide-[#00d2ff]/20 bg-[#0a0a0c] rounded-lg border border-[#00d2ff]/20">
                {approvedTeams.map((reg) => (
                  <li key={reg.id} className="px-4 py-3 flex justify-between items-center">
                    <span className="font-semibold">
                      {/* Older registrations have no team, only the typed team_name */}
                      {reg.teams?.name || reg.team_name || 'Unnamed Team'}
                    </span>
                    {reg.teams?.captain && (
                      <span className="text-gray-400 text-sm">
                        Captain: {reg.teams.captain.full_name || reg.teams.captain.email}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ADMIN / STAFF CONTROLS (the database also enforces these permissions) */}
          {isOrganizer ? (
            <div className="bg-yellow-600/10 border border-yellow-600 p-4 rounded-lg">
              <p className="text-yellow-400 font-semibold mb-1">Admin Panel</p>
              <p className="text-gray-400 text-sm mb-4">
                {matches.length > 0
                  ? `Bracket: ${matches.length} matches in ${roundCount} rounds.`
                  : `No bracket yet. It is generated from the ${approvedTeams.length} approved teams.`}
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href={`/tournaments/${id}/edit`}
                  className="bg-[#00d2ff] text-black px-6 py-2 rounded-lg font-bold hover:bg-[#00b8e6] transition"
                >
                  Edit Tournament
                </Link>
                {matches.length > 0 && (
                  <Link
                    href={`/tournaments/${id}/matches`}
                    className="bg-[#1a1a2e] border border-[#00d2ff] text-[#00d2ff] px-6 py-2 rounded-lg font-bold hover:bg-[#00d2ff] hover:text-black transition"
                  >
                    Manage Matches
                  </Link>
                )}
                <Link
                  href={`/tournaments/${id}/streams`}
                  className="bg-[#1a1a2e] border border-red-500 text-red-300 px-6 py-2 rounded-lg font-bold hover:bg-red-600 hover:text-white transition"
                >
                  Manage Streams
                </Link>
                <Link
                  href={`/tournaments/${id}/registrations`}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition"
                >
                  View Registrations
                </Link>
                <button
                  onClick={handleGenerateBracket}
                  disabled={generating}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {generating ? 'Generating...' : matches.length > 0 ? 'Regenerate Bracket' : 'Generate Bracket'}
                </button>
                {profile?.role === 'admin' && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Tournament'}
                  </button>
                )}
              </div>
            </div>
          ) : closedReason ? (
            /* Registration not possible: say why instead of showing the form */
            <div className="bg-[#0a0a0c] border border-gray-600 text-gray-300 px-4 py-3 rounded-lg text-center">
              {closedReason}
            </div>
          ) : !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-[#00d2ff] text-black font-bold py-3 rounded-lg hover:bg-[#00b8e6] transition"
            >
              Register Team for Tournament
            </button>
          ) : (
            /* PLAYER REGISTRATION */
            <form onSubmit={handleRegister} className="p-6 bg-[#0a0a0c] rounded-lg border border-[#00d2ff] space-y-4">
              <div>
                <label className="block text-[#00d2ff] mb-2 font-semibold">
                  Select Your Team
                </label>

                {teams.length === 0 ? (
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
        </div>
      </div>
    </div>
  );
}
