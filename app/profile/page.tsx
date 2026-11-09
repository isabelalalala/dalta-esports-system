'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { reloadTo } from '@/utils/auth';
import { getErrorMessage } from '@/utils/errors';
import type { Game, PlayerGameProfile, Profile } from '@/utils/types';
import VerifiedBadge from '@/components/VerifiedBadge';
import StudentDetails from './StudentDetails';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';
import { getPasswordError } from '@/utils/password';
import PasswordField from '@/components/PasswordField';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import {
  User,
  Shield,
  Gamepad2,
  Lock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Calendar,
} from 'lucide-react';

import GameLogo from '@/components/GameLogo';
import GameProfileForm from '@/components/GameProfileForm';
import GameProfileSummary from '@/components/GameProfileSummary';
import Avatar from '@/components/Avatar';
import AvatarUploader from '@/components/AvatarUploader';
import MyTeamsSummary from '@/app/dashboard/MyTeamsSummary';
import MyWarnings from '@/components/MyWarnings';
import { refreshViewer } from '@/utils/use-viewer';
import { can } from '@/utils/permissions';
import { useConfirm } from '@/components/useConfirm';
import { formatMomentDate } from '@/utils/tournaments';
import { toast } from '@/components/Toaster';

const inputClass =
  'w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 focus:border-gold focus:ring-2 focus:ring-gold/25 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

