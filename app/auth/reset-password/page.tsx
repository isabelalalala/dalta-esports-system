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
    <main id="main-content" className="min-h-screen w-full grid place-items-center bg-white px-4 py-12 uppercase">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 shadow-sm space-y-5">
        <h1 className="text-stone-950 text-2xl sm:text-3xl font-black text-center tracking-wider uppercase mb-2">Choose a new password</h1>

        {hasSession === null ? (
          <p className="text-stone-500 font-semibold uppercase tracking-wider text-center">Checking your link...</p>
        ) : !hasSession ? (
          <div className="text-center space-y-4">
            <p className="text-stone-700 font-medium uppercase tracking-wide text-sm">
              This reset link is invalid or has expired. Links only work once, for a limited time,
              and in the browser where you requested them.
            </p>
            <Link href="/auth/forgot-password" className="text-amber-800 font-extrabold uppercase tracking-wider hover:underline text-sm">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div role="alert" className="bg-red-50 border border-red-500/30 rounded-xl text-red-700 px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider">{error}</div>}
            <PasswordField
              value={password} onChange={setPassword} placeholder="New password"
              className="w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-200 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all"
              autoComplete="new-password" rules={{ email }}
            />
            <PasswordField
              value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password"
              className="w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-200 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all"
              autoComplete="new-password" matches={password}
            />
            <button
              type="submit" disabled={saving}
              className="w-full p-3.5 rounded-xl bg-gold text-stone-950 font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all uppercase tracking-widest disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
