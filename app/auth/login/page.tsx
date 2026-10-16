'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getErrorMessage } from '@/utils/errors'
import { confirmEmailRedirect, isEmailNotConfirmed } from '@/utils/auth'
import { usePageTitle } from '@/utils/page-title'

const inputClass = 'w-full p-3 bg-sitebg text-white border border-gold'

export default function Login() {
  usePageTitle('Log in')
  const supabase = createClient()
  const router = useRouter()
  // ?confirmed=1: the user came from the "confirm your email" link
  const confirmed = useSearchParams().get('confirmed') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // Set when the login failed because the email isn't confirmed yet
  const [notConfirmed, setNotConfirmed] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // The confirmation link usually logs the user in already (same browser): go straight on.
  useEffect(() => {
    if (!confirmed) return
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.replace('/dashboard')
    }
    check()
  }, [confirmed, router, supabase])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotConfirmed(false)
    setResendMessage('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      if (isEmailNotConfirmed(err)) {
        setNotConfirmed(true)
      } else {
        setError(getErrorMessage(err, 'Login failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendMessage('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: confirmEmailRedirect() },
    })
    setResendMessage(error ? getErrorMessage(error, 'Could not resend the email.') : 'Sent. Check your inbox and spam folder.')
  }

  return (
    <main id="main-content" className="min-h-screen grid place-items-center bg-sitebg px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-sitecard p-6 sm:p-8 shadow-[6px_6px_0_var(--color-brown)] space-y-4"
      >
        <h1 className="text-gold text-2xl font-bold text-center mb-4">Login</h1>

        {confirmed && !notConfirmed && !error && (
          <div role="status" className="bg-green-500/10 border border-green-500 text-green-300 px-3 py-2">
            Thanks for confirming your email. You can log in now.
          </div>
        )}

        {error && <div role="alert" className="bg-red-500/10 border border-red-500 text-red-300 px-3 py-2">{error}</div>}

        {notConfirmed && (
          <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-200 px-3 py-2 space-y-2">
            <p>
              Please confirm your email first. Open the link we sent to{' '}
              <span className="font-semibold">{email.trim()}</span> when you registered.
            </p>
            <button type="button" onClick={handleResend} className="underline font-semibold">
              Resend confirmation email
            </button>
            {resendMessage && <p className="text-sm">{resendMessage}</p>}
          </div>
        )}

        <input type="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className={inputClass} autoComplete="email" required />
        <input type="password" placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className={inputClass} autoComplete="current-password" required />

        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 bg-gold text-black font-bold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-center">
          <Link href="/auth/forgot-password" className="text-gold">Forgot password?</Link>
        </p>
        <p className="text-center text-gray-300">
          Don&apos;t have an account? <Link href="/auth/register" className="text-gold">Register</Link>
        </p>
      </form>
    </main>
  )
}
