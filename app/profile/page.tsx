'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Game, PlayerGameProfile, Profile } from '@/utils/types';
import VerifiedBadge from '@/components/VerifiedBadge';
import StudentDetails from './StudentDetails';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { usePageTitle } from '@/utils/page-title';

const inputClass =
  'w-full border border-brownlight bg-sitebg px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-gold';

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
  // Increase this to make the effect below load everything again
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);
        setFullName(profileData.full_name || '');

        const [gamesRes, gpRes] = await Promise.all([
          supabase
            .from('games')
            .select('*')
            .order('name'),
          supabase
            .from('player_game_profiles')
            .select('*')
            .eq('user_id', session.user.id),
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
  }, [supabase, reloadCount]);

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
      setMessage('Name saved.');
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
      // Update the row if this game already has one, otherwise add a new row
      const existing = gameProfiles.find((gp) => gp.game_id === editingGameId);
      const { error: saveError } = existing
        ? await supabase.from('player_game_profiles').update(fields).eq('id', existing.id)
        : await supabase
            .from('player_game_profiles')
            .insert([{ ...fields, user_id: profile.id, game_id: editingGameId }]);
      if (saveError) throw saveError;

      setEditingGameId(null);
      setReloadCount((n) => n + 1);
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
      // The database checks that you're not a captain with teammates
      // and not the only admin, then deletes the account.
      const { error: deleteError } = await supabase.rpc('delete_own_account');
      if (deleteError) throw deleteError;

      // The account is gone; just clear the session cookies in this browser.
      await supabase.auth.signOut({ scope: 'local' });
      router.push('/');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete account'));
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }
  if (!profile) {
    return <PageError message={error || 'Profile not found. It may have been deleted.'} backHref="/dashboard" backLabel="Back to Dashboard" />;
  }

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/dashboard" className="text-gold hover:underline inline-block">
          ← Back to Dashboard
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">My Profile</h1>

        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>
        )}
        {message && (
          <div role="status" className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>
        )}

        {/* Account details */}
        <form onSubmit={handleSaveName} className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6 space-y-4">
          <h2 className="text-xl font-bold">Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="block text-gray-400">Email</span>
              <span className="break-all">{profile.email}</span>
            </div>
            <div>
              <span className="block text-gray-400">Role</span>
              <span className="capitalize">{profile.role}</span> <VerifiedBadge verified={profile.is_verified} />
            </div>
            <div className="md:col-span-2">
              <span className="block text-gray-400">Privacy</span>
              <span>
                {profile.privacy_consent_at
                  ? `You agreed to the Privacy Notice on ${new Date(profile.privacy_consent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}. `
                  : 'You haven\'t agreed to the Privacy Notice yet. '}
                <Link href="/privacy" className="text-gold underline">Read the Privacy Notice</Link>
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="full-name" className="block text-sm font-semibold text-gray-300 mb-2">Full Name</label>
            <input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition disabled:opacity-50"
          >
            Save Name
          </button>
        </form>

        {/* Student verification, players only (the database also enforces this) */}
        {profile.role === 'player' && (
          <StudentDetails profile={profile} onSaved={() => setReloadCount((n) => n + 1)} />
        )}

        {/* In-game profiles, players only (the database also enforces this) */}
        {profile.role === 'player' && (
          <div className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6">
            <h2 className="text-xl font-bold mb-1">Game Profiles</h2>
            <p className="text-gray-400 text-sm mb-6">Your in-game name, role and rank for each game you play.</p>

            <div className="space-y-4">
              {games.map((game) => {
                const gp = gameProfiles.find((p) => p.game_id === game.id);

                if (editingGameId === game.id) {
                  return (
                    <form
                      key={game.id}
                      onSubmit={handleSaveGameProfile}
                      className="bg-sitebg border border-gold p-4 space-y-3"
                    >
                      <h3 className="font-bold text-gold">{game.name}</h3>
                      <input
                        type="text" placeholder="IGN (in-game name) *" aria-label="IGN (in-game name)"
                        value={ign} onChange={(e) => setIgn(e.target.value)}
                        className={inputClass} required
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text" placeholder="In-game role (e.g. Jungler, Duelist)" aria-label="In-game role (e.g. Jungler, Duelist)"
                          value={inGameRole} onChange={(e) => setInGameRole(e.target.value)}
                          className={inputClass}
                        />
                        <input
                          type="text" placeholder="Rank (e.g. Mythic, Diamond 2)" aria-label="Rank (e.g. Mythic, Diamond 2)"
                          value={rank} onChange={(e) => setRank(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit" disabled={saving}
                          className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button" onClick={() => setEditingGameId(null)}
                          className="text-gray-400 px-6 py-2 hover:text-white transition"
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
                    className="bg-sitebg border border-brown p-4 flex flex-wrap justify-between items-center gap-4"
                  >
                    <div>
                      <h3 className="font-bold text-gold">{game.name}</h3>
                      {gp ? (
                        <p className="text-sm text-gray-300">
                          {gp.ign}
                          {gp.in_game_role && <span className="text-gray-400"> · {gp.in_game_role}</span>}
                          {gp.rank && <span className="text-gray-400"> · {gp.rank}</span>}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">Not set up</p>
                      )}
                    </div>
                    <div className="flex gap-3 text-sm font-semibold">
                      <button
                        onClick={() => startEditing(game.id)}
                        disabled={saving}
                        className="text-gold hover:underline disabled:opacity-50"
                      >
                        {gp ? 'Edit' : '+ Add'}
                      </button>
                      {gp && (
                        <button
                          onClick={() => handleRemoveGameProfile(gp, game.name)}
                          disabled={saving}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
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

        <ChangePassword email={profile.email} />

        {/* Danger zone */}
        <div className="border border-red-500 p-6">
          <h2 className="text-xl font-bold text-red-400">Delete my account</h2>
          <p className="text-gray-400 text-sm mt-1">
            This permanently deletes your account, profile and game profiles. It can&apos;t be undone.
          </p>

          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="mt-4 border border-red-500 text-red-400 hover:bg-red-500 hover:text-white px-6 py-2 font-bold transition"
            >
              Delete my account
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <label htmlFor="delete-confirm" className="block text-sm text-gray-300">
                Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm:
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== 'DELETE' || saving}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 font-bold transition disabled:opacity-50"
                >
                  {saving ? 'Deleting...' : 'Permanently delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setDeleteText('');
                  }}
                  className="text-gray-400 px-6 py-2 hover:text-white transition"
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

// Change password. The current password is checked first by signing in again,
// so someone using an unattended logged-in computer can't change it.
function ChangePassword({ email }: { email: string }) {
  const supabase = createClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) throw new Error('Your current password is incorrect.');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setMessage('Password changed.');
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
    <form onSubmit={handleSubmit} className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6 space-y-4">
      <h2 className="text-xl font-bold">Change Password</h2>
      {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}
      {message && <div role="status" className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>}
      <input
        type="password" placeholder="Current password" aria-label="Current password"
        value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
        className={inputClass} autoComplete="current-password" required
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="password" placeholder="New password (8+ characters)" aria-label="New password (8+ characters)"
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass} autoComplete="new-password" required
        />
        <input
          type="password" placeholder="Confirm new password" aria-label="Confirm new password"
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass} autoComplete="new-password" required
        />
      </div>
      <button
        type="submit" disabled={saving}
        className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Change Password'}
      </button>
    </form>
  );
}
