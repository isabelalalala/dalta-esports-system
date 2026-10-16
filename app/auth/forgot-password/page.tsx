'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/utils/page-title';

export default function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // The link in the email goes to /auth/callback, which logs the user in
      // and opens the page where they choose a new password.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the email. Try again later.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen grid place-items-center bg-sitebg px-4">
      <div className="w-full max-w-md bg-sitecard p-6 sm:p-8 shadow-[6px_6px_0_var(--color-brown)]">
        <h1 className="text-gold text-2xl font-bold text-center mb-6">Forgot password</h1>

        {sent ? (
          // Same message whether or not the email has an account, so nobody can
          // use this page to find out who is registered.
          <p className="text-gray-300 text-center">
            If <span className="text-white font-semibold">{email}</span> has an account, we sent a link to
            reset the password. Open it on this device and browser.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-400 text-sm">Enter your email and we&apos;ll send you a link to choose a new password.</p>
            {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-3 py-2">{error}</div>}
            <input
              type="email"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-sitebg text-white border border-gold"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full p-3 bg-gold text-black font-bold disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center mt-6">
          <Link href="/auth/login" className="text-gold">Back to login</Link>
        </p>
      </div>
    </main>
  );
}
