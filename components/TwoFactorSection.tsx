'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { useConfirm } from '@/components/useConfirm';
import { toast } from '@/components/Toaster';

// Optional two-factor authentication (TOTP, Supabase MFA) for admins and staff, on /profile.
// Set up: scan the QR code with an authenticator app (Google Authenticator, Microsoft
// Authenticator, Authy...) and enter one code. After that every login asks for a code (/auth/mfa)
// and the database gives organizer powers only to sessions that passed it (get_my_role()).
export default function TwoFactorSection() {
  const supabase = createClient();
  const [confirmDialog, ask] = useConfirm();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reload the factor list (after turning 2FA on or off)
  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp.find((f) => f.status === 'verified')?.id ?? null);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setFactorId(data?.totp.find((f) => f.status === 'verified')?.id ?? null);
      setLoaded(true);
    });
  }, [supabase]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      // Remove a half-finished setup from before (unverified factors)
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of all?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `DALTA ${Date.now()}` });
      if (enrollError) throw enrollError;
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start the setup. Two-factor authentication may be off in Supabase.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!setup) return;
    setBusy(true);
    setError('');
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code: code.replace(/\s/g, '') });
      if (verifyError) throw verifyError;
      setSetup(null);
      setCode('');
      toast.success('Two-factor authentication is on. Every login now asks for a code.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'That code didn’t work. Try the newest code.'));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!factorId) return;
    if (!(await ask({ title: 'Turn off two-factor authentication?', message: 'Logins will only need your password again.', confirmLabel: 'Turn off', tone: 'danger' }))) return;
    setBusy(true);
    setError('');
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;
      toast.success('Two-factor authentication is off.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not turn it off. Log out, log in with your code, and try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="mfa-title" className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
      {confirmDialog}
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-maroon/10 text-maroon">
          {factorId ? <ShieldCheck className="size-5" aria-hidden="true" /> : <ShieldOff className="size-5" aria-hidden="true" />}
        </span>
        <div>
          <h2 id="mfa-title" className="text-lg sm:text-xl font-black text-stone-950 tracking-wider uppercase">Two-factor authentication</h2>
          <p className="text-sm text-stone-600">
            {factorId ? 'On: every login asks for a code from your authenticator app.' : 'Recommended for organizer accounts: a code from your phone on every login.'}
          </p>
        </div>
      </div>

      {!loaded ? null : factorId ? (
        <button type="button" onClick={turnOff} disabled={busy} className="btn btn-secondary">Turn off</button>
      ) : setup ? (
        <div className="space-y-4">
          <ol className="max-w-prose list-decimal space-y-1 pl-5 text-sm text-stone-700">
            <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</li>
            <li>Scan this QR code, or type the key below.</li>
            <li>Enter the 6-digit code it shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data address from Supabase, not a page image */}
          <img src={setup.qr} alt="QR code for your authenticator app" className="size-44 rounded-xl border border-stone-200 bg-white p-2" />
          <p className="text-sm text-stone-600 break-all">Key: <code className="font-mono font-bold text-stone-900">{setup.secret}</code></p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-bold text-stone-800">
              Code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                className="mt-1.5 block w-40 rounded-xl border border-stone-300 bg-white p-2.5 text-center text-lg font-black tracking-[0.3em] text-stone-950 outline-none focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/25"
              />
            </label>
            <button type="button" onClick={verify} disabled={busy || code.replace(/\s/g, '').length !== 6} className="btn btn-primary">Turn on</button>
            <button type="button" onClick={() => setSetup(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={start} disabled={busy} className="btn btn-primary">Set up two-factor authentication</button>
      )}
      {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}
