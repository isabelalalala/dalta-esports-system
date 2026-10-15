'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getErrorMessage } from '@/utils/errors'
import { useRouter } from 'next/navigation'

export default function Login() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0a0c' }}>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '400px', padding: '2rem', background: '#1a1a2e', borderRadius: '12px', boxShadow: '0 0 30px rgba(0, 210, 255, 0.1)' }}>
        <h1 style={{ color: '#00d2ff', marginBottom: '2rem', textAlign: 'center' }}>Login</h1>

        {error && <div style={{ background: '#ff4444', color: 'white', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: '#0a0a0c', color: 'white', border: '1px solid #00d2ff', borderRadius: '8px' }}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem', background: '#0a0a0c', color: 'white', border: '1px solid #00d2ff', borderRadius: '8px' }}
          required
        />

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '0.75rem', background: '#00d2ff', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          <a href="/auth/forgot-password" style={{ color: '#00d2ff', textDecoration: 'none' }}>Forgot password?</a>
        </p>

        <p style={{ textAlign: 'center', marginTop: '0.5rem', color: '#ccc' }}>
          Don&apos;t have an account? <a href="/auth/register" style={{ color: '#00d2ff', textDecoration: 'none' }}>Register</a>
        </p>
      </form>
    </div>
  )
}
