'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/utils/page-title';
import { getEmailError } from '@/utils/auth';
import EmailField from '@/components/EmailField';

export default function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const emailError = getEmailError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setLoading(true);

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
    <main id="main-content" className="min-h-screen w-full grid place-items-center bg-white px-4 py-12 uppercase">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 shadow-sm space-y-5">
        <h1 className="text-stone-950 text-2xl sm:text-3xl font-black text-center tracking-wider uppercase mb-2">Forgot password</h1>

        {sent ? (
          // Same message whether or not the email has an account, so nobody can
          // use this page to find out who is registered.
          <p className="text-stone-700 font-medium uppercase tracking-wide text-center text-sm">
            If <span className="text-stone-950 font-black">{email}</span> has an account, we sent a link to
            reset the password. Open it on this device and browser.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-stone-600 font-medium text-xs sm:text-sm uppercase tracking-wide">Enter your email and we&apos;ll send you a link to choose a new password.</p>
            {error && <div role="alert" className="bg-red-50 border border-red-500/30 rounded-xl text-red-700 px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider">{error}</div>}
            <EmailField value={email} onChange={setEmail} className="w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-200 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all" />
            <button
              type="submit"
              disabled={loading}
              className="w-full p-3.5 rounded-xl bg-gold text-stone-950 font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 uppercase tracking-widest disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center mt-6">
          <Link href="/auth/login" className="text-amber-800 font-extrabold uppercase tracking-wider hover:underline text-xs sm:text-sm">Back to login</Link>
        </p>
      </div>
    </main>
  );
}
