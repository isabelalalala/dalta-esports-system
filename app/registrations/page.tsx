'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { RegistrationStatus, Tournament } from '@/utils/types';
import { getTournamentStatus, registrationClosesAt, type TournamentDisplayStatus } from '@/utils/tournaments';
import { getCheckinState } from '@/utils/checkin';
import { manilaToday } from '@/utils/site';
import { REGISTRATION_TABS, registrationStep, registrationTab, startsInText, type RegistrationTab } from '@/utils/registrations';
import PageLoading from '@/components/PageLoading';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import { Trophy, AlertCircle } from 'lucide-react';
import { useConfirm } from '@/components/useConfirm';
import { useUrlState } from '@/utils/url-state';
import { toast } from '@/components/Toaster';
import RegistrationCard, { type RegistrationCardData } from './RegistrationCard';

// What the page loads for each registration (one query with the team and tournament embedded)
interface RegistrationRow {
  id: string;
  tournament_id: string;
  team_id: string | null;
  team_name: string | null;
  status: RegistrationStatus;
  rejection_reason: string | null;
  registered_at: string;
  teams: { id: string; name: string; captain_id: string; game_id: string; games: { name: string } | null } | null;
  tournaments: Pick<
    Tournament,
    'id' | 'name' | 'game' | 'game_id' | 'start_date' | 'end_date' | 'registration_deadline' | 'status' | 'checkin_window_minutes'
  > | null;
}

interface MatchRow {
  id: string;
  tournament_id: string;
  team_a_id: string | null;
  team_b_id: string | null;
  status: 'scheduled' | 'live' | 'completed';
  scheduled_at: string | null;
}

type CardWithTab = RegistrationCardData & { tab: RegistrationTab; teamId: string | null };

