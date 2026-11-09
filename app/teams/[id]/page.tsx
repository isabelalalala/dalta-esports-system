'use client';

import { useState, useEffect, useCallback } from 'react';
import TeamLogoSection from '@/components/TeamLogoSection';
import LookingForEditor from '@/components/LookingForEditor';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useBreadcrumbName } from '@/utils/breadcrumb-names';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { PendingTeamInvite, PlayerSearchResult, RosterMember, Team } from '@/utils/types';
import VerifiedBadge from '@/components/VerifiedBadge';
import Avatar from '@/components/Avatar';
import SectionHint from '@/components/SectionHint';
import AskToJoin from '@/components/AskToJoin';
import TeamJoinRequests from '@/components/TeamJoinRequests';
import RemoveTeamDialog from '@/components/RemoveTeamDialog';
import RemovedTeamPanel from '@/components/RemovedTeamPanel';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import {
  Users,
  Shield,
  Crown,
  Search,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Trash2,
  LogOut,
  Edit2,
  Clock,
} from 'lucide-react';
import { can } from '@/utils/permissions';
import RankBadge from '@/components/RankBadge';
import { fieldFor, parseSchema } from '@/utils/game-profiles';
import { useRealtimeRefresh } from '@/utils/use-realtime-refresh';
import { useConfirm } from '@/components/useConfirm';
import { toast } from '@/components/Toaster';
import GameBadge from '@/components/GameBadge';

const inputClass =
  'w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

