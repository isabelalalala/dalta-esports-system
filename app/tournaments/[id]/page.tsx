'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
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
import PageHeroBackground from '@/components/site/PageHeroBackground';
import {
  AlertCircle,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Trophy,
  Tv,
  Users,
} from 'lucide-react';

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

export default function TournamentDetailsPage() {
  usePageTitle('Tournament');
  const supabase = createClient();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [registering, setRegistering] = useState(false);
  const [showForm, setShowForm] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash === '#register';
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [unverified, setUnverified] = useState<{ teamId: string; members: RosterMember[] } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [liveStreams, setLiveStreams] = useState<Stream[]>([]);
  const [generating, setGenerating] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const registrationRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const handleOpenRegistration = () => {
    setShowForm(true);
    setTimeout(() => {
      registrationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const selectEl = document.getElementById('register-team');
      selectEl?.focus();
    }, 50);
  };

  useEffect(() => {
    if (!loading && showForm) {
      setTimeout(() => {
        registrationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [loading, showForm]);

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
          supabase
            .from('tournament_registrations')
            .select('*, teams(*, captain:profiles(full_name, email))')
            .eq('tournament_id', id)
            .in('status', ACTIVE_REGISTRATION_STATUSES)
            .order('registered_at'),
          supabase
            .from('matches')
            .select('*')
            .eq('tournament_id', id)
            .order('round')
            .order('match_number'),
          supabase
            .from('announcements')
            .select('*')
            .eq('tournament_id', id)
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false }),
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

  if (loading) return <PageLoading variant="detail" label="Loading tournament..." />;
  if (!tournament) {
    return (
      <PageError message={error || 'Tournament not found. It may have been deleted.'} backHref="/tournaments" backLabel="Back to Tournaments" />
    );
  }

  const isOrganizer = profile?.role === 'admin' || profile?.role === 'staff';
  const status = getTournamentStatus(tournament);
  const approvedTeams = registrations.filter((r) => r.status === 'approved');
  const isFull = tournament.max_participants != null && registrations.length >= tournament.max_participants;
  const blockingMembers =
    tournament.requires_verification && selectedTeamId && unverified?.teamId === selectedTeamId ? unverified.members : [];
  const roundCount = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const logo = getGameLogo(tournament.game, tournament.game_id);

  let closedReason = '';
  if (status === 'cancelled') closedReason = 'This tournament has been cancelled.';
  else if (status === 'registration_closed') closedReason = 'Registration is closed.';
  else if (status === 'ongoing') closedReason = 'This tournament is in progress.';
  else if (status === 'completed') closedReason = 'This tournament has ended.';
  else if (isFull) closedReason = 'This tournament is full.';

  const details = [
    { label: 'Game Discipline', value: tournament.game, icon: Trophy },
    { label: 'Registered Teams', value: `${registrations.length} / ${tournament.max_participants || '∞'} teams`, icon: Users },
    { label: 'Registration Deadline', value: formatDate(tournament.registration_deadline), icon: Clock },
    { label: 'Start Date', value: formatDate(tournament.start_date), icon: Calendar },
    { label: 'End Date', value: formatDate(tournament.end_date), icon: Calendar },
    {
      label: 'Check-In Window',
      value: tournament.checkin_window_minutes > 0 ? `${tournament.checkin_window_minutes} mins before match` : 'No pre-match check-in',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="w-full space-y-8 uppercase text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Tournament Banner" />

        {/* Back Link & Badges */}
        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
          >
            ← Back to Tournaments
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border uppercase shadow-xs ${statusStyles[status]}`}>
              {statusLabels[status]}
            </span>
            {tournament.requires_verification && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border border-sky-500/50 bg-sky-500/20 text-sky-200 uppercase">
                <BadgeCheck className="h-3.5 w-3.5 text-sky-300" /> Verified Students Only
              </span>
            )}
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            {tournament.name}
          </h1>
          <p
            className="animate-hero-tagline text-xs sm:text-sm text-stone-200 font-semibold uppercase tracking-wider flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
            style={{ color: '#ffffff' }}
          >
            <span className="text-[#FFCC37] font-black">{tournament.game}</span>
            <span>•</span>
            <span>{formatDate(tournament.start_date)} – {formatDate(tournament.end_date)}</span>
            <span>•</span>
            <span>{registrations.length} / {tournament.max_participants || '∞'} Teams</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 pt-2">
          <ShareButton path={`/t/${tournament.id}`} title={tournament.name} text={`${tournament.name} (${tournament.game}) on DALTA Esports`} />
          <CalendarLinks kind="tournament" id={tournament.id} />
          <Link
            href={`/t/${tournament.id}`}
            className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 hover:border-[#FFCC37] text-white text-xs font-black tracking-wider transition-all inline-flex items-center gap-1.5"
          >
            <span>Public Page</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#FFCC37]" />
          </Link>
        </div>
      </section>

      {/* 2. Error / Status Notifications */}
      {error && (
        <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div role="status" className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 sm:p-5 text-emerald-800 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* 3. Watch Live Banner (if streams active) */}
      {liveStreams.map((s) => (
        <Link
          key={s.id}
          href={`/live/${s.id}`}
          className="group rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 p-4 sm:p-5 flex items-center justify-between gap-4 text-red-900 transition-all shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2.5 rounded-xl bg-red-600 text-white shadow-xs">
              <Tv className="h-5 w-5 animate-pulse" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-black text-red-700 uppercase tracking-widest flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-red-600 animate-ping" /> Live Match Stream
              </div>
              <p className="font-black text-sm sm:text-base text-stone-950 truncate tracking-wide">{s.title}</p>
            </div>
          </div>
          <span className="px-4 py-2 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest group-hover:bg-red-700 transition-colors shrink-0">
            Watch Now →
          </span>
        </Link>
      ))}

      {/* 4. Editorial Layout: Game Media Showcase & Overview */}
      <div className="animate-stagger-1 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Constrained Game Media Card */}
        {logo ? (
          <div className="lg:col-span-5 w-full">
            <div className="relative aspect-[4/3] max-h-[380px] w-full rounded-3xl border border-stone-800/80 bg-[#0e0c0b] overflow-hidden shadow-md flex items-center justify-center p-6 sm:p-8">
              {/* Radial gradient spotlight matching division cards */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 85% 85%, rgba(164, 148, 140, 0.35) 0%, rgba(35, 30, 27, 0.7) 45%, #0e0c0b 100%)',
                }}
              />
              <div className="absolute top-4 right-4 z-20 pointer-events-none">
                <span className="text-[10px] font-black tracking-widest px-3 py-1.5 rounded-md border border-[#FFCC37]/60 bg-[#0e0c0b]/85 text-[#FFCC37] uppercase backdrop-blur-md shadow-md">
                  {statusLabels[status]}
                </span>
              </div>
              <div className="relative z-0 w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
                <Image
                  src={logo}
                  alt={tournament.game}
                  fill
                  sizes="(max-width: 1024px) 200px, 220px"
                  className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.7)] hover:scale-105 transition-transform duration-300"
                  priority
                />
              </div>
              <div className="absolute bottom-4 left-6 right-6 text-center z-10">
                <span className="text-xs font-black tracking-widest text-stone-400 uppercase">
                  {tournament.game} Division
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Right Column: Overview & Information */}
        <div className={logo ? 'lg:col-span-7 w-full space-y-6' : 'w-full space-y-6'}>
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-4 space-y-1">
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">
                Competition Details
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
                Overview &amp; Information
              </h2>
            </div>

            <div className="text-stone-800 text-xs sm:text-sm font-medium uppercase tracking-wide leading-relaxed whitespace-pre-wrap">
              {tournament.description ? (
                <p>{tournament.description}</p>
              ) : (
                <p className="text-stone-400 italic">No description provided for this tournament.</p>
              )}
            </div>

            {/* Registration Container inside Overview (Directly in-place without scrolling) */}
            {!isOrganizer && (
              <div id="register-container" ref={registrationRef} className="pt-4 border-t border-stone-100">
                {closedReason ? (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/90 p-4 text-center text-xs font-black uppercase text-stone-600 tracking-wider">
                    {closedReason}
                  </div>
                ) : !showForm ? (
                  <button
                    onClick={handleOpenRegistration}
                    className="w-full py-3.5 px-6 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer"
                  >
                    Register Team for Tournament
                  </button>
                ) : (
                  <div className="rounded-2xl border-2 border-amber-400/90 bg-amber-50/40 p-5 sm:p-6 space-y-4 animate-hero-entrance">
                    <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
                      <div>
                        <span className="text-[10px] font-black tracking-widest text-[#5B271E] uppercase">
                          Team Enrollment
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-stone-950 uppercase tracking-wide">
                          Register Your Squad ({tournament.game})
                        </h3>
                      </div>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-[#5B271E] text-white uppercase tracking-wider">
                        Active Step
                      </span>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="register-team"
                          className="block text-stone-950 text-xs font-black tracking-wider uppercase"
                        >
                          Select Your Team ({tournament.game}) *
                        </label>

                        {teams.length === 0 ? (
                          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-700 text-xs font-bold uppercase tracking-wider">
                            You don&apos;t captain a {tournament.game} team yet. Create one first on the{' '}
                            <Link href="/teams" className="font-black underline hover:text-[#5B271E]">
                              Teams
                            </Link>{' '}
                            page.
                          </div>
                        ) : (
                          <select
                            id="register-team"
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full p-3.5 rounded-xl bg-white border border-stone-300 text-stone-950 font-bold text-xs uppercase tracking-wide outline-none focus:border-[#FFCC37] focus:ring-2 focus:ring-[#FFCC37]/25 shadow-xs transition-all"
                            required
                          >
                            <option value="">-- Choose Roster --</option>
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name} ({team.team_members?.[0]?.count || 0} / {team.games?.max_players} players)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {blockingMembers.length > 0 && (
                        <div className="rounded-2xl bg-amber-500/15 border border-amber-400 p-4 text-amber-950 text-xs font-semibold uppercase tracking-wider space-y-2.5">
                          <div className="flex items-center gap-2 font-black text-[#5B271E]">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Student Verification Required</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            This tournament only accepts verified students under RA 10173 policy. These members must submit verification on their Profile first:
                          </p>
                          <ul className="space-y-1 pl-2 text-[11px]">
                            {blockingMembers.map((m) => (
                              <li key={m.user_id} className="flex items-center gap-2">
                                <span className="font-black">{m.ign || m.full_name || 'Unnamed player'}</span>
                                {m.ign && m.full_name && <span className="text-stone-500 font-medium">({m.full_name})</span>}
                                <VerifiedBadge verified={false} showUnverified />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={registering || teams.length === 0 || blockingMembers.length > 0}
                          className="px-6 py-3 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {registering ? 'Processing Registration...' : 'Confirm Registration'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowForm(false);
                            setSelectedTeamId('');
                          }}
                          className="px-5 py-3 rounded-xl border border-stone-300 bg-white text-stone-700 hover:text-stone-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Metrics & Key Specifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {details.map((d) => {
          const Icon = d.icon;
          return (
            <div
              key={d.label}
              className="rounded-2xl border border-stone-200/90 bg-stone-50/70 p-5 shadow-2xs hover:bg-white hover:border-amber-400/50 hover:shadow-xs transition-all space-y-2"
            >
              <div className="flex items-center gap-2 text-stone-500">
                <Icon className="h-4 w-4 text-[#5B271E]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">{d.label}</span>
              </div>
              <p className="text-sm sm:text-base font-black text-stone-950 uppercase tracking-wide break-words">{d.value}</p>
            </div>
          );
        })}
      </div>

      {/* 6. Announcements Section */}
      {announcements.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-stone-200/90 pb-3">
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Updates</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">Announcements</h2>
          </div>
          <div className="space-y-3">
            {announcements.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} showTournament={false} />
            ))}
          </div>
        </section>
      )}

      {/* 7. Feedback Prompt */}
      <Link
        href={`/feedback?tournament=${id}`}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6 rounded-3xl border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 text-stone-950 transition-all shadow-2xs group"
      >
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-white border border-amber-400/40 text-[#5B271E] group-hover:bg-[#FFCC37] group-hover:text-stone-950 transition-colors shadow-2xs">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-black text-sm sm:text-base uppercase tracking-wide text-stone-950">
              Spectator &amp; Participant Feedback
            </h3>
            <p className="text-xs text-stone-600 font-semibold uppercase tracking-wider">
              Share your thoughts, match ratings, and sentiment for DALTA Esports committee review.
            </p>
          </div>
        </div>
        <span className="text-xs font-black text-[#5B271E] group-hover:text-[#FFCC37] uppercase tracking-widest shrink-0 self-end sm:self-center transition-colors">
          Give Feedback →
        </span>
      </Link>

      {/* 8. Rules Section */}
      <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
        <div className="border-b border-stone-100 pb-3">
          <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Governance</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">Rules &amp; Regulations</h2>
        </div>
        {tournament.rules ? (
          <p className="text-stone-800 text-xs sm:text-sm font-medium uppercase tracking-wide leading-relaxed whitespace-pre-wrap">
            {tournament.rules}
          </p>
        ) : (
          <p className="text-stone-400 text-xs sm:text-sm font-semibold uppercase tracking-wider">
            No official tournament rules have been published for this tournament yet.
          </p>
        )}
      </section>

      {/* 9. Bracket Section */}
      <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
        <div className="border-b border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Playoffs</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">Tournament Bracket</h2>
          </div>
          {matches.length > 0 && !isOrganizer && (
            <div className="flex items-center gap-1.5 text-xs text-stone-600 font-black uppercase tracking-wider">
              <Target className="h-4 w-4 text-[#5B271E]" />
              <span>Pick&apos;em enabled: pick the winner before match starts</span>
            </div>
          )}
        </div>

        {matches.length > 0 ? (
          <PredictionsProvider matches={matches}>
            <Bracket
              matches={matches}
              teamNames={teamNames}
              matchHref={(m) => `/matches/${m.id}`}
              renderBelow={(m) => <PredictionPicker match={m} teamNames={teamNames} compact />}
            />
          </PredictionsProvider>
        ) : (
          <div className="p-8 sm:p-12 text-center rounded-2xl bg-stone-50 border border-stone-200/80">
            <p className="font-black text-stone-900 text-sm uppercase tracking-wider">No bracket generated yet.</p>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wide mt-1">
              Organizers will generate the matchups once registration closes.
            </p>
          </div>
        )}
      </section>

      {/* 10. Pick'em Leaderboard */}
      {matches.length > 0 && (
        <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div>
              <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Community</span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide flex items-center gap-2">
                <Target className="h-5 w-5 text-[#5B271E]" /> Pick&apos;em Leaderboard
              </h2>
            </div>
            <Link
              href={`/tournaments/${id}/predictions`}
              className="text-xs font-black text-[#5B271E] hover:text-[#FFCC37] uppercase tracking-wider transition-colors"
            >
              Full Leaderboard →
            </Link>
          </div>
          <PickemLeaderboard tournamentId={id} limit={3} />
        </section>
      )}

      {/* 11. Approved Teams List */}
      <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
        <div className="border-b border-stone-100 pb-3">
          <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Roster</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
            Approved Teams ({approvedTeams.length})
          </h2>
        </div>
        {approvedTeams.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-stone-50 border border-stone-200/80 text-stone-500 text-xs font-black uppercase tracking-wider">
            No approved teams registered for this tournament yet.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
            {approvedTeams.map((reg) => (
              <li key={reg.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 hover:bg-stone-50/70 transition-colors">
                <span className="font-black text-stone-950 text-xs sm:text-sm tracking-wide break-words min-w-0">
                  {reg.teams?.name || reg.team_name || 'Unnamed Team'}
                </span>
                {reg.teams?.captain && (
                  <span className="text-stone-500 text-xs font-bold tracking-wider">
                    Captain: {reg.teams.captain.full_name || reg.teams.captain.email}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 12. Admin & Staff Controls Panel */}
      {isOrganizer && (
        <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8 lg:p-10 shadow-xs space-y-5">
          <div className="border-b border-amber-500/20 pb-3">
            <span className="text-[11px] font-black tracking-widest text-[#5B271E] uppercase">Operations</span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-wide">
              Admin &amp; Organizer Panel
            </h2>
          </div>
          <p className="text-xs text-stone-600 font-semibold uppercase tracking-wider">
            {matches.length > 0
              ? `Active Bracket: ${matches.length} matches across ${roundCount} rounds.`
              : `No bracket generated yet. Ready to build from ${approvedTeams.length} approved teams.`}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/tournaments/${id}/edit`}
              className="px-5 py-2.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Tournament</span>
            </Link>
            {matches.length > 0 && (
              <Link
                href={`/tournaments/${id}/matches`}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-950 font-black text-xs uppercase tracking-widest border border-stone-200 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
              >
                <Swords className="w-3.5 h-3.5 text-[#5B271E]" />
                <span>Manage Matches</span>
              </Link>
            )}
            <Link
              href={`/tournaments/${id}/streams`}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-950 hover:text-red-700 font-black text-xs uppercase tracking-widest border border-stone-200 hover:border-red-300 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
            >
              <Tv className="w-3.5 h-3.5 text-red-600" />
              <span>Manage Streams</span>
            </Link>
            <Link
              href={`/tournaments/${id}/registrations`}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-950 hover:text-purple-700 font-black text-xs uppercase tracking-widest border border-stone-200 hover:border-purple-300 shadow-xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
            >
              <Users className="w-3.5 h-3.5 text-[#5B271E]" />
              <span>View Registrations</span>
            </Link>
            <button
              onClick={handleGenerateBracket}
              disabled={generating}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>{generating ? 'Generating...' : matches.length > 0 ? 'Regenerate Bracket' : 'Generate Bracket'}</span>
            </button>
            {profile?.role === 'admin' && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting...' : 'Delete Tournament'}</span>
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
