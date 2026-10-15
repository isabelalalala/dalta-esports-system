'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy';
import PrivacyConsentCheckbox from '@/components/PrivacyConsentCheckbox';

// The dashboard sends users here when they haven't agreed to the current Privacy Notice:
// accounts made before the notice existed, accounts added by an admin, or after the notice changed.
export default function PrivacyConsentPage() {
  const supabase = createClient();
  const router = useRouter();
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
    <div className="min-h-screen grid place-items-center bg-[#0a0a0c] px-4 py-10">
      <form
        onSubmit={handleAgree}
        className="w-full max-w-lg bg-[#1a1a2e] rounded-xl p-8 shadow-[0_0_30px_rgba(0,210,255,0.1)] space-y-5"
      >
        <h1 className="text-[#00d2ff] text-2xl font-bold text-center">Your privacy</h1>
        <p className="text-gray-300">
          Before you continue, please read our{' '}
          <Link href="/privacy" target="_blank" className="text-[#00d2ff] underline">Privacy Notice</Link>. It explains
          what personal data we collect, why, who can see it, how long we keep it, and how to delete your account.
        </p>

        {error && <div className="bg-[#ff4444] text-white px-3 py-2 rounded-lg">{error}</div>}

        <PrivacyConsentCheckbox checked={consent} onChange={setConsent} />

        <button
          type="submit"
          disabled={saving || !consent}
          className="w-full p-3 bg-[#00d2ff] text-black font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Agree and continue'}
        </button>

        <div className="border-t border-gray-700 pt-4 text-sm text-gray-400 space-y-2">
          <p>
            If you don&apos;t agree, you can log out. To remove your data, delete your account on{' '}
            <Link href="/profile" className="text-[#00d2ff] underline">My Profile</Link> under &quot;Delete my account&quot;.
          </p>
          <button type="button" onClick={handleLogout} className="text-red-400 font-semibold hover:underline">
            Log out
          </button>
        </div>
      </form>
    </div>
  );
}
