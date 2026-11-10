'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy';
import { TOS_VERSION } from '@/utils/terms';
import {
  confirmEmailRedirect, EMAIL_COOLDOWN_SECONDS, emailRateLimitMessage, emailRetryDelay, getEmailError, isEmailRateLimited, reloadTo,
} from '@/utils/auth';
import { useCooldown } from '@/utils/use-cooldown';
import { getPasswordError } from '@/utils/password';
import EmailField from '@/components/EmailField';
import PasswordField, { PasswordRules } from '@/components/PasswordField';
import PrivacyConsentCheckbox from '@/components/PrivacyConsentCheckbox';
import TermsCheckbox from '@/components/TermsCheckbox';
import { usePageTitle } from '@/utils/page-title';

const inputClass =
  'w-full p-3.5 rounded-xl bg-stone-50 focus:bg-surface text-stone-950 border border-stone-300 placeholder:text-stone-500 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

export default function Register() {
  usePageTitle('Sign up');
  const supabase = createClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('player');
  const [consent, setConsent] = useState(false);
  const [tosConsent, setTosConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Set after signing up when Supabase requires email confirmation
  const [sentTo, setSentTo] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [resending, setResending] = useState(false);
  // True when the last sign-up failed because the email limit was reached: shows "Try again"
  const [rateLimited, setRateLimited] = useState(false);
  // Waits before another email may be requested (sign-up retry or resend)
  const cooldown = useCooldown();
  // Blocks a second submit (double-click, Enter held down) before `loading` has re-rendered the button
  const submittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || cooldown.remaining > 0) return;
    setError('');
    setRateLimited(false);

    const emailError = getEmailError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = getPasswordError(password, { email, fullName });
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!consent) {
      setError('Please agree to the Privacy Notice to create an account.');
      return;
    }
    if (!tosConsent) {
      setError('Please accept the Terms of Service to create an account.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: confirmEmailRedirect(),
          data: {
            full_name: fullName.trim(),
            role,
            privacy_consent: true,
            privacy_notice_version: PRIVACY_NOTICE_VERSION,
            tos_consent: true,
            tos_version: TOS_VERSION,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        reloadTo('/dashboard');
        return;
      }
      setSentTo(email.trim());
      // An email was just sent: "Resend" waits a minute
      cooldown.start(EMAIL_COOLDOWN_SECONDS);
    } catch (err) {
      if (isEmailRateLimited(err)) {
        setRateLimited(true);
        setError(emailRateLimitMessage(err, 'signup'));
        cooldown.start(emailRetryDelay(err));
      } else {
        setError(getErrorMessage(err, 'Registration failed'));
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown.remaining > 0) return;
    setResending(true);
    setResendMessage('');
    setResendError('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: sentTo,
      options: { emailRedirectTo: confirmEmailRedirect() },
    });
    setResending(false);
    if (!error) {
      setResendMessage('Sent again. Check your inbox and spam folder.');
      cooldown.start(EMAIL_COOLDOWN_SECONDS);
    } else if (isEmailRateLimited(error)) {
      setResendError(emailRateLimitMessage(error, 'resend'));
      cooldown.start(emailRetryDelay(error));
    } else {
      setResendError(getErrorMessage(error, 'Could not resend the email.'));
    }
  };

  return (
    <main id="main-content" className="relative w-full min-h-screen flex flex-col justify-between overflow-x-hidden">
      {/* Full-Page Background Image with Blur & Dim Overlay */}
      <div className="fixed inset-0 -z-10 bg-stone-950 overflow-hidden">
        <Image
          src="/Home Page Photo.png"
          alt="DALTA Esports Background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center scale-105"
        />
        {/* Soft semi-transparent dark overlay for high contrast */}
        <div className="absolute inset-0 bg-stone-950/65 backdrop-blur-xs" />
        <div className="absolute inset-0 bg-radial from-transparent via-stone-950/40 to-stone-950/80" />
      </div>

      {/* Top Header Occupying the Full Width Edge-to-Edge */}
      <header className="relative z-10 w-full px-6 sm:px-10 lg:px-16 py-6 flex items-center justify-between">
        {/* Top-Left: Brand Logo & Wordmark */}
        <Link href="/" className="inline-flex items-center gap-3 group">
          <Image
            src="/DALTA ESPORTS LOGO TRNPRNT.png"
            alt="DALTA Esports logo"
            width={46}
            height={46}
            className="rounded-xl object-contain bg-black/40 p-1.5 backdrop-blur-md border border-white/20 group-hover:scale-105 transition-transform"
          />
          <span className="font-black text-white text-sm sm:text-base tracking-wider uppercase drop-shadow-md group-hover:text-amber-400 transition-colors">
            DALTA <span className="text-amber-400">ESPORTS</span>
          </span>
        </Link>

        {/* Top-Right: Back to Home Button */}
        <Link
          href="/"
          className="px-4 py-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/20 text-white hover:text-amber-400 text-xs font-black uppercase tracking-wider backdrop-blur-md transition-all flex items-center gap-2 shadow-xs hover:-translate-y-0.5"
        >
          ← Back to Home
        </Link>
      </header>

      {/* Centered White Container Card */}
      <div className="relative z-10 w-full max-w-2xl lg:max-w-3xl mx-auto my-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Solid card: a see-through one let the dark photo turn it grey, and the muted text failed contrast */}
        <div className="w-full bg-surface border border-stone-200/90 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-2xl text-stone-950 space-y-6">
          {/* Header Title */}
          <div className="pb-4 border-b border-stone-100">
            <h1 className="text-stone-950 text-2xl sm:text-3xl lg:text-4xl font-black tracking-wider uppercase leading-tight">
              {sentTo ? 'Check Your Email' : 'Sign Up'}
            </h1>
            <p className="text-stone-500 text-xs sm:text-sm font-bold mt-1">
              {sentTo ? 'Verify to activate your account' : 'Official Collegiate Esports Organization'}
            </p>
          </div>

          {sentTo ? (
            /* Email Sent Confirmation View */
            <div className="text-center space-y-5 py-6 max-w-lg mx-auto">
              <p className="text-stone-700 font-medium text-xs sm:text-sm leading-relaxed">
                We sent a confirmation link to <span className="text-stone-950 font-black">{sentTo}</span>.
                Open it to activate your account, then log in.
              </p>
              <p className="text-stone-500 font-bold text-xs">
                Can&apos;t find it? Check your spam folder, or request another link below.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || cooldown.remaining > 0}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-widest shadow-md hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {resending ? 'Sending...' : cooldown.remaining > 0 ? `Resend in ${cooldown.remaining}s` : 'Resend email'}
              </button>
              {resendMessage && <p role="status" className="text-xs font-bold text-emerald-700">{resendMessage}</p>}
              {resendError && <p role="alert" className="text-xs font-bold text-red-700">{resendError}</p>}
              <p className="pt-2">
                <Link
                  href="/auth/login"
                  className="text-amber-700 font-black hover:underline hover:text-amber-800 text-xs sm:text-sm"
                >
                  ← Go to login
                </Link>
              </p>
            </div>
          ) : (
            /* Registration Form */
            <form ref={formRef} onSubmit={handleRegister} className="space-y-5">
              {error && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-xl text-red-700 px-4 py-3 text-xs sm:text-sm font-bold shadow-xs space-y-3">
                  <p>{error}</p>
                  {/* Email limit reached: the same form can be sent again after the wait */}
                  {rateLimited && (
                    <button
                      type="button"
                      onClick={() => formRef.current?.requestSubmit()}
                      disabled={loading || cooldown.remaining > 0}
                      className="px-4 py-2 rounded-xl bg-white border border-red-300 text-red-700 font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {cooldown.remaining > 0 ? `Try again in ${cooldown.remaining}s` : 'Try again'}
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-4 sm:space-y-5">
                {/* 1. Full Name & Email in 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-stone-800 normal-case">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Full Name"
                      aria-label="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputClass}
                      autoComplete="name"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-stone-800 normal-case">
                      Email
                    </label>
                    <EmailField
                      value={email}
                      onChange={setEmail}
                      className={inputClass}
                      placeholder="m@example.com"
                    />
                  </div>
                </div>

                {/* 2. Password with Password Requirements directly below it */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-stone-800 normal-case">
                    Password
                  </label>
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    className={inputClass}
                    placeholder="Password"
                    autoComplete="new-password"
                    rules={{ email, fullName }}
                    hideRules
                  />
                  {/* Password requirements placed directly below the password */}
                  <div className="pt-1">
                    <PasswordRules
                      value={password}
                      rules={{ email, fullName }}
                    />
                  </div>
                </div>

                {/* 3. Confirm Password placed below the password requirements */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-stone-800 normal-case">
                    Confirm Password
                  </label>
                  <PasswordField
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    className={inputClass}
                    placeholder="Confirm Password"
                    autoComplete="new-password"
                    matches={password}
                  />
                </div>

                {/* 4. Role Selection placed below Confirm Password and above Privacy/Terms */}
                <div className="space-y-1.5">
                  <label htmlFor="role" className="block text-sm font-bold text-stone-800 normal-case">
                    I am a:
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={`${inputClass} bg-white text-stone-950 [&>option]:bg-white [&>option]:text-stone-950`}
                  >
                    <option value="player">Player</option>
                    <option value="spectator">Audience / Spectator</option>
                  </select>
                </div>
              </div>

              {/* Privacy and Terms Checkboxes */}
              <div className="space-y-3 pt-2">
                <PrivacyConsentCheckbox checked={consent} onChange={setConsent} />
                <TermsCheckbox checked={tosConsent} onChange={setTosConsent} />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !consent || !tosConsent || cooldown.remaining > 0}
                className="w-full py-4 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs sm:text-sm uppercase tracking-widest shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Creating account...' : cooldown.remaining > 0 ? `Sign up (wait ${cooldown.remaining}s)` : 'Sign up'}
              </button>

              {/* Bottom Login Link */}
              <p className="text-center text-stone-600 font-medium text-xs sm:text-sm pt-2">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="text-amber-700 font-black tracking-wider hover:underline hover:text-amber-800 ml-1.5"
                >
                  Log in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Subtle Brand Credit */}
      <footer className="relative z-10 w-full text-center text-white/70 text-[11px] font-bold tracking-widest py-4 drop-shadow-xs">
        DALTA ESPORTS · UPHSD MOLINO
      </footer>
    </main>
  );
}
