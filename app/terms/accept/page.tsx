'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { TOS_VERSION } from '@/utils/terms';
import TermsCheckbox from '@/components/TermsCheckbox';
import { usePageTitle } from '@/utils/page-title';

// proxy.ts sends users here when they haven't accepted the current Terms of Service:
// accounts made before the terms existed, accounts added by an admin, or after the terms changed.
export default function AcceptTermsPage() {
  const supabase = createClient();
  const router = useRouter();
  usePageTitle('Accept Terms of Service');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAgree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    setSaving(true);
    setError('');
    try {
      // Saves the version and date on the user's own profile (see migration 202610181900)
      const { error: acceptError } = await supabase.rpc('accept_tos', { p_version: TOS_VERSION });
      if (acceptError) throw acceptError;
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your acceptance'));
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <main id="main-content" className="min-h-screen grid place-items-center bg-sitebg px-4 py-10">
      <form
        onSubmit={handleAgree}
        className="w-full max-w-lg bg-sitecard p-6 sm:p-8 shadow-[6px_6px_0_var(--color-brown)] space-y-5"
      >
        <h1 className="text-gold text-2xl font-bold text-center">Terms of Service</h1>
        <p className="text-gray-300">
          Before you continue, please read our{' '}
          <Link href="/terms" target="_blank" className="text-gold underline">Terms of Service</Link> and{' '}
          <Link href="/conduct" target="_blank" className="text-gold underline">Code of Conduct</Link>. They cover
          accounts, acceptable use, tournaments and results, pick&apos;em predictions and the content you share.
        </p>

        {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-3 py-2">{error}</div>}

        <TermsCheckbox checked={consent} onChange={setConsent} />

        <button
          type="submit"
          disabled={saving || !consent}
          className="w-full p-3 bg-gold text-black font-bold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Accept and continue'}
        </button>

        <div className="border-t border-gray-700 pt-4 text-sm text-gray-400 space-y-2">
          <p>If you don&apos;t accept, you can log out.</p>
          <button type="button" onClick={handleLogout} className="text-red-400 font-semibold hover:underline">
            Log out
          </button>
        </div>
      </form>
    </main>
  );
}
