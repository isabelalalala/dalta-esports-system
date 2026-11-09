'use client';

import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { reloadTo, safeNextPath } from '@/utils/auth';
import { usePageTitle } from '@/utils/page-title';

// Second login step for organizers who turned on two-factor authentication: enter the 6-digit code
// from the authenticator app. proxy.ts sends them here from every protected page until this session
// is AAL2; the database (get_my_role()) treats them as a spectator until then.
export default function MfaPage() {
  usePageTitle('Two-factor code');
  const supabase = createClient();
  const params = useSearchParams();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const clean = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = factors.totp.find((f) => f.status === 'verified');
      if (!factor) {
        // 2FA was turned off meanwhile: nothing to check
        reloadTo(safeNextPath(params.get('next'), window.location.origin));
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: clean });
      if (verifyError) throw verifyError;
      // A full load: the session cookie is now AAL2, proxy.ts lets the page through
      reloadTo(safeNextPath(params.get('next'), window.location.origin));
    } catch (err) {
      setError(getErrorMessage(err, 'That code didn’t work. Check the time on your phone and try the newest code.'));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const logOut = async () => {
    await supabase.auth.signOut();
    reloadTo('/auth/login');
  };

  return (
    <main id="main-content" className="min-h-screen w-full grid place-items-center bg-white px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-maroon/10 text-maroon">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-stone-950 text-2xl font-black tracking-wider uppercase">Two-factor code</h1>
          <p className="text-sm text-stone-600">Open your authenticator app and enter the 6-digit code for DALTA Esports.</p>
        </div>
        <label className="block text-sm font-bold text-stone-800">
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-center text-2xl font-black tracking-[0.4em] text-stone-950 outline-none focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/25"
          />
        </label>
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? 'Checking…' : 'Continue'}</button>
        <p className="text-center text-sm text-stone-600">
          Lost your phone? Ask another administrator to remove your 2FA in the Supabase dashboard
          (Authentication → Users), then log in again.{' '}
          <button type="button" onClick={logOut} className="font-bold text-maroon underline">Log out</button>
        </p>
      </form>
    </main>
  );
}
