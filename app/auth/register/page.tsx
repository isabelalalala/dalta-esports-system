'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getErrorMessage } from '@/utils/errors'
import { useRouter } from 'next/navigation'

export default function Register() {
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('player')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault()
  setError('')
  setLoading(true)

  if (password !== confirmPassword) {
    setError('Passwords do not match')
    setLoading(false)
    return
  }

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The database trigger handle_new_user() creates the profile from this data.
        // It only accepts 'player'; any other role is saved as 'spectator'.
        // Admin and staff roles are given by an administrator, never at sign-up.
        data: {
          full_name: fullName.trim(),
          role,
        },
      },
    })

    if (error) throw error

    alert('Check your email to confirm your account!')
    router.push('/auth/login')
  } catch (err) {
    setError(getErrorMessage(err, 'Registration failed'))
  } finally {
    setLoading(false)
  }
}


  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0a0c' }}>
      <form
        onSubmit={handleRegister}
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          background: '#1a1a2e',
          borderRadius: '12px',
          boxShadow: '0 0 30px rgba(0, 210, 255, 0.1)',
        }}
      >
        <h1 style={{ color: '#00d2ff', marginBottom: '2rem', textAlign: 'center' }}>Register</h1>

        {error && (
          <div
            style={{
              background: '#ff4444',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#0a0a0c',
            color: 'white',
            border: '1px solid #00d2ff',
            borderRadius: '8px',
          }}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#0a0a0c',
            color: 'white',
            border: '1px solid #00d2ff',
            borderRadius: '8px',
          }}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#0a0a0c',
            color: 'white',
            border: '1px solid #00d2ff',
            borderRadius: '8px',
          }}
          required
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#0a0a0c',
            color: 'white',
            border: '1px solid #00d2ff',
            borderRadius: '8px',
          }}
          required
        />

        <label style={{ color: '#aaa', display: 'block', marginBottom: '0.5rem' }}>I am a:</label>
<select
  value={role}
  onChange={(e) => setRole(e.target.value)}
  style={{
    width: '100%',
    padding: '0.75rem',
    marginBottom: '1.5rem',
    background: '#0a0a0c',
    color: 'white',
    border: '1px solid #00d2ff',
    borderRadius: '8px',
  }}
>
  <option value="player">Player</option>
  <option value="spectator">Audience / Spectator</option>
</select>


        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#00d2ff',
            color: '#000',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1rem', color: '#ccc' }}>
          Already have an account?{' '}
          <a href="/auth/login" style={{ color: '#00d2ff', textDecoration: 'none' }}>
            Login
          </a>
        </p>
      </form>
    </div>
  )
}