export default function ProfilePage() {
  const [confirmDialog, ask] = useConfirm();
  usePageTitle('Profile');
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  // The name saved at sign-up (user_metadata), which login checks passwords against
  const [signupName, setSignupName] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [gameProfiles, setGameProfiles] = useState<PlayerGameProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  // Game profile form (components/GameProfileForm.tsx): the game it opens on, or null when closed
  const [editingGameId, setEditingGameId] = useState<string | null>(null);

  // Delete account confirmation
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
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
        setProfile(profileData as Profile);
        setFullName(profileData.full_name || '');
        setSignupName(session.user.user_metadata?.full_name ?? '');

        // The game account details (Riot ID, User/Zone ID, UID...) aren't readable from the table
        // (202611091500): the player gets their own through get_game_profile_details()
        const [gamesRes, gpRes, detailsRes] = await Promise.all([
          supabase.from('games').select('*').order('name'),
          supabase.from('player_game_profiles')
            .select('id, user_id, game_id, ign, in_game_role, rank, created_at')
            .eq('user_id', session.user.id),
          supabase.rpc('get_game_profile_details'),
        ]);
        if (gamesRes.error) throw gamesRes.error;
        if (gpRes.error) throw gpRes.error;
        if (detailsRes.error) throw detailsRes.error;
        const detailsByGame = new Map((detailsRes.data ?? []).map((d) => [d.game_id, d.details]));
        setGames(gamesRes.data || []);
        setGameProfiles((gpRes.data || []).map((gp) => ({ ...gp, details: detailsByGame.get(gp.game_id) ?? {} })));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load profile'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, router, reloadCount]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() || null })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      toast.success('Name updated successfully.');
      // The header shows the name's initials when there is no picture
      refreshViewer().catch(() => undefined);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save name'));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (gameId: string) => {
    setEditingGameId(gameId);
    setError('');
    setMessage('');
  };

  const handleRemoveGameProfile = async (gp: PlayerGameProfile, gameName: string) => {
    if (!(await ask({ title: `Remove your ${gameName} profile?`, message: `This isn't possible while you are on a ${gameName} team.`, confirmLabel: 'Remove profile', tone: 'danger' }))) return;
    setSaving(true);
    setError('');

    try {
      // The database refuses while the player is on a team for this game (its message is shown as is)
      const { data, error: deleteError } = await supabase
        .from('player_game_profiles')
        .delete()
        .eq('id', gp.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('The game profile could not be removed.');
      setReloadCount((n) => n + 1);
      toast.success('Game profile removed.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove game profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    setError('');

    try {
      const { error: deleteError } = await supabase.rpc('delete_own_account');
      if (deleteError) throw deleteError;

      await supabase.auth.signOut({ scope: 'local' });
      reloadTo('/');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete account'));
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading variant="dashboard" label="Loading profile..." />;
  }
  if (!profile) {
    return (
      <PageError
        message={error || 'Profile not found. It may have been deleted.'}
        backHref="/dashboard"
        backLabel="Back to Dashboard"
      />
    );
  }

  return (
    <>
    {confirmDialog}
    {/* The layout (SiteNavLayout) renders the main element and the page padding */}
    <div className="w-full text-stone-950">
      {/* Full width like the other sections (the layout's padding is the only side space) */}
      <div className="w-full space-y-8">
        {/* 1. Main Hero Container (Matching Dashboard & Tournaments Layout) */}
        <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 @5xl:p-14 text-center text-white flex flex-col items-center justify-center space-y-5">
          <PageHeroBackground specificKey="dashboard_hero_bg_path" alt="DALTA Esports Profile Banner" />

          {/* Action Bar inside Hero: Back Link & Badges */}
          <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-black text-gold hover:text-goldlight uppercase tracking-wider transition-colors"
            >
              ← Back to Dashboard
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3.5 py-1 rounded-md border border-white/20 bg-white/10 text-stone-200 text-[10px] sm:text-xs font-black tracking-widest uppercase backdrop-blur-xs shadow-2xs">
                Role: {profile.role}
              </span>
              <VerifiedBadge verified={profile.is_verified} />
            </div>
          </div>

          {/* User Identity Display */}
          <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2 flex flex-col items-center">
            <Avatar url={profile.avatar_url} name={profile.full_name || profile.email} size="xl" className="border-2 border-gold/60 shadow-xl shadow-black/50" />
            <h1
              className="animate-hero-title text-display font-black tracking-wider uppercase leading-tight text-white"
            >
              {profile.full_name || 'My Profile'}
            </h1>
            <p
              className="animate-hero-tagline text-xs sm:text-sm font-semibold tracking-wider normal-case text-white"
            >
              {profile.email}
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

        {/* Two columns on wide screens: picture and account settings on the left; warnings,
            game profiles and teams on the right. One column on smaller screens. */}
        <div className="grid grid-cols-1 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6 sm:gap-8 items-start">
          <div className="min-w-0 space-y-6 sm:space-y-8">
            {/* Profile picture (all roles) */}
            <section className="animate-stagger-1 bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4" aria-labelledby="picture-title">
              <h2 id="picture-title" className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">Profile picture</h2>
              <AvatarUploader
                userId={profile.id}
                name={profile.full_name || profile.email}
                url={profile.avatar_url ?? null}
                onChange={(url) => setProfile((p) => (p ? { ...p, avatar_url: url } : p))}
              />
            </section>

            {/* 2. Account Information Card */}
            <form
              onSubmit={handleSaveName}
              className="animate-stagger-1 bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
                <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">
                    Account Information
                  </h2>
                  <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                    Manage your personal credentials and official student profile records.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
                <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1">
                  <span className="uppercase block text-stone-500 font-black tracking-wider text-xs flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-maroon" />
                    Email Address
                  </span>
                  <span className="font-extrabold text-stone-900 break-all normal-case tracking-wide">
                    {profile.email}
                  </span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1">
                  <span className="uppercase block text-stone-500 font-black tracking-wider text-xs flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-maroon" />
                    System Role
                  </span>
                  <span className="font-extrabold text-stone-900 tracking-wider capitalize">
                    {profile.role}
                  </span>
                </div>

                <div className="@3xl:col-span-2 p-4 sm:p-5 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1.5">
                  <span className="uppercase block text-stone-500 font-black tracking-wider text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-maroon" />
                    Privacy & RA 10173 Compliance
                  </span>
                  <span className="text-stone-700 font-medium tracking-wide normal-case block">
                    {profile.privacy_consent_at ? (
                      <>
                        You agreed to the Perpetualite Privacy Notice on{' '}
                        <strong className="text-stone-900">
                          {formatMomentDate(profile.privacy_consent_at)}
                        </strong>
                        .{' '}
                      </>
                    ) : (
                      "You haven't agreed to the Privacy Notice yet. "
                    )}
                    <Link
                      href="/privacy"
                      className="text-maroon font-bold uppercase underline hover:text-gold ml-1 transition-colors"
                    >
                      Read Privacy Notice →
                    </Link>
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label htmlFor="full-name" className="block text-xs font-black text-stone-700 tracking-wider">
                  Full Name
                </label>
                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>

            {/* 3. Student Verification (Players only) */}
            {can(profile.role, 'verification.submit') && (
              <div className="animate-stagger-1">
                <StudentDetails profile={profile} onSaved={() => setReloadCount((n) => n + 1)} />
              </div>
            )}

            {/* 5. Change Password Container */}
            <div className="animate-stagger-3">
              <Suspense
                fallback={<div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs" />}
              >
                {/* Both names: a new password must also pass the check login does (sign-up name),
                    or the next login would flag it as weak again */}
                <ChangePassword email={profile.email} fullName={`${profile.full_name ?? ''} ${signupName}`.trim()} />
              </Suspense>
            </div>

            {/* Help: replay the first-login tour (it shows on the dashboard until dismissed again) */}
            <div className="animate-stagger-3 bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider uppercase">Help</h2>
                <p className="text-sm text-stone-600 font-medium normal-case mt-1">
                  See the quick tour again, or read the <Link href="/help" className="font-bold text-maroon underline">Help &amp; FAQ</Link>.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const { error: tourError } = await supabase.from('profiles').update({ tour_dismissed_at: null }).eq('id', profile.id);
                  if (tourError) {
                    setError(getErrorMessage(tourError, 'The tour could not be restarted.'));
                    return;
                  }
                  await refreshViewer().catch(() => undefined);
                  router.push('/dashboard');
                }}
                className="btn btn-secondary shrink-0"
              >
                Restart quick tour
              </button>
            </div>

          </div>
          <div className="min-w-0 space-y-6 sm:space-y-8">
            {/* Moderation warnings (own count and history) */}
            <MyWarnings userId={profile.id} />

            {/* 4. Game Profiles (Players only) */}
            {can(profile.role, 'team.join') && (
              <div className="animate-stagger-2 bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
                  <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">
                      Game Profiles
                    </h2>
                    <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                      Your in-game name, competitive role, and rank for organization tournaments.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {editingGameId && (
                    <GameProfileForm
                      key={editingGameId}
                      games={games}
                      profiles={gameProfiles}
                      userId={profile.id}
                      initialGameId={editingGameId}
                      onCancel={() => setEditingGameId(null)}
                      onSaved={(gameName) => {
                        setEditingGameId(null);
                        setReloadCount((n) => n + 1);
                        toast.success(`${gameName} profile saved.`);
                      }}
                    />
                  )}
                  {games.map((game) => {
                    const gp = gameProfiles.find((p) => p.game_id === game.id);

                    return (
                      <div
                        key={game.id}
                        className="bg-stone-50/70 border border-stone-200/90 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4 hover:border-stone-300 hover:bg-stone-50 transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-ink border border-stone-800 flex items-center justify-center p-2 shadow-xs shrink-0">
                            <GameLogo name={game.name} gameId={game.id} className="w-9 h-9" fallbackClassName="text-xs" sizes="38px" />
                          </div>
                          <div>
                            <h3 className="font-black text-stone-950 text-sm tracking-wider uppercase">
                              {game.name}
                            </h3>
                            {gp ? (
                              <GameProfileSummary game={game} profile={gp} />
                            ) : (
                              <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
                                Not set up yet
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-black tracking-wider">
                          <button
                            onClick={() => startEditing(game.id)}
                            disabled={saving}
                            className="rounded-xl border border-stone-300 hover:border-gold bg-white text-maroon hover:text-gold px-4 py-2 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                          >
                            {gp ? 'Edit Profile' : '+ Add Profile'}
                          </button>
                          {gp && (
                            <button
                              onClick={() => handleRemoveGameProfile(gp, game.name)}
                              disabled={saving}
                              className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 px-3.5 py-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Teams the player is on (same summary as the dashboard) */}
            {can(profile.role, 'team.join') && <MyTeamsSummary />}
          </div>
        </div>

        {/* 6. Danger Zone: Delete Account */}
        <div className="animate-stagger-3 bg-red-50/20 border border-red-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-red-100">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 grid place-items-center shadow-2xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-red-700 tracking-wider uppercase">
                Delete Account
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-medium tracking-wide mt-0.5 normal-case">
                Permanently removes your account, tournament records, and roster profiles. This action cannot be undone.
              </p>
            </div>
          </div>

          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="rounded-xl border border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Delete my account
            </button>
          ) : (
            <div className="space-y-4 pt-1 max-w-lg">
              <label htmlFor="delete-confirm" className="block text-xs font-black text-stone-800 tracking-wider">
                Type <span className="font-mono font-black text-red-700">DELETE</span> to confirm:
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                className={inputClass}
                placeholder="DELETE"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== 'DELETE' || saving}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black px-6 py-3 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? 'Deleting...' : 'Permanently Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setDeleteText('');
                  }}
                  className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-3 text-xs tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// Change password component
function ChangePassword({ email, fullName }: { email: string; fullName: string }) {
  const supabase = createClient();
  const weak = useSearchParams().get('weak') === '1';
  const formRef = useRef<HTMLFormElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (weak) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [weak]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const passwordError = getPasswordError(newPassword, { email, fullName });
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) throw new Error('Your current password is incorrect.');

      // weak_password: false lifts the "change your password" gate in proxy.ts
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { weak_password: false },
      });
      if (updateError) throw updateError;

      // Sent here by the weak-password gate: continue with a full load, because other pages
      // were cached as "redirect to /profile?weak=1" while the gate was on (see reloadTo)
      if (weak) {
        reloadTo('/dashboard');
        return;
      }
      toast.success('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change the password'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
        <div className="w-10 h-10 rounded-xl bg-maroon/10 border border-maroon/20 text-maroon grid place-items-center shadow-2xs">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">Change Password</h2>
          <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
            Keep your organization account secure with a strong password.
          </p>
        </div>
      </div>

      {weak && !message && (
        <div
          role="status"
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-900 p-4 text-xs font-bold tracking-wider shadow-2xs"
        >
          Your password does not meet our latest security standards. Please choose a stronger password below.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-xs font-bold tracking-wider text-red-800 shadow-2xs flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-bold tracking-wider text-emerald-800 shadow-2xs flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-black text-stone-700 tracking-wider">
          Current Password
        </label>
        <PasswordField
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Current password"
          className={inputClass}
          autoComplete="current-password"
        />
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4 sm:gap-6 items-start">
        <div className="space-y-1.5">
          <label className="block text-xs font-black text-stone-700 tracking-wider">
            New Password
          </label>
          <PasswordField
            value={newPassword}
            onChange={setNewPassword}
            placeholder="New password"
            className={inputClass}
            autoComplete="new-password"
            rules={{ email, fullName }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-black text-stone-700 tracking-wider">
            Confirm New Password
          </label>
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm new password"
            className={inputClass}
            autoComplete="new-password"
            matches={newPassword}
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? 'Saving...' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}
