'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getErrorMessage } from '@/utils/errors'
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy'
import { confirmEmailRedirect } from '@/utils/auth'
import PrivacyConsentCheckbox from '@/components/PrivacyConsentCheckbox'

const inputClass = 'w-full p-3 bg-[#0a0a0c] text-white border border-[#00d2ff] rounded-lg'

export default function Register() {
  const supabase = createClient()
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('player')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Set after signing up when Supabase requires email confirmation
  const [sentTo, setSentTo] = useState('')
  const [resendMessage, setResendMessage] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('The password must be at least 8 characters.')
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
          // privacy_consent is saved as profiles.privacy_consent_at (Data Privacy Act).
          data: {
            full_name: fullName.trim(),
            role,
            privacy_consent: true,
            privacy_notice_version: PRIVACY_NOTICE_VERSION,
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
      <div className="min-h-screen grid place-items-center bg-[#0a0a0c] px-4">
        <div className="w-full max-w-md bg-[#1a1a2e] rounded-xl p-8 shadow-[0_0_30px_rgba(0,210,255,0.1)] text-center space-y-4">
          <h1 className="text-[#00d2ff] text-2xl font-bold">Check your email to confirm your account</h1>
          <p className="text-gray-300">
            We sent a confirmation link to <span className="text-white font-semibold">{sentTo}</span>.
            Open it to activate your account, then log in.
          </p>
          <p className="text-gray-500 text-sm">Can&apos;t find it? Check your spam folder, or send it again.</p>
          <button onClick={handleResend} className="border border-[#00d2ff] text-[#00d2ff] px-4 py-2 rounded-lg font-bold hover:bg-[#00d2ff]/10">
            Resend email
          </button>
          {resendMessage && <p className="text-sm text-gray-300">{resendMessage}</p>}
          <p>
            <Link href="/auth/login" className="text-[#00d2ff]">Go to login</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[#0a0a0c] px-4 py-10">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md bg-[#1a1a2e] rounded-xl p-8 shadow-[0_0_30px_rgba(0,210,255,0.1)] space-y-4"
      >
        <h1 className="text-[#00d2ff] text-2xl font-bold text-center mb-4">Register</h1>

        {error && <div className="bg-[#ff4444] text-white px-3 py-2 rounded-lg">{error}</div>}

        <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)}
          className={inputClass} autoComplete="name" required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className={inputClass} autoComplete="email" required />
        <input type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)}
          className={inputClass} autoComplete="new-password" required />
        <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass} autoComplete="new-password" required />

        <div>
          <label htmlFor="role" className="block text-gray-400 mb-2">I am a:</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="player">Player</option>
            <option value="spectator">Audience / Spectator</option>
          </select>
        </div>

        <PrivacyConsentCheckbox checked={consent} onChange={setConsent} />

        <button
          type="submit"
          disabled={loading || !consent}
          className="w-full p-3 bg-[#00d2ff] text-black font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <p className="text-center text-gray-300">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#00d2ff]">Login</Link>
        </p>
      </form>
    </div>
  )
}