export default function ManageTeamPage() {
  const [confirmDialog, ask] = useConfirm();
  usePageTitle('Team');
  const supabase = createClient();
  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  // My open join request for this team (players who aren't on it), or null
  const [myRequestId, setMyRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  // "Remove team" confirmation (admin/staff)
  const [removing, setRemoving] = useState(false);

  // Edit team form (captain only)
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Invite search and open invites (captain only)
  const [search, setSearch] = useState('');
  // Recruiting filters from the game's profile form: main role and a rank range (option ids)
  const [roleFilter, setRoleFilter] = useState('');
  const [rankMin, setRankMin] = useState('');
  const [rankMax, setRankMax] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[] | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingTeamInvite[]>([]);
  const [message, setMessage] = useState('');

  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  // Breadcrumb: "Home > Teams > <name>"
  useBreadcrumbName(team?.name);

  // Live updates: roster, join requests, invites and the team row (recruiting, removal) reload the
  // page data without a manual refresh
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  useRealtimeRefresh(id ? `team-${id}` : null, [
    { table: 'teams', filter: `id=eq.${id}` },
    { table: 'team_members', filter: `team_id=eq.${id}` },
    { table: 'team_join_requests', filter: `team_id=eq.${id}` },
    { table: 'team_invites', filter: `team_id=eq.${id}` },
  ], reload);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*, games(*)')
          .eq('id', id)
          .single();
        if (teamError) throw teamError;
        setTeam(teamData);

        const { data: rosterData, error: rosterError } = await supabase.rpc(
          'get_team_roster',
          { p_team_id: id }
        );
        if (rosterError) throw rosterError;
        setRoster((rosterData || []) as RosterMember[]);

        const [roleRes, requestRes] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', session.user.id).single(),
          supabase
            .from('team_join_requests')
            .select('id')
            .eq('team_id', id)
            .eq('user_id', session.user.id)
            .eq('status', 'pending')
            .maybeSingle(),
        ]);
        if (roleRes.error) throw roleRes.error;
        if (requestRes.error) throw requestRes.error;
        setRole(roleRes.data.role);
        setMyRequestId(requestRes.data?.id ?? null);

        if (teamData.captain_id === session.user.id) {
          const { data: invitesData, error: invitesError } = await supabase.rpc(
            'get_team_invites',
            { p_team_id: id }
          );
          if (invitesError) throw invitesError;
          setPendingInvites(invitesData || []);
        }
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
      toast.success('Team details updated.');
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
      const { data, error: searchError } = await supabase.rpc('search_players', {
        p_game_id: team.game_id,
        p_search: search,
        p_role: roleFilter || undefined,
        p_rank_min: rankMin || undefined,
        p_rank_max: rankMax || undefined,
      });
      if (searchError) throw searchError;
      setResults(data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Search failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (player: PlayerSearchResult) => {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { error: insertError } = await supabase
        .from('team_invites')
        .insert([{ team_id: id, invited_user_id: player.user_id, invited_by: userId }]);
      if (insertError) throw insertError;

      setResults((current) =>
        (current || []).map((p) => (p.user_id === player.user_id ? { ...p, invited: true } : p))
      );
      toast.success(`Invite sent to ${player.ign}.`);
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send the invite'));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvite = async (invite: PendingTeamInvite) => {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { data, error: cancelError } = await supabase
        .from('team_invites')
        .update({ status: 'cancelled' })
        .eq('id', invite.invite_id)
        .select('id');
      if (cancelError) throw cancelError;
      if (!data || data.length === 0) {
        throw new Error('The invite could not be cancelled. It may have been answered already.');
      }

      setResults((current) =>
        (current || []).map((p) => (p.user_id === invite.user_id ? { ...p, invited: false } : p))
      );
      setReloadCount((n) => n + 1);
      toast.success('Invite cancelled.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel the invite'));
    } finally {
      setBusy(false);
    }
  };

  const handleMakeCaptain = async (member: RosterMember) => {
    const targetName = member.ign || member.full_name || 'this player';
    if (
      !(await ask({
        title: 'Transfer captaincy?',
        message: `Make ${targetName} the captain? You will become a regular player and cannot undo this yourself.`,
        confirmLabel: 'Make captain',
      }))
    )
      return;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { error: transferError } = await supabase.rpc('transfer_team_captaincy', {
        p_team_id: id,
        p_new_captain: member.user_id,
      });
      if (transferError) throw transferError;
      toast.success(`${targetName} is now the team captain.`);
      setResults(null);
      setPendingInvites([]);
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to change the captain'));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (memberId: string, confirmText: string) => {
    if (!(await ask({ title: 'Remove from team?', message: confirmText, confirmLabel: 'Remove', tone: 'danger' }))) return;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { data, error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', id)
        .eq('user_id', memberId)
        .select('user_id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('Player could not be removed.');

      if (memberId === userId) {
        router.push('/teams');
        return;
      }

      setReloadCount((n) => n + 1);
      toast.success('Player removed from team.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove member'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (
      !(await ask({
        title: 'Delete team?',
        message: "All pending tournament registrations for this team will be cancelled. This can't be undone.",
        confirmLabel: 'Delete team',
        tone: 'danger',
      }))
    )
      return;
    setBusy(true);
    setError('');

    try {
      // .select() returns the deleted row. If RLS blocked the delete, nothing comes back.
      const { data, error: deleteError } = await supabase.from('teams').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('Only the captain can delete this team.');
      router.push('/teams');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete team'));
      setBusy(false);
    }
  };

  if (loading) return <PageLoading label="Loading team details..." />;
  if (!team) {
    return (
      <PageError
        message={error || 'Team not found. It may have been deleted.'}
        backHref="/teams"
        backLabel="Back to Teams"
      />
    );
  }

  // Removed by an organizer: nothing on this team can be changed any more (the database refuses)
  if (team.is_removed) {
    return (
      <div className="w-full text-stone-950">
        <div className="w-full max-w-3xl mx-auto space-y-4">
          {message && (
            <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-800">
              {message}
            </p>
          )}
          <RemovedTeamPanel
            team={team}
            role={role}
            onRestored={(summary) => {
              setMessage(summary);
              setReloadCount((n) => n + 1);
            }}
          />
        </div>
      </div>
    );
  }

  const isCaptain = team.captain_id === userId;
  const isMember = roster.some((m) => m.user_id === userId);
  const maxPlayers = team.games?.max_players ?? 0;
  // The game's profile form: its role and rank lists feed the recruiting filters
  const gameSchema = parseSchema(team.games?.profile_schema);
  const roleField = fieldFor(gameSchema, 'role');
  const rankField = fieldFor(gameSchema, 'rank');
  const minPlayers = team.games?.min_players ?? 0;
  const isFull = roster.length >= maxPlayers;
  const isSolo = maxPlayers <= 1;
  const isOrganizer = can(role, 'team.toggleRecruiting');
  // Players not on this team may ask to join while it's recruiting (or cancel their request)
  const showAskToJoin =
    can(role, 'team.join') && !isMember && !isSolo && (myRequestId !== null || (team.recruiting && !isFull));

  return (
    <>
    {confirmDialog}
    {/* The layout (SiteNavLayout) renders the main element and the page padding */}
    <div className="w-full text-stone-950">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        {/* 1. Main Hero Container */}
        <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 @5xl:p-14 text-center text-white flex flex-col items-center justify-center space-y-4">
          <PageHeroBackground specificKey="divisions_hero_bg_path" alt="DALTA Esports Team Banner" />

          {/* Action Bar inside Hero: Back link & Status Badges */}
          <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/teams"
              className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
            >
              ← Back to Teams
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center text-[10px] sm:text-xs font-black pl-1.5 pr-3 py-1 rounded-md border border-gold/50 bg-gold/15 text-gold uppercase tracking-wider shadow-2xs">
                <GameBadge name={team.games?.name} game={team.game_id} size="xs" surface="dark" withName />
              </span>
              <span className="text-[10px] sm:text-xs font-black px-3.5 py-1 rounded-md border border-white/20 bg-white/10 text-stone-200 uppercase tracking-widest backdrop-blur-xs shadow-2xs">
                {roster.length} / {maxPlayers} Players
              </span>
              {isCaptain && (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border border-amber-400 bg-gold text-stone-950 uppercase tracking-widest shadow-2xs">
                  <Crown className="w-3 h-3 text-stone-950" /> Captain
                </span>
              )}
              {team.recruiting && (
                <span className="text-[10px] sm:text-xs font-black px-3 py-1 rounded-md border border-emerald-300/60 bg-emerald-500/20 text-emerald-100 uppercase tracking-widest shadow-2xs">
                  Recruiting
                </span>
              )}
            </div>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
            <h1
              className="animate-hero-title text-display font-black tracking-wider uppercase leading-tight text-white"
            >
              {team.name}
            </h1>
            <p
              className="animate-hero-tagline text-xs sm:text-sm font-semibold uppercase tracking-wider flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-white"
            >
              <span className="inline-flex items-center gap-1.5"><GameBadge name={team.games?.name} game={team.game_id} size="sm" surface="dark" /> {team.games?.name} Squad</span>
              <span>•</span>
              <span>
                {roster.length} of {maxPlayers} Roster Slots Filled
              </span>
            </p>
          </div>
        </section>

        {/* Global Notifications */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-3 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div
            role="status"
            className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 sm:p-5 text-emerald-800 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-3 shadow-xs"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{message}</span>
          </div>
        )}

        {/* 2. Team Overview & Edit Details Card */}
        <div className="animate-stagger-1 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">
                  Squad Profile
                </h2>
                <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                  Official team identity and registration credentials.
                </p>
              </div>
            </div>

            {isCaptain && !editing && (
              <button
                onClick={startEditing}
                className="rounded-xl border border-stone-300 hover:border-amber-400 bg-white text-stone-800 font-bold px-4 py-2 text-xs uppercase tracking-wider shadow-2xs hover:-translate-y-0.5 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-maroon" /> Edit Squad
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSaveTeam} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-stone-700 tracking-wider">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Team Name"
                  aria-label="Team Name"
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-stone-700 tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  aria-label="Description (optional)"
                  rows={3}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-wider shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-2.5 text-xs tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Logo: the captain uploads it; organizers can only remove one (with a reason) */}
              <TeamLogoSection
                key={team.logo_url ?? 'none'}
                team={{ id: team.id, name: team.name, game_id: team.game_id, logo_url: team.logo_url, gameName: team.games?.name }}
                isCaptain={isCaptain}
                canRemove={can(role, 'team.removeLogo')}
                onChanged={() => setReloadCount((n) => n + 1)}
              />
              <p className="max-w-prose text-stone-700 text-xs sm:text-sm font-medium leading-relaxed normal-case">
                {team.description || (
                  <span className="text-stone-500 italic">No description provided for this team.</span>
                )}
              </p>
              {/* What the team needs (captain edits; shown to others while recruiting) */}
              {!isSolo && (
                <LookingForEditor
                  key={JSON.stringify(team.looking_for ?? {})}
                  teamId={team.id}
                  profileSchema={team.games?.profile_schema}
                  value={team.looking_for}
                  recruiting={team.recruiting}
                  canEdit={isCaptain}
                  onSaved={() => setReloadCount((n) => n + 1)}
                />
              )}
            </div>
          )}
        </div>

        {/* 3. Official Roster Section */}
        <div className="animate-stagger-2 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider flex items-center gap-1.5">
                  Active Roster <SectionHint text="Roster — the players on this team. While the team is registered for a tournament, the roster is locked." />
                </h2>
                <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                  Players currently enrolled in this squad.
                </p>
              </div>
            </div>

            <span className="text-xs font-black tracking-wider text-stone-600 uppercase">
              {roster.length} / {maxPlayers} Players
            </span>
          </div>

          {roster.length < minPlayers && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 text-xs font-bold tracking-wider text-amber-800">
              This squad needs at least {minPlayers} players before it can register for tournaments.
            </div>
          )}

          <div className="space-y-3">
            {roster.map((member) => (
              <div
                key={member.user_id}
                className="p-4 sm:p-5 rounded-2xl border border-stone-200/80 bg-stone-50/60 hover:bg-white hover:border-gold/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Avatar url={member.avatar_url} name={member.full_name || member.ign} size="md" />
                    <p className="font-black text-stone-950 text-base break-words min-w-0">
                      {member.ign || <span className="text-stone-500 italic">No IGN</span>}
                    </p>
                    {member.role === 'captain' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-maroon text-white uppercase tracking-wider">
                        <Crown className="w-3 h-3 text-gold" /> Captain
                      </span>
                    )}
                    <VerifiedBadge verified={member.is_verified} />
                  </div>
                  <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-stone-500 font-semibold mt-1">
                    <RankBadge rank={member.rank} position={member.rank_position} count={member.rank_count} className="mr-1" />
                    {member.in_game_role && <span className="text-maroon font-extrabold">{member.in_game_role}</span>}
                    {member.in_game_role && member.full_name && <span> · </span>}
                    {member.full_name && <span>{member.full_name}</span>}
                  </p>
                </div>

                {isCaptain && member.role !== 'captain' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleMakeCaptain(member)}
                      disabled={busy}
                      className="rounded-xl border border-stone-300 hover:border-amber-400 bg-white text-stone-800 font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Make Captain
                    </button>
                    <button
                      onClick={() =>
                        removeMember(
                          member.user_id,
                          `Remove ${member.ign || member.full_name || 'this player'} from the team?`
                        )
                      }
                      disabled={busy}
                      className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ask to join (players who aren't on this team) */}
        {showAskToJoin && (
          <div className="animate-stagger-3 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">Want to join?</h2>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                The captain gets your request and can accept or decline it. You need a {team.games?.name} game
                profile and can be on only one {team.games?.name} team.
              </p>
            </div>
            <AskToJoin teamId={team.id} requestId={myRequestId} onChanged={() => setReloadCount((n) => n + 1)} />
          </div>
        )}

        {/* Recruiting switch and join requests (captain answers; organizers can view and switch it off) */}
        {(isCaptain || isOrganizer) && (
          <div className="animate-stagger-3">
            <TeamJoinRequests
              refreshKey={reloadCount}
              teamId={team.id}
              gameName={team.games?.name || 'This game'}
              recruiting={team.recruiting}
              canAnswer={isCaptain}
              canToggle={isCaptain || isOrganizer}
              isSolo={isSolo}
              isFull={isFull}
              openSlots={Math.max(maxPlayers - roster.length, 0)}
              onChanged={() => setReloadCount((n) => n + 1)}
            />
          </div>
        )}

        {/* 4. Invite Players Section (Captain only) */}
        {isCaptain && (
          <div className="animate-stagger-3 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider flex items-center gap-1.5">
                  Invite Players <SectionHint text="Invite players — search by IGN or name. Only players with a game profile for this game who aren't on another team show up." />
                </h2>
                <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                  Search for eligible perpetualite players to join your roster.
                </p>
              </div>
            </div>

            {isSolo ? (
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                {team.games?.name} is a 1-player discipline, so additional teammates cannot be added.
              </p>
            ) : isFull ? (
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                This squad has reached the maximum roster limit ({maxPlayers} players).
              </p>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="IGN or name (empty = everyone)"
                    aria-label="IGN or name"
                    className={`${inputClass} sm:flex-1 sm:min-w-[14rem]`}
                  />
                  {roleField?.options && (
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label={`Filter by ${roleField.label.toLowerCase()}`} className={`${inputClass} sm:w-44`}>
                      <option value="">Any {roleField.label.toLowerCase()}</option>
                      {roleField.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  )}
                  {rankField?.options && (
                    <>
                      <select value={rankMin} onChange={(e) => setRankMin(e.target.value)} aria-label="Lowest rank" className={`${inputClass} sm:w-40`}>
                        <option value="">Rank from: any</option>
                        {rankField.options.map((o) => <option key={o.id} value={o.id}>From {o.label}</option>)}
                      </select>
                      <select value={rankMax} onChange={(e) => setRankMax(e.target.value)} aria-label="Highest rank" className={`${inputClass} sm:w-40`}>
                        <option value="">Rank to: any</option>
                        {rankField.options.map((o) => <option key={o.id} value={o.id}>To {o.label}</option>)}
                      </select>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 transition-all shrink-0 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <Search className="w-4 h-4" /> Search
                  </button>
                </form>

                {results && results.length === 0 && (
                  <p className="text-xs text-stone-500 font-medium">
                    No matching players found with an active {team.games?.name} profile.
                  </p>
                )}

                {results && results.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    {results.map((player) => (
                      <div
                        key={player.user_id}
                        className="p-4 rounded-2xl border border-stone-200/80 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Avatar url={player.avatar_url} name={player.full_name || player.ign} size="sm" />
                            <span className="font-black text-stone-950 text-sm tracking-wide break-words min-w-0">
                              {player.ign}
                            </span>
                            <VerifiedBadge verified={player.is_verified} />
                          </div>
                          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-stone-500 font-semibold mt-0.5">
                            <RankBadge rank={player.rank} position={player.rank_position} count={player.rank_count} />
                            {player.in_game_role && <span className="text-maroon font-extrabold">{player.in_game_role} ·</span>}
                            <span>{player.full_name}</span>
                          </p>
                        </div>

                        {player.invited ? (
                          <span className="text-xs font-black text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg uppercase tracking-wider">
                            Invite Sent
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInvite(player)}
                            disabled={busy}
                            className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-4 py-2 text-xs uppercase tracking-wider shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            + Send Invite
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pending Invites List */}
            {pendingInvites.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stone-500" />
                  <h3 className="font-black text-stone-950 text-xs sm:text-sm tracking-wider uppercase">
                    Pending Invites ({pendingInvites.length})
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.invite_id}
                      className="p-3.5 rounded-2xl border border-stone-200/80 bg-stone-50/50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-black text-stone-950 text-sm tracking-wide">
                          {invite.ign || <span className="text-stone-500 italic">No IGN</span>}
                        </p>
                        {invite.full_name && (
                          <p className="text-[11px] text-stone-500 font-semibold">{invite.full_name}</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleCancelInvite(invite)}
                        disabled={busy}
                        className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                      >
                        Cancel Invite
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Organizer action: remove the team (soft delete, needs a reason; see RemoveTeamDialog) */}
        {can(role, 'team.remove') && (
          <div className="rounded-2xl border border-red-200 bg-white p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-black text-stone-950 text-sm tracking-wider uppercase">Remove team</h3>
              <p className="text-sm text-stone-600 mt-0.5">
                Takes the team out of lists, recruiting and registrations. Its bracket matches go to the opponent
                as walkovers. The record stays for reports{can(role, 'team.restore') ? ' and can be restored' : ''}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRemoving(true)}
              className="shrink-0 rounded-xl border border-red-800 bg-red-700 hover:bg-red-800 text-white px-5 py-2.5 font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Remove team
            </button>
          </div>
        )}
        {removing && (
          <RemoveTeamDialog
            team={{ id: team.id, name: team.name, gameName: team.games?.name }}
            onClose={() => setRemoving(false)}
            onRemoved={(summary) => {
              setRemoving(false);
              setMessage(summary);
              setReloadCount((n) => n + 1);
            }}
          />
        )}

        {/* 5. Danger Zone / Actions (only for people on the team) */}
        {(isCaptain || isMember) && (
        <div className="animate-stagger-3 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-stone-950 text-sm tracking-wider uppercase">
              {isCaptain ? 'Disband Squad' : 'Leave Roster'}
            </h3>
            <p className="text-xs text-stone-500 font-medium normal-case mt-0.5">
              {isCaptain
                ? 'Disbanding permanently removes the team and cancels any pending registrations.'
                : 'Leaving this team removes you from the active competitive roster.'}
            </p>
          </div>

          <div>
            {isCaptain ? (
              <button
                onClick={handleDeleteTeam}
                disabled={busy}
                className="rounded-xl border border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 px-5 py-2.5 font-black text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="w-4 h-4" /> Delete Team
              </button>
            ) : (
              isMember && (
                <button
                  onClick={() => removeMember(userId, 'Leave this team?')}
                  disabled={busy}
                  className="rounded-xl border border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 px-5 py-2.5 font-black text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <LogOut className="w-4 h-4" /> Leave Team
                </button>
              )
            )}
          </div>
        </div>
        )}
      </div>
    </div>
    </>
  );
}
