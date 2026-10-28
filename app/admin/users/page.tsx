'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createSignupClient } from '@/utils/supabase/signup-client';
import Link from 'next/link';
import { getErrorMessage } from '@/utils/errors';
import { getPasswordError } from '@/utils/password';
import EmailField from '@/components/EmailField';
import PasswordField from '@/components/PasswordField';
import { confirmEmailRedirect, getEmailError } from '@/utils/auth';
import type { Profile } from '@/utils/types';
import { usePageTitle } from '@/utils/page-title';
import ExportButtons from '@/components/ExportButtons';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import PageLoading from '@/components/PageLoading';

const ROLES = ['admin', 'staff', 'player', 'spectator'] as const;

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  staff: 'Tournament Staff',
  player: 'Player',
  spectator: 'Audience / Spectator',
};

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

export default function ManageUsersPage() {
  const supabase = createClient();
  usePageTitle('Manage users');
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

  if (loading) return <PageLoading />;

  // Hiding the page is only for convenience; the database refuses these changes from non-admins.
  if (me?.role !== 'admin') {
    return (
      <div className="w-full bg-white text-stone-950 p-10 text-center uppercase space-y-4">
        <p className="font-extrabold text-stone-900">Only administrators can manage users.</p>
        <Link href="/dashboard" className="inline-block text-amber-700 hover:text-amber-800 font-bold underline">
          ← Back to the dashboard
        </Link>
      </div>
    );
  }

  // Search and role filter run in the browser over the loaded list
  const query = search.trim().toLowerCase();
  const visibleUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (!query) return true;
    return (u.full_name || '').toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
  });

  return (
    <div className="w-full space-y-8 uppercase">
      {/* 1. Main Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 lg:p-16 text-center text-white flex flex-col items-center justify-center space-y-4">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Users Banner" />

        <div className="relative z-10 w-full flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-3 pt-2">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight"
            style={{ color: '#ffffff' }}
          >
            Manage Users
          </h1>
          <p
            className="text-base sm:text-lg !text-white text-stone-200 font-medium uppercase tracking-wide leading-relaxed"
            style={{ color: '#ffffff' }}
          >
            New organizers register as a normal account first, then you change their role here.
          </p>
        </div>
      </section>

      {/* 2. Main Content Controls & User Listing */}
      <div className="space-y-6 text-stone-950">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ExportButtons type="users" label="User list" />
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs sm:text-sm font-bold tracking-wider shadow-2xs">
            {error}
          </div>
        )}

        <AddAccountForm onCreated={() => setReloadCount((n) => n + 1)} />

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search by name or email"
            className={`${inputClass} flex-1`}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`${inputClass} sm:w-64`}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </div>

        <p className="text-stone-500 font-bold text-xs tracking-wider">
          Showing {visibleUsers.length} of {users.length} users
        </p>

        <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 bg-stone-100 text-stone-900 font-black text-xs uppercase tracking-wider px-6 py-3.5 border-b border-stone-200">
            <div className="col-span-4">Name / Email</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-2">Joined</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {visibleUsers.length === 0 && error ? null : visibleUsers.length === 0 ? (
            <p className="px-6 py-12 text-center text-stone-500 font-semibold tracking-wider">No users match.</p>
          ) : (
            <div className="divide-y divide-stone-200/80">
              {visibleUsers.map((user) => (
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

// One user with inline name editing, role dropdown, and delete.
function UserRow({ user, isMe, onChanged }: { user: Profile; isMe: boolean; onChanged: () => void }) {
  const supabase = createClient();
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(user.full_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    if ((role === 'admin' || role === 'staff') &&
        !confirm(`Make ${user.email} ${roleLabels[role]}? They will get access to organizer tools.`)) {
      return;
    }
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
      const { error: deleteError } = await supabase.rpc('admin_delete_user', { target: user.id });
      if (deleteError) throw deleteError;
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete user'));
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 md:items-center hover:bg-stone-50/60 transition-colors">
      {/* Name and email */}
      <div className="md:col-span-4 min-w-0">
        {editingName ? (
          <form onSubmit={handleSaveName} className="flex gap-2">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              aria-label="Full name"
              className={`${inputClass} flex-1 min-w-0 !p-2`}
              autoFocus
            />
            <button
              type="submit"
              disabled={busy}
              className="text-amber-700 hover:text-amber-800 font-extrabold text-xs tracking-wider disabled:opacity-50 cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditingName(false); setFullName(user.full_name || ''); }}
              className="text-stone-500 hover:text-stone-700 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="font-extrabold text-stone-950 text-sm tracking-wide truncate">
            {user.full_name || <span className="italic text-stone-400">No name</span>}
            {isMe && <span className="ml-2 text-xs text-amber-600 font-black">(you)</span>}
          </p>
        )}
        <p className="text-stone-500 font-medium text-xs tracking-wide truncate normal-case mt-0.5">{user.email}</p>
      </div>

      {/* Role */}
      <div className="md:col-span-3">
        <select
          value={user.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={busy}
          className={`${inputClass} w-full !p-2`}
          aria-label={`Role of ${user.email}`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabels[r]}</option>
          ))}
        </select>
      </div>

      {/* Join date */}
      <div className="md:col-span-2 text-stone-600 font-medium text-xs tracking-wider">
        <span className="md:hidden">Joined </span>
        {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        <span className="block text-[11px] text-stone-400 mt-0.5 normal-case font-normal">
          {user.privacy_consent_at
            ? `Consent: ${new Date(user.privacy_consent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'No privacy consent yet'}
        </span>
      </div>

      {/* Actions */}
      <div className="md:col-span-3 flex md:justify-end gap-3 text-xs font-black tracking-wider">
        {!editingName && (
          <button
            onClick={() => setEditingName(true)}
            disabled={busy}
            className="text-amber-700 hover:text-amber-800 underline disabled:opacity-50 cursor-pointer"
          >
            Edit name
          </button>
        )}
        {!isMe && (
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-red-600 hover:text-red-700 underline disabled:opacity-50 cursor-pointer"
          >
            Delete
          </button>
        )}
      </div>

      {error && <p role="alert" className="md:col-span-12 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

// Admin creates an account for someone else
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

    const emailError = getEmailError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = getPasswordError(password, { email, fullName });
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSaving(true);
    try {
      const { data, error: signUpError } = await createSignupClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), role },
          emailRedirectTo: confirmEmailRedirect(),
        },
      });
      if (signUpError) throw signUpError;

      if (!data.user || data.user.identities?.length === 0) {
        throw new Error('An account with this email already exists.');
      }

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
      <div className="mb-2">
        {message && (
          <div role="status" className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
            {message}
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 border border-amber-400 transition-all cursor-pointer"
        >
          + Add Account
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5 text-stone-950">
      <div className="pb-2 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">Add New Account</h2>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); setMessage(''); }}
          className="text-stone-500 hover:text-stone-800 text-xs font-bold cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="space-y-1">
          <label className="block text-xs font-black text-stone-700 tracking-wider">Email Address</label>
          <EmailField value={email} onChange={setEmail} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-black text-stone-700 tracking-wider">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            aria-label="Full name"
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-black text-stone-700 tracking-wider">System Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} aria-label="Role">
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-black text-stone-700 tracking-wider">Temporary Password</label>
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="Temporary password"
            className={inputClass}
            autoComplete="new-password"
            rules={{ email, fullName }}
          />
        </div>
      </div>

      <p className="text-stone-500 font-medium text-xs tracking-wide normal-case">
        Provide the user with this temporary password. They must confirm their email before logging in.
      </p>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 border border-amber-400 transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Creating...' : 'Create Account'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); setMessage(''); }}
          className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-3 text-xs tracking-wider transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
