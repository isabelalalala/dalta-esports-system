'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy';
import PrivacyConsentCheckbox from '@/components/PrivacyConsentCheckbox';
import { usePageTitle } from '@/utils/page-title';

// The dashboard sends users here when they haven't agreed to the current Privacy Notice:
// accounts made before the notice existed, accounts added by an admin, or after the notice changed.
export default function PrivacyConsentPage() {
  const supabase = createClient();
  const router = useRouter();
  usePageTitle('Privacy consent');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAgree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    setSaving(true);
    setError('');
    try {
      // Saves the date and version on the user's own profile (see migration 202610170900)
      const { error: consentError } = await supabase.rpc('give_privacy_consent', { p_version: PRIVACY_NOTICE_VERSION });
      if (consentError) throw consentError;
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your consent'));
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
        <h1 className="text-stone-950 text-2xl sm:text-3xl font-black text-center tracking-wider uppercase mb-2">Your privacy</h1>
        <p className="text-stone-700 font-medium uppercase tracking-wide text-xs sm:text-sm leading-relaxed">
          Before you continue, please read our{' '}
          <Link href="/privacy" target="_blank" className="text-amber-800 font-extrabold uppercase underline hover:text-amber-950">Privacy Notice</Link>. It explains
          what personal data we collect, why, who can see it, how long we keep it, and how to delete your account.
        </p>

        {error && <div role="alert" className="bg-red-50 border border-red-500/30 rounded-xl text-red-700 px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider">{error}</div>}

        <PrivacyConsentCheckbox checked={consent} onChange={setConsent} />

        <button
          type="submit"
          disabled={saving || !consent}
          className="w-full p-3.5 rounded-xl bg-gold text-stone-950 font-black border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Agree and continue'}
        </button>

        <div className="border-t border-stone-100 pt-4 text-xs text-stone-600 font-medium uppercase tracking-wide space-y-2">
          <p>
            If you don&apos;t agree, you can log out. To remove your data, delete your account on{' '}
            <Link href="/profile" className="text-amber-800 font-extrabold uppercase underline hover:text-amber-950">My Profile</Link> under &quot;Delete my account&quot;.
          </p>
          <button type="button" onClick={handleLogout} className="text-red-700 font-black uppercase tracking-wider hover:underline">
            Log out
          </button>
        </div>
      </form>
    </main>
  );
}
