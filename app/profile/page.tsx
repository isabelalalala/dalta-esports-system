'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
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
  Sparkles,
} from 'lucide-react';

const inputClass =
  'w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-[#FFCC37] focus:ring-2 focus:ring-[#FFCC37]/25 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

// Match game name to official logo asset
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

export default function ProfilePage() {
  usePageTitle('Profile');
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [gameProfiles, setGameProfiles] = useState<PlayerGameProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  // Game profile form: which game is being edited, and its fields
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [ign, setIgn] = useState('');
  const [inGameRole, setInGameRole] = useState('');
  const [rank, setRank] = useState('');

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
        setProfile(profileData);
        setFullName(profileData.full_name || '');

        const [gamesRes, gpRes] = await Promise.all([
          supabase.from('games').select('*').order('name'),
          supabase.from('player_game_profiles').select('*').eq('user_id', session.user.id),
        ]);
        if (gamesRes.error) throw gamesRes.error;
        if (gpRes.error) throw gpRes.error;
        setGames(gamesRes.data || []);
        setGameProfiles(gpRes.data || []);
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
      setMessage('Name updated successfully.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save name'));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (gameId: string) => {
    const existing = gameProfiles.find((gp) => gp.game_id === gameId);
    setEditingGameId(gameId);
    setIgn(existing?.ign || '');
    setInGameRole(existing?.in_game_role || '');
    setRank(existing?.rank || '');
    setError('');
    setMessage('');
  };

  const handleSaveGameProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !editingGameId) return;
    setSaving(true);
    setError('');

    const fields = {
      ign: ign.trim(),
      in_game_role: inGameRole.trim() || null,
      rank: rank.trim() || null,
    };

    try {
      const existing = gameProfiles.find((gp) => gp.game_id === editingGameId);
      const { error: saveError } = existing
        ? await supabase.from('player_game_profiles').update(fields).eq('id', existing.id)
        : await supabase
            .from('player_game_profiles')
            .insert([{ ...fields, user_id: profile.id, game_id: editingGameId }]);
      if (saveError) throw saveError;

      setEditingGameId(null);
      setReloadCount((n) => n + 1);
      setMessage('Game profile saved.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save game profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveGameProfile = async (gp: PlayerGameProfile, gameName: string) => {
    if (!confirm(`Remove your ${gameName} profile?`)) return;
    setSaving(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('player_game_profiles')
        .delete()
        .eq('id', gp.id);
      if (deleteError) throw deleteError;
      setReloadCount((n) => n + 1);
      setMessage('Game profile removed.');
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
      router.push('/');
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

  const initials = (profile.full_name || profile.email || 'U').slice(0, 2).toUpperCase();

  return (
    <main
      id="main-content"
      className="flex-1 w-full min-h-[calc(100vh-160px)] bg-white text-stone-950 px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-10 uppercase"
    >
      <div className="w-full max-w-6xl mx-auto space-y-8">
        {/* 1. Main Hero Container (Matching Dashboard & Tournaments Layout) */}
        <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-center text-white flex flex-col items-center justify-center space-y-5">
          <PageHeroBackground specificKey="dashboard_hero_bg_path" alt="DALTA Esports Profile Banner" />

          {/* Action Bar inside Hero: Back Link & Badges */}
          <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-black text-[#FFCC37] hover:text-[#FFE066] uppercase tracking-wider transition-colors"
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
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[#5B271E]/40 via-stone-900 to-black border-2 border-[#FFCC37]/60 text-[#FFCC37] font-black text-2xl sm:text-3xl grid place-items-center tracking-widest shadow-xl shadow-black/50">
              {initials}
            </div>
            <h1
              className="animate-hero-title text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
              style={{ color: '#ffffff' }}
            >
              {profile.full_name || 'My Profile'}
            </h1>
            <p
              className="animate-hero-tagline text-xs sm:text-sm text-stone-300 font-semibold tracking-wider normal-case"
              style={{ color: '#ffffff' }}
            >
              {profile.email}
            </p>
          </div>
        </section>

        {/* Global Notifications */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 sm:p-5 text-red-700 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div
            role="status"
            className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 sm:p-5 text-emerald-800 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-3 shadow-xs"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{message}</span>
          </div>
        )}

        {/* 2. Account Information Card */}
        <form
          onSubmit={handleSaveName}
          className="animate-stagger-1 bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
            <div className="w-10 h-10 rounded-xl bg-[#5B271E]/10 border border-[#5B271E]/20 text-[#5B271E] grid place-items-center shadow-2xs">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
            <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1">
              <span className="block text-stone-500 font-black tracking-wider text-xs flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#5B271E]" />
                Email Address
              </span>
              <span className="font-extrabold text-stone-900 break-all normal-case tracking-wide">
                {profile.email}
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1">
              <span className="block text-stone-500 font-black tracking-wider text-xs flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#5B271E]" />
                System Role
              </span>
              <span className="font-extrabold text-stone-900 tracking-wider capitalize">
                {profile.role}
              </span>
            </div>

            <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-1.5">
              <span className="block text-stone-500 font-black tracking-wider text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#5B271E]" />
                Privacy & RA 10173 Compliance
              </span>
              <span className="text-stone-700 font-medium tracking-wide normal-case block">
                {profile.privacy_consent_at ? (
                  <>
                    You agreed to the Perpetualite Privacy Notice on{' '}
                    <strong className="text-stone-900">
                      {new Date(profile.privacy_consent_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </strong>
                    .{' '}
                  </>
                ) : (
                  "You haven't agreed to the Privacy Notice yet. "
                )}
                <Link
                  href="/privacy"
                  className="text-[#5B271E] font-bold uppercase underline hover:text-[#FFCC37] ml-1 transition-colors"
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
        {profile.role === 'player' && (
          <div className="animate-stagger-1">
            <StudentDetails profile={profile} onSaved={() => setReloadCount((n) => n + 1)} />
          </div>
        )}

        {/* 4. Game Profiles (Players only) */}
        {profile.role === 'player' && (
          <div className="animate-stagger-2 bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-[#5B271E]/10 border border-[#5B271E]/20 text-[#5B271E] grid place-items-center shadow-2xs">
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
              {games.map((game) => {
                const gp = gameProfiles.find((p) => p.game_id === game.id);
                const logo = getGameLogo(game.name, game.id);

                if (editingGameId === game.id) {
                  return (
                    <form
                      key={game.id}
                      onSubmit={handleSaveGameProfile}
                      className="bg-stone-50/80 border border-[#FFCC37]/70 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3 pb-2 border-b border-stone-200">
                        {logo ? (
                          <div className="w-10 h-10 rounded-xl bg-[#0e0c0b] border border-stone-800 flex items-center justify-center p-1.5 shadow-xs shrink-0">
                            <Image src={logo} alt={game.name} width={32} height={32} className="object-contain" />
                          </div>
                        ) : null}
                        <div>
                          <h3 className="font-black text-[#5B271E] text-sm tracking-wider uppercase">
                            Editing {game.name} Profile
                          </h3>
                          <p className="text-[11px] text-stone-500 font-medium uppercase tracking-wide">
                            Enter your official IGN, role, and current competitive tier.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-stone-700 tracking-wider">
                          In-Game Name (IGN) *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. DALTA_Sniper"
                          aria-label="IGN (in-game name)"
                          value={ign}
                          onChange={(e) => setIgn(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-black text-stone-700 tracking-wider">
                            In-Game Role
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Jungler, Duelist, Anchor"
                            aria-label="In-game role"
                            value={inGameRole}
                            onChange={(e) => setInGameRole(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-black text-stone-700 tracking-wider">
                            Competitive Rank
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Mythic, Diamond 2, Ascendant"
                            aria-label="Rank"
                            value={rank}
                            onChange={(e) => setRank(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-wider shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGameId(null)}
                          className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-2.5 text-xs tracking-wider transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={game.id}
                    className="bg-stone-50/70 border border-stone-200/90 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4 hover:border-stone-300 hover:bg-stone-50 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-4">
                      {logo ? (
                        <div className="w-12 h-12 rounded-2xl bg-[#0e0c0b] border border-stone-800 flex items-center justify-center p-2 shadow-xs shrink-0">
                          <Image src={logo} alt={game.name} width={38} height={38} className="object-contain" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-stone-200 border border-stone-300 grid place-items-center text-stone-700 font-black text-sm shrink-0">
                          {game.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-black text-stone-950 text-sm tracking-wider uppercase">
                          {game.name}
                        </h3>
                        {gp ? (
                          <p className="text-xs sm:text-sm font-semibold text-stone-700 mt-0.5">
                            IGN: <span className="text-stone-950 font-black">{gp.ign}</span>
                            {gp.in_game_role && (
                              <span className="text-stone-500 font-medium"> · Role: {gp.in_game_role}</span>
                            )}
                            {gp.rank && (
                              <span className="text-stone-500 font-medium"> · Rank: {gp.rank}</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-stone-400 font-medium tracking-wide mt-0.5">
                            Not set up yet
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-black tracking-wider">
                      <button
                        onClick={() => startEditing(game.id)}
                        disabled={saving}
                        className="rounded-xl border border-stone-300 hover:border-[#FFCC37] bg-white text-[#5B271E] hover:text-[#FFCC37] px-4 py-2 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
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

        {/* 5. Change Password Container */}
        <div className="animate-stagger-3">
          <Suspense
            fallback={<div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs" />}
          >
            <ChangePassword email={profile.email} fullName={profile.full_name ?? ''} />
          </Suspense>
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
    </main>
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

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setMessage('Password changed successfully.');
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
      className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 uppercase"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
        <div className="w-10 h-10 rounded-xl bg-[#5B271E]/10 border border-[#5B271E]/20 text-[#5B271E] grid place-items-center shadow-2xs">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
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
