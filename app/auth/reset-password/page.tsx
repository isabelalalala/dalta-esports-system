'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/utils/page-title';
import { getPasswordError } from '@/utils/password';
import PasswordField from '@/components/PasswordField';

// Reached from the reset email (through /auth/callback, which logs the user in).
export default function ResetPasswordPage() {
  usePageTitle('Reset password');
  const supabase = createClient();
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  // The account's email, so the new password can't contain it
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // No session means the link was invalid, expired, or opened in another browser.
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setEmail(session?.user.email ?? '');
    };
    check();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = getPasswordError(password, { email });
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change the password'));
      setSaving(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen grid place-items-center bg-sitebg px-4">
      <div className="w-full max-w-md bg-sitecard p-6 sm:p-8 shadow-[6px_6px_0_var(--color-brown)]">
        <h1 className="text-gold text-2xl font-bold text-center mb-6">Choose a new password</h1>

        {hasSession === null ? (
          <p className="text-gray-400 text-center">Checking your link...</p>
        ) : !hasSession ? (
          <div className="text-center space-y-4">
            <p className="text-gray-300">
              This reset link is invalid or has expired. Links only work once, for a limited time,
              and in the browser where you requested them.
            </p>
            <Link href="/auth/forgot-password" className="text-gold font-semibold">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-3 py-2">{error}</div>}
            <PasswordField
              value={password} onChange={setPassword} placeholder="New password"
              className="w-full p-3 bg-sitebg text-white border border-gold"
              autoComplete="new-password" rules={{ email }}
            />
            <PasswordField
              value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password"
              className="w-full p-3 bg-sitebg text-white border border-gold"
              autoComplete="new-password" matches={password}
            />
            <button
              type="submit" disabled={saving}
              className="w-full p-3 bg-gold text-black font-bold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
