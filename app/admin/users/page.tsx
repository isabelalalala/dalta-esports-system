'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createSignupClient } from '@/utils/supabase/signup-client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import type { Profile } from '@/utils/types';
import ExportButtons from '@/components/ExportButtons';

const ROLES = ['admin', 'staff', 'player', 'spectator'] as const;

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  staff: 'Tournament Staff',
  player: 'Player',
  spectator: 'Audience / Spectator',
};

const inputClass =
  'border border-brownlight bg-sitebg px-3 py-2 text-white outline-none focus:border-gold disabled:opacity-50';

export default function ManageUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Increase this to make the effect below load the users again
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Admin/staff can read every profile (RLS); everyone else only gets their own row.
        const { data, error: usersError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (usersError) throw usersError;

        setUsers(data || []);
        setMe((data || []).find((p) => p.id === session.user.id) || null);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load users'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, reloadCount]);

  if (loading) return <div className="min-h-screen bg-sitebg text-white p-10 text-center">Loading...</div>;

  // Hiding the page is only for convenience; the database refuses these changes from non-admins.
  if (me?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-sitebg text-white p-10 text-center">
        Only administrators can manage users.{' '}
        <Link href="/dashboard" className="text-gold underline">Back to the dashboard</Link>
      </div>
    );
  }

  // Search and role filter run in the browser over the loaded list
  // (fine for a school-sized number of users).
  const query = search.trim().toLowerCase();
  const visibleUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (!query) return true;
    return (u.full_name || '').toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
  });

  return (
    <div className="min-h-screen bg-sitebg text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <Link href="/dashboard" className="inline-block text-gold hover:underline mb-6">
          ← Back to Dashboard
        </Link>

        <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Manage Users</h1>
        <p className="text-gray-400 mt-2 mb-4">
          New organizers register as a normal account first, then you change their role here.
        </p>
        <div className="mb-6">
          <ExportButtons type="users" label="User list" />
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>
        )}

        <AddAccountForm onCreated={() => setReloadCount((n) => n + 1)} />

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className={`${inputClass} flex-1`}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputClass}>
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </div>

        <p className="text-gray-400 text-sm mb-3">
          Showing {visibleUsers.length} of {users.length} users
        </p>

        <div className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] overflow-hidden">
          {/* Header (hidden on phones, where each user is a stacked card) */}
          <div className="hidden md:grid grid-cols-12 gap-4 bg-gold text-black font-bold px-6 py-3">
            <div className="col-span-4">Name / Email</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-2">Joined</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {visibleUsers.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400">No users match.</p>
          ) : (
            <div className="divide-y divide-brown">
              {visibleUsers.map((user) => (
                // updated_at in the key resets the row's form after every save
                <UserRow
                  key={`${user.id}-${user.updated_at}-${user.role}`}
                  user={user}
                  isMe={user.id === me.id}
                  onChanged={() => setReloadCount((n) => n + 1)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// One user with inline name editing, a role dropdown and delete.
function UserRow({ user, isMe, onChanged }: { user: Profile; isMe: boolean; onChanged: () => void }) {
  const supabase = createClient();
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(user.full_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Updates this user's profile and checks that a row was really changed
  // (RLS blocks silently: no error, no rows).
  const updateProfile = async (changes: Partial<Pick<Profile, 'role' | 'full_name'>>) => {
    setBusy(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', user.id)
        .select('id');
      if (updateError) throw updateError;
      if (!data || data.length === 0) throw new Error('Only administrators can change other users.');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save'));
      setBusy(false);
    }
  };

  const handleRoleChange = (role: string) => {
    if (role === user.role) return;
    // Promotions give access to organizer tools, so confirm them
    if ((role === 'admin' || role === 'staff') &&
        !confirm(`Make ${user.email} ${roleLabels[role]}? They will get access to organizer tools.`)) {
      return;
    }
    // The database refuses demoting the last admin, with a readable message
    updateProfile({ role });
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ full_name: fullName.trim() || null });
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete the account ${user.email}? This can't be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      // The database checks that you're an admin, not deleting yourself,
      // and that the user isn't a captain with teammates.
      const { error: deleteError } = await supabase.rpc('admin_delete_user', { target: user.id });
      if (deleteError) throw deleteError;
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete user'));
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 md:items-center">
      {/* Name and email */}
      <div className="md:col-span-4 min-w-0">
        {editingName ? (
          <form onSubmit={handleSaveName} className="flex gap-2">
            <input
              type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name" className={`${inputClass} flex-1 min-w-0`} autoFocus
            />
            <button type="submit" disabled={busy} className="text-gold font-semibold text-sm disabled:opacity-50">
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditingName(false); setFullName(user.full_name || ''); }}
              className="text-gray-400 text-sm"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="font-semibold truncate">
            {user.full_name || <span className="italic text-gray-500">No name</span>}
            {isMe && <span className="ml-2 text-xs text-yellow-400">(you)</span>}
          </p>
        )}
        <p className="text-gray-400 text-sm truncate">{user.email}</p>
      </div>

      {/* Role */}
      <div className="md:col-span-3">
        <select
          value={user.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={busy}
          className={`${inputClass} w-full`}
          aria-label={`Role of ${user.email}`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabels[r]}</option>
          ))}
        </select>
      </div>

      {/* Join date */}
      <div className="md:col-span-2 text-gray-400 text-sm">
        <span className="md:hidden">Joined </span>
        {/* created_at is a real moment in time, so show it in the viewer's time zone */}
        {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        {/* Data Privacy Act consent; only the user can give it (see /privacy/consent) */}
        <span className="block text-xs text-gray-500">
          {user.privacy_consent_at
            ? `Privacy consent ${new Date(user.privacy_consent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'No privacy consent yet'}
        </span>
      </div>

      {/* Actions */}
      <div className="md:col-span-3 flex md:justify-end gap-3 text-sm font-semibold">
        {!editingName && (
          <button onClick={() => setEditingName(true)} disabled={busy} className="text-gold hover:underline disabled:opacity-50">
            Edit name
          </button>
        )}
        {!isMe && (
          <button onClick={handleDelete} disabled={busy} className="text-red-400 hover:text-red-300 disabled:opacity-50">
            Delete
          </button>
        )}
      </div>

      {error && <p className="md:col-span-12 text-sm text-red-300">{error}</p>}
    </div>
  );
}

// Admin creates an account for someone else, with a temporary password.
// The person confirms their email, logs in, and changes the password on My Profile.
function AddAccountForm({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('player');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('The temporary password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      // Sign up with a separate client so the admin stays logged in.
      // The sign-up trigger creates the profile (as player or spectator).
      const { data, error: signUpError } = await createSignupClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), role },
          emailRedirectTo: `${window.location.origin}/auth/login`,
        },
      });
      if (signUpError) throw signUpError;

      // For an existing email Supabase returns a user with no identities
      // (instead of an error, so outsiders can't check who is registered).
      if (!data.user || data.user.identities?.length === 0) {
        throw new Error('An account with this email already exists.');
      }

      // Staff and admin can't be chosen at sign-up, so the admin sets them now.
      if (role === 'staff' || role === 'admin') {
        const { data: updated, error: roleError } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', data.user.id)
          .select('id');
        if (roleError) throw roleError;
        if (!updated || updated.length === 0) {
          throw new Error('The account was created, but its role could not be set. Change it in the list below.');
        }
      }

      setMessage(`Account created for ${email.trim()}. They must confirm their email, then log in with the temporary password and change it on My Profile.`);
      setEmail('');
      setFullName('');
      setRole('player');
      setPassword('');
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create the account'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="mb-6">
        {message && (
          <div className="mb-3 bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>
        )}
        <button
          onClick={() => setOpen(true)}
          className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition"
        >
          + Add account
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="mb-6 bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6 space-y-4">
      <h2 className="text-xl font-bold">Add account</h2>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}
      {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" className={inputClass} required
        />
        <input
          type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name" className={inputClass} required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabels[r]}</option>
          ))}
        </select>
        <input
          type="text" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Temporary password (8+ characters)" className={inputClass} required
          autoComplete="off"
        />
      </div>
      <p className="text-gray-400 text-sm">
        Give the person this temporary password. They receive a confirmation email first.
      </p>

      <div className="flex gap-2">
        <button
          type="submit" disabled={saving}
          className="bg-gold text-black px-6 py-2 font-bold hover:bg-golddark transition disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create account'}
        </button>
        <button
          type="button" onClick={() => { setOpen(false); setError(''); setMessage(''); }}
          className="text-gray-400 px-6 py-2 hover:text-white transition"
        >
          Close
        </button>
      </div>
    </form>
  );
}
