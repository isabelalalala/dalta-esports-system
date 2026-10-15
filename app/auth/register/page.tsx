'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getErrorMessage } from '@/utils/errors'
import { useRouter } from 'next/navigation'

export default function Register() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('player')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminCode, setAdminCode] = useState('')
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

  // Only allow admin/staff with a special code
  if ((role === 'admin' || role === 'staff') && !adminCode) {
    setError('Admin/Staff registration requires an access code')
    setLoading(false)
    return
  }

  if ((role === 'admin' || role === 'staff') && adminCode !== 'DALTA2025') {
    setError('Invalid access code')
    setLoading(false)
    return
  }

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
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
        {(role === 'admin' || role === 'staff') && (
  <>
    <label style={{ color: '#aaa', display: 'block', marginBottom: '0.5rem' }}>Access Code</label>
    <input
      type="password"
      placeholder="Enter access code"
      value={adminCode}
      onChange={(e) => setAdminCode(e.target.value)}
      style={{
        width: '100%',
        padding: '0.75rem',
        marginBottom: '1rem',
        background: '#0a0a0c',
        color: 'white',
        border: '1px solid #ff6b6b',
        borderRadius: '8px',
      }}
      required
    />
  </>
)}

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
  <option value="staff">Tournament Staff</option>
  <option value="admin">Administrator</option>
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
