'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { ACTIVE_REGISTRATION_STATUSES } from '@/utils/types';
import type { Announcement, Match, Profile, Registration, RosterMember, Stream, Team, Tournament } from '@/utils/types';
import { formatDate, getTournamentStatus, statusLabels, statusStyles } from '@/utils/tournaments';
import Bracket from './Bracket';
import PickemLeaderboard from './PickemLeaderboard';
import PredictionsProvider from '@/components/PredictionsProvider';
import PredictionPicker from '@/components/PredictionPicker';
import AnnouncementCard from '@/components/AnnouncementCard';
import VerifiedBadge from '@/components/VerifiedBadge';
import ShareButton from '@/components/ShareButton';
import CalendarLinks from '@/components/CalendarLinks';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';

export default function TournamentDetailsPage() {
  usePageTitle('Tournament');
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
  // Members of the selected team who aren't verified students yet (for tournaments that require it).
  // teamId says which team the list belongs to, so an old list is never shown for another team.
  const [unverified, setUnverified] = useState<{ teamId: string; members: RosterMember[] } | null>(null);
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

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);

        const [tournRes, regsRes, matchesRes, annRes, streamsRes] = await Promise.all([
          supabase
            .from('tournaments')
            .select('*')
            .eq('id', id)
            .single(),
          // Registrations that take up a slot, with team name and captain
          // (the captain's name is only readable by admin/staff).
          supabase
            .from('tournament_registrations')
            .select('*, teams(*, captain:profiles(full_name, email))')
            .eq('tournament_id', id)
            .in('status', ACTIVE_REGISTRATION_STATUSES)
            .order('registered_at'),
          // Bracket matches (empty until an organizer generates the bracket)
          supabase
            .from('matches')
            .select('*')
            .eq('tournament_id', id)
            .order('round')
            .order('match_number'),
          // Announcements for this tournament, pinned first
          supabase
            .from('announcements')
            .select('*')
            .eq('tournament_id', id)
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false }),
          // Streams of this tournament that are live right now (for the "Watch live" banner)
          supabase
            .from('streams')
            .select('*')
            .eq('tournament_id', id)
            .eq('status', 'live'),
        ]);

        if (tournRes.error) throw tournRes.error;
        if (regsRes.error) throw regsRes.error;
        if (matchesRes.error) throw matchesRes.error;
        if (annRes.error) throw annRes.error;
        if (streamsRes.error) throw streamsRes.error;

        const data = tournRes.data;
        const matchesData = matchesRes.data;
        setTournament(data);
        setRegistrations(regsRes.data || []);
        setMatches(matchesData || []);
        setAnnouncements(annRes.data || []);
        setLiveStreams(streamsRes.data || []);

        // Names of every team in the bracket, in one query
        const bracketTeamIds = new Set<string>();
        for (const m of matchesData || []) {
          if (m.team_a_id) bracketTeamIds.add(m.team_a_id);
          if (m.team_b_id) bracketTeamIds.add(m.team_b_id);
        }
        const [namesRes, myTeamsRes] = await Promise.all([
          bracketTeamIds.size > 0
            ? supabase
                .from('teams')
                .select('id, name')
                .in('id', [...bracketTeamIds])
            : null,
          // Teams I captain for this tournament's game (only captains can register)
          data.game_id
            ? supabase
                .from('teams')
                .select('*, games(*), team_members(count)')
                .eq('captain_id', session.user.id)
                .eq('game_id', data.game_id)
                .order('created_at', { ascending: false })
            : null,
        ]);
        if (namesRes?.error) throw namesRes.error;
        if (namesRes) setTeamNames(Object.fromEntries((namesRes.data || []).map((t) => [t.id, t.name])));
        if (myTeamsRes?.error) throw myTeamsRes.error;
        if (myTeamsRes) setTeams(myTeamsRes.data || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load tournament'));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, router, supabase, reloadCount]);

  // When the captain picks a team, list the members who still need verification.
  // Only a convenience: the database refuses the registration anyway.
  const requiresVerification = tournament?.requires_verification ?? false;
  useEffect(() => {
    if (!selectedTeamId || !requiresVerification) return;
    const check = async () => {
      const { data, error: rosterError } = await supabase.rpc('get_team_roster', { p_team_id: selectedTeamId });
      if (rosterError) return;
      setUnverified({ teamId: selectedTeamId, members: (data as RosterMember[]).filter((m) => !m.is_verified) });
    };
    check();
  }, [selectedTeamId, requiresVerification, supabase]);

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

  if (loading) return <PageLoading />;
  if (!tournament) {
    return (
      <PageError message={error || 'Tournament not found. It may have been deleted.'} backHref="/tournaments" backLabel="Back to Tournaments" />
    );
  }

  const isOrganizer = profile?.role === 'admin' || profile?.role === 'staff';
  const status = getTournamentStatus(tournament);
  const approvedTeams = registrations.filter((r) => r.status === 'approved');
  const isFull = tournament.max_participants != null && registrations.length >= tournament.max_participants;
  // Selected team's members who must be verified before it can register
  const blockingMembers =
    tournament.requires_verification && selectedTeamId && unverified?.teamId === selectedTeamId ? unverified.members : [];
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
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-6 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/tournaments" className="text-gold hover:underline mb-6 inline-block">
          ← Back to Tournaments
        </Link>

        <div className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-4 sm:p-8 space-y-8">
          {/* Title and status */}
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="font-pixel text-lg sm:text-2xl leading-relaxed text-gold break-words min-w-0">{tournament.name}</h1>
              <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${statusStyles[status]}`}>
                {statusLabels[status]}
              </span>
              {tournament.requires_verification && (
                <span className="px-3 py-1 rounded-full border border-[#3987e5]/60 bg-[#3987e5]/15 text-[#8fbcf2] text-xs font-bold uppercase">
                  ✓ Verified students only
                </span>
              )}
            </div>
            {tournament.description && (
              <p className="text-gray-300 text-lg whitespace-pre-wrap break-words">{tournament.description}</p>
            )}
            {/* The public page works without logging in, so it's the one to share */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link href={`/t/${tournament.id}`} className="text-sm text-gold hover:underline">Public page ↗</Link>
              <ShareButton path={`/t/${tournament.id}`} title={tournament.name} text={`${tournament.name} (${tournament.game}) on DALTA Esports`} />
              <CalendarLinks kind="tournament" id={tournament.id} />
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>
          )}
          {message && (
            <div role="status" className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>
          )}

          {/* Watch live banner */}
          {liveStreams.map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              className="flex items-center justify-between gap-3 bg-red-600/15 border border-red-500 px-4 py-3 hover:bg-red-600/25 transition"
            >
              <span className="font-bold text-red-300 min-w-0 break-words">📺 Watch live: {s.title}</span>
              <span className="text-red-300 text-sm shrink-0">● LIVE →</span>
            </Link>
          ))}

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {details.map((d) => (
              <div key={d.label} className="bg-sitebg p-4 border border-brown">
                <span className="text-gray-400 block text-xs uppercase font-bold">{d.label}</span>
                <span className="text-lg font-semibold break-words">{d.value}</span>
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

          <Link href={`/feedback?tournament=${id}`} className="inline-block text-sm text-gold hover:underline">
            💬 Give feedback about this tournament
          </Link>

          {/* Rules */}
          <div>
            <h2 className="text-xl font-bold mb-2">Rules</h2>
            {tournament.rules ? (
              <p className="text-gray-300 whitespace-pre-wrap break-words bg-sitebg p-4 border border-brown">
                {tournament.rules}
              </p>
            ) : (
              <p className="text-gray-400">No rules posted yet.</p>
            )}
          </div>

          {/* Bracket (scrolls sideways inside its own box on phones) */}
          <div>
            <h2 className="text-xl font-bold mb-3">Bracket</h2>
            {matches.length > 0 ? (
              <>
                {!isOrganizer && (
                  <p className="text-sm text-gray-400 mb-3">
                    🎯 Pick&apos;em: pick the winner under each match before it starts. Picks close at match time.
                  </p>
                )}
                {/* Under each match: the community split and (for the audience) the pick buttons */}
                <PredictionsProvider matches={matches}>
                  <Bracket
                    matches={matches}
                    teamNames={teamNames}
                    matchHref={(m) => `/matches/${m.id}`}
                    renderBelow={(m) => <PredictionPicker match={m} teamNames={teamNames} compact />}
                  />
                </PredictionsProvider>
              </>
            ) : (
              <p className="text-gray-400">
                No bracket yet. It appears here once the organizers generate it from the approved teams.
              </p>
            )}
          </div>

          {/* Pick'em leaderboard (top 3 here, the full list on its own page) */}
          {matches.length > 0 && (
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-xl font-bold">🎯 Pick&apos;em Leaderboard</h2>
                <Link href={`/tournaments/${id}/predictions`} className="text-sm text-gold hover:underline">Full leaderboard →</Link>
              </div>
              <PickemLeaderboard tournamentId={id} limit={3} />
            </div>
          )}

          {/* Approved teams */}
          <div>
            <h2 className="text-xl font-bold mb-2">Approved Teams ({approvedTeams.length})</h2>
            {approvedTeams.length === 0 ? (
              <p className="text-gray-400">No approved teams yet.</p>
            ) : (
              <ul className="divide-y divide-brown bg-sitebg border border-brown">
                {approvedTeams.map((reg) => (
                  <li key={reg.id} className="px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="font-semibold break-words min-w-0">
                      {/* Older registrations have no team, only the typed team_name */}
                      {reg.teams?.name || reg.team_name || 'Unnamed Team'}
                    </span>
                    {reg.teams?.captain && (
                      <span className="text-gray-400 text-sm break-all sm:break-normal">
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
            <div className="bg-yellow-600/10 border border-yellow-600 p-4">
              <p className="text-yellow-400 font-semibold mb-1">Admin Panel</p>
              <p className="text-gray-400 text-sm mb-4">
                {matches.length > 0
                  ? `Bracket: ${matches.length} matches in ${roundCount} rounds.`
                  : `No bracket yet. It is generated from the ${approvedTeams.length} approved teams.`}
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href={`/tournaments/${id}/edit`}
                  className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition"
                >
                  Edit Tournament
                </Link>
                {matches.length > 0 && (
                  <Link
                    href={`/tournaments/${id}/matches`}
                    className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] text-gold px-6 py-2 font-bold hover:bg-gold hover:text-black transition"
                  >
                    Manage Matches
                  </Link>
                )}
                <Link
                  href={`/tournaments/${id}/streams`}
                  className="bg-sitecard border border-red-500 text-red-300 px-6 py-2 font-bold hover:bg-red-600 hover:text-white transition"
                >
                  Manage Streams
                </Link>
                <Link
                  href={`/tournaments/${id}/registrations`}
                  className="bg-purple-600 text-white px-6 py-2 font-bold hover:bg-purple-700 transition"
                >
                  View Registrations
                </Link>
                <button
                  onClick={handleGenerateBracket}
                  disabled={generating}
                  className="bg-green-700 text-white px-6 py-2 font-bold hover:bg-green-800 transition disabled:opacity-50"
                >
                  {generating ? 'Generating...' : matches.length > 0 ? 'Regenerate Bracket' : 'Generate Bracket'}
                </button>
                {profile?.role === 'admin' && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white px-6 py-2 font-bold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Tournament'}
                  </button>
                )}
              </div>
            </div>
          ) : closedReason ? (
            /* Registration not possible: say why instead of showing the form */
            <div className="bg-sitebg border border-gray-600 text-gray-300 px-4 py-3 text-center">
              {closedReason}
            </div>
          ) : !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-gold text-black font-bold py-3 hover:bg-golddark transition"
            >
              Register Team for Tournament
            </button>
          ) : (
            /* PLAYER REGISTRATION */
            <form onSubmit={handleRegister} className="p-6 bg-sitebg border border-gold space-y-4">
              <div>
                <label htmlFor="register-team" className="block text-gold mb-2 font-semibold">
                  Select Your Team
                </label>

                {teams.length === 0 ? (
                  <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">
                    You don&apos;t captain a {tournament.game} team yet. Create one first on the{' '}
                    <Link href="/teams" className="font-bold underline hover:text-white">Teams</Link> page.
                  </div>
                ) : (
                  <select
                    id="register-team"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full bg-sitecard border border-brownlight p-3 text-white outline-none focus:border-gold"
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

              {blockingMembers.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-200 px-4 py-3 space-y-2">
                  <p>
                    This tournament only accepts verified students. These members need to submit their student details
                    on their Profile and be verified by an organizer first:
                  </p>
                  <ul className="space-y-1">
                    {blockingMembers.map((m) => (
                      <li key={m.user_id} className="flex items-center gap-2">
                        <span className="font-semibold">{m.ign || m.full_name || 'Unnamed player'}</span>
                        {m.ign && m.full_name && <span className="text-yellow-200/70">({m.full_name})</span>}
                        <VerifiedBadge verified={false} showUnverified />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={registering || teams.length === 0 || blockingMembers.length > 0}
                  className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition disabled:opacity-50"
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
    </main>
  );
}