export default function MyRegistrationsPage() {
  const [confirmDialog, ask] = useConfirm();
  const supabase = createClient();
  usePageTitle('My Registrations');
  const [cards, setCards] = useState<CardWithTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Kept in the address (?tab=ongoing): Back and refresh keep it
  const [tab, setTab] = useUrlState<RegistrationTab | 'all'>('tab', 'all', ['upcoming', 'ongoing', 'completed', 'all']);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const me = session.user.id;

        // 1. My teams, and their registrations (team + tournament embedded)
        const { data: memberRows, error: membersError } = await supabase
          .from('team_members').select('team_id').eq('user_id', me);
        if (membersError) throw membersError;
        const teamIds = (memberRows || []).map((r) => r.team_id as string);
        if (teamIds.length === 0) return;

        const { data: regData, error: regsError } = await supabase
          .from('tournament_registrations')
          .select('id, tournament_id, team_id, team_name, status, rejection_reason, registered_at, teams(id, name, captain_id, game_id, games(name)), tournaments(id, name, game, game_id, start_date, end_date, registration_deadline, status, checkin_window_minutes)')
          .in('team_id', teamIds)
          .order('registered_at', { ascending: false });
        if (regsError) throw regsError;
        const regs = (regData || []) as unknown as RegistrationRow[];
        if (regs.length === 0) return;

        // 2. My teams' matches in those tournaments, rosters (avatars) and check-ins
        const tournamentIds = [...new Set(regs.map((r) => r.tournament_id))];
        const idList = teamIds.join(',');
        const [matchesRes, ...rosterRes] = await Promise.all([
          supabase
            .from('matches')
            .select('id, tournament_id, team_a_id, team_b_id, status, scheduled_at')
            .in('tournament_id', tournamentIds)
            .or(`team_a_id.in.(${idList}),team_b_id.in.(${idList})`),
          ...teamIds.map((id) => supabase.rpc('get_team_roster', { p_team_id: id })),
        ]);
        if (matchesRes.error) throw matchesRes.error;
        const matches = (matchesRes.data || []) as MatchRow[];
        const rosters: Record<string, { name: string | null; avatar_url: string | null }[]> = {};
        teamIds.forEach((id, i) => {
          rosters[id] = (rosterRes[i].data || []).map((m) => ({ name: m.full_name, avatar_url: m.avatar_url }));
        });

        // The next match of each team in each tournament: live first, then the soonest scheduled
        const now = Date.now();
        const nextMatchFor = (tournamentId: string, teamId: string) =>
          matches
            .filter((m) => m.tournament_id === tournamentId && (m.team_a_id === teamId || m.team_b_id === teamId) && m.status !== 'completed')
            .sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : (a.scheduled_at ?? '9999').localeCompare(b.scheduled_at ?? '9999')))[0];

        const nextMatches = regs
          .map((r) => (r.team_id ? nextMatchFor(r.tournament_id, r.team_id) : undefined))
          .filter((m): m is MatchRow => Boolean(m));
        const opponentIds = [...new Set(nextMatches.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((id): id is string => Boolean(id)))];
        const [opponentsRes, checkinsRes] = await Promise.all([
          opponentIds.length
            ? supabase.from('teams').select('id, name').in('id', opponentIds)
            : Promise.resolve({ data: [], error: null }),
          nextMatches.length
            ? supabase.from('match_checkins').select('match_id, team_id').in('match_id', nextMatches.map((m) => m.id))
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (opponentsRes.error) throw opponentsRes.error;
        if (checkinsRes.error) throw checkinsRes.error;
        const teamNames = Object.fromEntries((opponentsRes.data || []).map((t) => [t.id, t.name]));
        const checkins = new Set((checkinsRes.data || []).map((c) => `${c.match_id}:${c.team_id}`));

        const today = manilaToday();
        setCards(regs.map((r): CardWithTab => {
          const t = r.tournaments;
          const tStatus: TournamentDisplayStatus = t ? getTournamentStatus(t) : 'upcoming';
          const teamId = r.team_id;
          const myMatches = teamId ? matches.filter((m) => m.tournament_id === r.tournament_id && (m.team_a_id === teamId || m.team_b_id === teamId)) : [];
          const next = teamId ? nextMatchFor(r.tournament_id, teamId) : undefined;
          const opponentId = next ? (next.team_a_id === teamId ? next.team_b_id : next.team_a_id) : null;
          const checkInActive = Boolean(
            next && teamId && next.status === 'scheduled' && t &&
            (checkins.has(`${next.id}:${teamId}`) || getCheckinState(next.scheduled_at, t.checkin_window_minutes, now) === 'open'),
          );
          const closesAt = t ? registrationClosesAt(t) : '';
          return {
            id: r.id,
            teamId,
            tab: registrationTab(tStatus),
            tournamentId: r.tournament_id,
            tournamentName: t?.name ?? 'Tournament',
            gameName: r.teams?.games?.name ?? t?.game ?? null,
            gameId: r.teams?.game_id ?? t?.game_id ?? null,
            startDate: t?.start_date ?? null,
            whenText: startsInText(tStatus, t?.start_date, today),
            teamName: r.teams?.name ?? r.team_name ?? 'Your team',
            isCaptain: r.teams?.captain_id === me,
            status: r.status,
            rejectionReason: r.rejection_reason,
            roster: teamId ? rosters[teamId] ?? [] : [],
            nextMatch: next
              ? { id: next.id, opponent: opponentId ? teamNames[opponentId] ?? 'Unknown team' : 'TBD', scheduledAt: next.scheduled_at }
              : null,
            step: registrationStep({
              status: r.status,
              tournamentStatus: tStatus,
              hasLiveMatch: myMatches.some((m) => m.status === 'live'),
              hasPlayedMatch: myMatches.some((m) => m.status === 'completed' && m.team_a_id && m.team_b_id),
              hasUpcomingMatch: myMatches.some((m) => m.status === 'scheduled'),
              checkInActive,
            }),
            // Same rule as the database: captain, still pending, registration not closed yet
            canWithdraw: r.teams?.captain_id === me && r.status === 'pending' && (!closesAt || Date.parse(closesAt) > now),
          };
        }));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load your registrations'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const counts = useMemo(() => {
    const c: Record<RegistrationTab | 'all', number> = { upcoming: 0, ongoing: 0, completed: 0, all: cards.length };
    for (const card of cards) c[card.tab] += 1;
    return c;
  }, [cards]);
  const shown = tab === 'all' ? cards : cards.filter((c) => c.tab === tab);

  const handleWithdraw = async (reg: CardWithTab) => {
    if (!(await ask({ title: 'Withdraw registration?', message: `Withdraw ${reg.teamName} from ${reg.tournamentName}? You can register again while registration is open.`, confirmLabel: 'Withdraw', tone: 'danger' }))) return;
    setBusyId(reg.id);
    setError('');
    try {
      const { data, error: deleteError } = await supabase
        .from('tournament_registrations')
        .delete()
        .eq('id', reg.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) {
        throw new Error('Only the captain can withdraw, and only while the registration is pending.');
      }
      setCards((current) => current.filter((r) => r.id !== reg.id));
      toast.success('Registration withdrawn.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to withdraw'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <PageLoading label="Loading your registrations..." />;
  }

  return (
    <>
    {confirmDialog}
    {/* The layout (SiteNavLayout) renders the main element and the page padding. Full width like
        the other sections: no narrow box. */}
    <div className="w-full space-y-8 text-stone-950">
      {/* 1. Main Hero Container */}
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 @5xl:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="tournaments_hero_bg_path" alt="DALTA Esports Registrations Banner" />

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <Link href="/tournaments" className="btn btn-primary">Browse tournaments →</Link>
        </div>

        <div className="relative z-10 max-w-prose mx-auto space-y-3 pt-2">
          <h1 className="animate-hero-title text-display font-black tracking-wider uppercase leading-tight text-white">
            My Registrations
          </h1>
          <p className="animate-hero-tagline text-xs sm:text-sm font-semibold leading-relaxed text-white">
            Your teams&apos; tournament entries: status, progress, next match and roster.
          </p>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {!error && cards.length === 0 ? (
        <div className="w-full rounded-3xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-14 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <span className="grid size-12 place-items-center rounded-2xl bg-stone-200/80 text-stone-600">
            <Trophy className="size-6" aria-hidden="true" />
          </span>
          <p className="font-black text-stone-900 text-base">You&apos;re not registered in any tournament yet</p>
          <p className="max-w-prose text-sm text-stone-600 font-medium">
            Find an upcoming tournament and register your team. Only the captain registers; everyone on the team sees it here.
          </p>
          <Link href="/tournaments" className="btn btn-primary mt-1">Browse tournaments</Link>
        </div>
      ) : cards.length > 0 && (
        <>
          {/* Tabs with counts */}
          <div role="tablist" aria-label="Filter registrations" className="inline-flex flex-wrap gap-1 p-1 rounded-2xl border border-stone-200/90 bg-white shadow-2xs">
            {REGISTRATION_TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                  tab === t.value ? 'bg-gold text-ink shadow-xs' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                {t.label} <span className="opacity-70">({counts[t.value]})</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-6 text-center text-sm font-bold text-stone-600">
              No {tab} registrations.
            </p>
          ) : (
            // Two columns on wide screens; each card stacks its own content when it's narrow
            <ul className="grid grid-cols-1 @5xl:grid-cols-2 gap-4 sm:gap-6">
              {shown.map((reg) => (
                <li key={reg.id} className="min-w-0">
                  <RegistrationCard reg={reg} busy={busyId === reg.id} onWithdraw={() => handleWithdraw(reg)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
    </>
  );
}
