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
    <main id="main-content" className="min-h-screen w-full grid place-items-center bg-white px-4 py-12 uppercase">
      <form
        onSubmit={handleAgree}
        className="w-full max-w-lg bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 shadow-sm space-y-5"
      >
        <h1 className="text-stone-950 text-2xl sm:text-3xl font-black text-center tracking-wider uppercase mb-2">Terms of Service</h1>
        <p className="text-stone-700 font-medium uppercase tracking-wide text-xs sm:text-sm leading-relaxed">
          Before you continue, please read our{' '}
          <Link href="/terms" target="_blank" className="text-amber-800 font-extrabold uppercase underline hover:text-amber-950">Terms of Service</Link> and{' '}
          <Link href="/conduct" target="_blank" className="text-amber-800 font-extrabold uppercase underline hover:text-amber-950">Code of Conduct</Link>. They cover
          accounts, acceptable use, tournaments and results, pick&apos;em predictions and the content you share.
        </p>

        {error && <div role="alert" className="bg-red-50 border border-red-500/30 rounded-xl text-red-700 px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider">{error}</div>}

        <TermsCheckbox checked={consent} onChange={setConsent} />

        <button
          type="submit"
          disabled={saving || !consent}
          className="w-full p-3.5 rounded-xl bg-gold text-stone-950 font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Accept and continue'}
        </button>

        <div className="border-t border-stone-100 pt-4 text-xs text-stone-600 font-medium uppercase tracking-wide space-y-2">
          <p>If you don&apos;t accept, you can log out.</p>
          <button type="button" onClick={handleLogout} className="text-red-700 font-black uppercase tracking-wider hover:underline">
            Log out
          </button>
        </div>
      </form>
    </main>
  );
}
