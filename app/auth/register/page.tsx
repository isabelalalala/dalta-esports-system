'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getErrorMessage } from '@/utils/errors'
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy'
import { TOS_VERSION } from '@/utils/terms'
import { confirmEmailRedirect, getEmailError } from '@/utils/auth'
import { getPasswordError } from '@/utils/password'
import EmailField from '@/components/EmailField'
import PasswordField from '@/components/PasswordField'
import PrivacyConsentCheckbox from '@/components/PrivacyConsentCheckbox'
import TermsCheckbox from '@/components/TermsCheckbox'
import { usePageTitle } from '@/utils/page-title'

const inputClass = 'w-full p-3 bg-sitebg text-white border border-gold'

export default function Register() {
  usePageTitle('Register')
  const supabase = createClient()
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('player')
  const [consent, setConsent] = useState(false)
  const [tosConsent, setTosConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Set after signing up when Supabase requires email confirmation
  const [sentTo, setSentTo] = useState('')
  const [resendMessage, setResendMessage] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // The fields block these too; checked again here in case the browser skipped it
    const emailError = getEmailError(email)
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = getPasswordError(password, { email, fullName })
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    // The checkbox is required in the form too; this is a second check
    if (!consent) {
      setError('Please agree to the Privacy Notice to create an account.')
      return
    }
    if (!tosConsent) {
      setError('Please accept the Terms of Service to create an account.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // The confirmation link logs the user in through /auth/callback
          emailRedirectTo: confirmEmailRedirect(),
          // The database trigger handle_new_user() creates the profile from this data.
          // It only accepts 'player'; any other role is saved as 'spectator'.
          // Admin and staff roles are given by an administrator, never at sign-up.
          // privacy_consent is saved as profiles.privacy_consent_at (Data Privacy Act);
          // tos_consent/tos_version as profiles.tos_accepted_at/tos_version (Terms of Service).
          data: {
            full_name: fullName.trim(),
            role,
            privacy_consent: true,
            privacy_notice_version: PRIVACY_NOTICE_VERSION,
            tos_consent: true,
            tos_version: TOS_VERSION,
          },
        },
      })

      if (error) throw error

      // A session means email confirmation is turned off in Supabase: the user is logged in.
      if (data.session) {
        router.push('/dashboard')
        return
      }
      // No session: Supabase sent a confirmation email first.
      setSentTo(email.trim())
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendMessage('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: sentTo,
      options: { emailRedirectTo: confirmEmailRedirect() },
    })
    setResendMessage(error ? getErrorMessage(error, 'Could not resend the email.') : 'Sent again. Check your inbox and spam folder.')
  }

  if (sentTo) {
    return (
      <main id="main-content" className="min-h-screen grid place-items-center bg-sitebg px-4">
        <div className="w-full max-w-md bg-sitecard p-6 sm:p-8 shadow-[6px_6px_0_var(--color-brown)] text-center space-y-4">
          <h1 className="text-gold text-2xl font-bold">Check your email to confirm your account</h1>
          <p className="text-gray-300">
            We sent a confirmation link to <span className="text-white font-semibold">{sentTo}</span>.
            Open it to activate your account, then log in.
          </p>
          <p className="text-gray-400 text-sm">Can&apos;t find it? Check your spam folder, or send it again.</p>
          <button onClick={handleResend} className="border border-gold text-gold px-4 py-2 font-bold hover:bg-gold/10">
            Resend email
          </button>
          {resendMessage && <p className="text-sm text-gray-300">{resendMessage}</p>}
          <p>
            <Link href="/auth/login" className="text-gold">Go to login</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="min-h-screen grid place-items-center bg-sitebg px-4 py-10">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md bg-sitecard p-6 sm:p-8 shadow-[6px_6px_0_var(--color-brown)] space-y-4"
      >
        <h1 className="text-gold text-2xl font-bold text-center mb-4">Register</h1>

        {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-3 py-2">{error}</div>}

        <input type="text" placeholder="Full Name" aria-label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)}
          className={inputClass} autoComplete="name" required />
        <EmailField value={email} onChange={setEmail} className={inputClass} />
        <PasswordField value={password} onChange={setPassword} className={inputClass}
          placeholder="Password" autoComplete="new-password" rules={{ email, fullName }} />
        <PasswordField value={confirmPassword} onChange={setConfirmPassword} className={inputClass}
          placeholder="Confirm Password" autoComplete="new-password" matches={password} />

        <div>
          <label htmlFor="role" className="block text-gray-400 mb-2">I am a:</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="player">Player</option>
            <option value="spectator">Audience / Spectator</option>
          </select>
        </div>

        <PrivacyConsentCheckbox checked={consent} onChange={setConsent} />
        <TermsCheckbox checked={tosConsent} onChange={setTosConsent} />

        <button
          type="submit"
          disabled={loading || !consent || !tosConsent}
          className="w-full p-3 bg-gold text-black font-bold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <p className="text-center text-gray-300">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-gold">Login</Link>
        </p>
      </form>
    </main>
  )
}
