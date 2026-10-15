'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';

// Reached from the reset email (through /auth/callback, which logs the user in).
export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // No session means the link was invalid, expired, or opened in another browser.
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
    };
    check();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('The new password must be at least 8 characters.');
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
    <div className="min-h-screen grid place-items-center bg-[#0a0a0c] px-4">
      <div className="w-full max-w-md bg-[#1a1a2e] rounded-xl p-8 shadow-[0_0_30px_rgba(0,210,255,0.1)]">
        <h1 className="text-[#00d2ff] text-2xl font-bold text-center mb-6">Choose a new password</h1>

        {hasSession === null ? (
          <p className="text-gray-400 text-center">Checking your link...</p>
        ) : !hasSession ? (
          <div className="text-center space-y-4">
            <p className="text-gray-300">
              This reset link is invalid or has expired. Links only work once, for a limited time,
              and in the browser where you requested them.
            </p>
            <Link href="/auth/forgot-password" className="text-[#00d2ff] font-semibold">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-[#ff4444] text-white px-3 py-2 rounded-lg">{error}</div>}
            <input
              type="password" placeholder="New password (8+ characters)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#0a0a0c] text-white border border-[#00d2ff] rounded-lg"
              autoComplete="new-password" required
            />
            <input
              type="password" placeholder="Confirm new password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-[#0a0a0c] text-white border border-[#00d2ff] rounded-lg"
              autoComplete="new-password" required
            />
            <button
              type="submit" disabled={saving}
              className="w-full p-3 bg-[#00d2ff] text-black font-bold rounded-lg disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
