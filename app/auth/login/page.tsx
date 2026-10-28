'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getErrorMessage } from '@/utils/errors'
import { confirmEmailRedirect, getEmailError, isEmailNotConfirmed } from '@/utils/auth'
import { getPasswordError } from '@/utils/password'
import EmailField from '@/components/EmailField'
import PasswordField from '@/components/PasswordField'
import { usePageTitle } from '@/utils/page-title'

const inputClass =
  'w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm'

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-white" />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
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

  // Prevent background scrolling while the full-screen login pane is active
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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

    const emailError = getEmailError(email)
    if (emailError) {
      setError(emailError)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      // Accounts made before the stronger rules may still have a weak password. Let them in,
      // but send them to change it. Supabase also reports this (weakPassword) once its
      // password requirements are turned on in the dashboard.
      if (data.weakPassword || getPasswordError(password, { email })) {
        router.push('/profile?weak=1')
        return
      }
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
    <main id="main-content" className="fixed inset-0 z-50 w-full min-h-screen bg-white text-stone-950 flex flex-col lg:flex-row uppercase overflow-y-auto">
      {/* Left Side: Esports Photo Showcase */}
      <div className="relative w-full lg:w-1/2 xl:w-[55%] min-h-[300px] sm:min-h-[380px] lg:min-h-screen bg-stone-950 overflow-hidden flex flex-col justify-between">
        <Image
          src="/Home Page Photo.png"
          alt="DALTA Esports tournament team"
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover object-center"
        />
        {/* Subtle dark vignette overlay to preserve photo depth and contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30" />

        {/* Top brand logo badge */}
        <div className="relative z-10 p-6 sm:p-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <Image
              src="/DALTA ESPORTS LOGO TRNPRNT.png"
              alt="DALTA Esports logo"
              width={42}
              height={42}
              className="rounded-xl object-contain bg-white/10 p-1 backdrop-blur-xs hover:scale-105 transition-transform"
            />
            <span className="font-black text-white text-xs sm:text-sm tracking-wider uppercase drop-shadow-sm group-hover:text-amber-400 transition-colors">
              DALTA <span className="text-amber-400">ESPORTS</span>
            </span>
          </Link>
        </div>

        {/* Empty bottom space (Official Collegiate Esports badge removed as requested) */}
        <div className="relative z-10 p-6 sm:p-8" />
      </div>

      {/* Right Side: Clean White Login Form Pane */}
      <div className="flex-1 w-full lg:w-1/2 xl:w-[45%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 bg-white min-h-screen">
        {/* Top Header Actions */}
        <div className="flex items-center justify-between w-full pb-8">
          <Link
            href="/"
            className="text-stone-500 hover:text-stone-950 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            ← Back to Home
          </Link>

          <div className="flex items-center gap-2">
            <span className="px-4 py-2 rounded-xl border border-stone-300 bg-stone-100 text-stone-950 font-black text-xs uppercase tracking-wider shadow-2xs">
              Log In
            </span>
            <Link
              href="/auth/register"
              className="px-4 sm:px-5 py-2 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs uppercase tracking-wider shadow-xs hover:-translate-y-0.5 transition-all"
            >
              Sign Up
            </Link>
          </div>
        </div>

        {/* Center Login Form */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6 py-6">
          <div className="text-center space-y-2">
            <h1 className="text-amber-600 text-2xl sm:text-3xl lg:text-4xl font-black tracking-wider uppercase leading-tight">
              Login to your account
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {confirmed && !notConfirmed && !error && (
              <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider shadow-2xs">
                Thanks for confirming your email. You can log in now.
              </div>
            )}

            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-xl text-red-800 px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider shadow-2xs">
                {error}
              </div>
            )}

            {notConfirmed && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl text-amber-950 px-4 py-3 text-xs sm:text-sm font-medium uppercase tracking-wide space-y-2 shadow-2xs">
                <p>
                  Please confirm your email first. Open the link we sent to{' '}
                  <span className="font-black text-stone-950">{email.trim()}</span> when you registered.
                </p>
                <button type="button" onClick={handleResend} className="underline font-black text-amber-700 hover:text-amber-800 uppercase tracking-wider cursor-pointer">
                  Resend confirmation email
                </button>
                {resendMessage && <p className="text-xs font-bold text-amber-800">{resendMessage}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-stone-800 uppercase tracking-wider">
                Email
              </label>
              <EmailField
                value={email}
                onChange={setEmail}
                className={inputClass}
                placeholder="m@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-stone-800 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 uppercase tracking-wider hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <PasswordField
                value={password}
                onChange={setPassword}
                className={inputClass}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black text-xs sm:text-sm uppercase tracking-widest shadow-xs hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
 
          </form>

          <p className="text-center text-stone-600 font-medium uppercase tracking-wide text-xs sm:text-sm pt-2">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/register"
              className="text-amber-700 font-black uppercase tracking-wider hover:underline hover:text-amber-800 ml-1"
            >
              Register
            </Link>
          </p>
        </div>

        {/* Bottom subtle brand credit */}
      </div>
    </main>
  )
}