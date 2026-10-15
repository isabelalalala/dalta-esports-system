'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MyMatches from './MyMatches'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/utils/types'

export default function Dashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        router.push('/auth/login')
        return
      }

      setUser(data.session.user)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single()

      setProfile(profileData)
      setLoading(false)
    }

    getUser()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div style={{ color: 'white', textAlign: 'center', paddingTop: '2rem' }}>
        Loading...
      </div>
    )
  }

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return '#ff6b6b'
      case 'staff':
        return '#ffd93d'
      case 'player':
        return '#6bcf7f'
      case 'spectator':
        return '#4ecdc4'
      default:
        return '#00d2ff'
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return '👑 Administrator'
      case 'staff':
        return '🎮 Tournament Staff'
      case 'player':
        return '🎯 Player'
      case 'spectator':
        return '👀 Spectator'
      default:
        return 'User'
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', color: 'white', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', color: '#00d2ff' }}>DALTA ESPORTS Dashboard</h1>
          {/* Shown for every role */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link
              href="/profile"
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #00d2ff',
                color: '#00d2ff',
                borderRadius: '8px',
                fontWeight: 'bold',
                textDecoration: 'none',
              }}
            >
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div
          style={{
            background: '#1a1a2e',
            padding: '2rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            border: `2px solid ${getRoleColor(profile?.role)}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                {/* Older accounts may not have a name yet, so fall back to the email */}
                Welcome, <span style={{ color: '#00d2ff' }}>{profile?.full_name || user?.email}</span>
              </p>
            </div>

            <div
              style={{
                background: getRoleColor(profile?.role),
                color: '#000',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              {getRoleLabel(profile?.role)}
            </div>
          </div>
        </div>

        {profile?.role === 'player' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <Link href="/tournaments" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #00d2ff', cursor: 'pointer' }}>
                <h3 style={{ color: '#00d2ff', marginBottom: '1rem' }}>📋 Available Tournaments</h3>
                <p style={{ color: '#aaa' }}>Browse and register for tournaments</p>
              </div>
            </Link>

            <Link href="/teams" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #00d2ff', cursor: 'pointer' }}>
                <h3 style={{ color: '#00d2ff', marginBottom: '1rem' }}>👥 My Teams</h3>
                <p style={{ color: '#aaa' }}>Manage your teams and players</p>
              </div>
            </Link>

            <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #00d2ff' }}>
              <h3 style={{ color: '#00d2ff', marginBottom: '1rem' }}>🏆 My Registrations</h3>
              <p style={{ color: '#aaa' }}>View your tournament registrations</p>
            </div>
          </div>
        )}

        {profile?.role === 'player' && user && <MyMatches userId={user.id} />}

        {profile?.role === 'spectator' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4ecdc4' }}>
              <h3 style={{ color: '#4ecdc4', marginBottom: '1rem' }}>📺 Live Tournaments</h3>
              <p style={{ color: '#aaa' }}>Watch ongoing tournaments and matches</p>
            </div>

            <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4ecdc4' }}>
              <h3 style={{ color: '#4ecdc4', marginBottom: '1rem' }}>🏆 Standings</h3>
              <p style={{ color: '#aaa' }}>View tournament standings and results</p>
            </div>

            <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4ecdc4' }}>
              <h3 style={{ color: '#4ecdc4', marginBottom: '1rem' }}>💬 Feedback</h3>
              <p style={{ color: '#aaa' }}>Share your feedback and sentiments</p>
            </div>
          </div>
        )}

        {(profile?.role === 'admin' || profile?.role === 'staff') && (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
    <Link href="/tournaments" style={{ textDecoration: 'none' }}>
      <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #ffd93d', cursor: 'pointer' }}>
        <h3 style={{ color: '#ffd93d', marginBottom: '1rem' }}>📋 Manage Tournaments</h3>
        <p style={{ color: '#aaa' }}>Create and manage tournaments</p>
      </div>
    </Link>

    <Link href="/players" style={{ textDecoration: 'none' }}>
      <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #ffd93d', cursor: 'pointer' }}>
        <h3 style={{ color: '#ffd93d', marginBottom: '1rem' }}>👥 Manage Players</h3>
        <p style={{ color: '#aaa' }}>View and manage player registrations</p>
      </div>
    </Link>

    <Link href="/matches" style={{ textDecoration: 'none' }}>
      <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #ffd93d', cursor: 'pointer' }}>
        <h3 style={{ color: '#ffd93d', marginBottom: '1rem' }}>🎮 Match Management</h3>
        <p style={{ color: '#aaa' }}>Schedule and manage matches</p>
      </div>
    </Link>

    <Link href="/analytics" style={{ textDecoration: 'none' }}>
      <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', border: '1px solid #ffd93d', cursor: 'pointer' }}>
        <h3 style={{ color: '#ffd93d', marginBottom: '1rem' }}>📊 Analytics</h3>
        <p style={{ color: '#aaa' }}>View reports and analytics</p>
      </div>
    </Link>
  </div>
)}

      </div>
    </div>
  )
}
