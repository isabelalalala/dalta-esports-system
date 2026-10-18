'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MyMatches from './MyMatches'
import LatestAnnouncements from './LatestAnnouncements'
import TeamInvites from '@/components/TeamInvites'
import NeedsAttention from './NeedsAttention'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/utils/types'
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy'
import PageLoading from '@/components/PageLoading'
import PageError from '@/components/PageError'
import { getErrorMessage } from '@/utils/errors'
import { usePageTitle } from '@/utils/page-title'
import {
  Activity, Brain, CalendarDays, ChartColumn, ClipboardList, Crown, Eye, Gamepad2,
  Globe, GraduationCap, Megaphone, MessageSquare, RadioTower, Target, Trophy, Tv, Users,
  type LucideIcon,
} from 'lucide-react'

interface DashCard {
  href: string
  title: string
  text: string
  icon: LucideIcon
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  staff: 'Tournament Staff',
  player: 'Player',
  spectator: 'Spectator',
}

const roleIcons: Record<string, LucideIcon> = {
  admin: Crown,
  staff: Gamepad2,
  player: Target,
  spectator: Eye,
}

// One badge color per role, so people can see at a glance which view they're in
const roleBadge: Record<string, string> = {
  admin: 'bg-red-400 text-black',
  staff: 'bg-gold text-black',
  player: 'bg-green-400 text-black',
  spectator: 'bg-teal-300 text-black',
}

// Shortcuts for each role. The pages check the role themselves (and RLS protects the data);
// the cards are only a convenience.
function cardsFor(role: string | undefined): DashCard[] {
  if (role === 'player') {
    return [
      { href: '/tournaments', title: 'Available Tournaments', text: 'Browse and register for tournaments', icon: ClipboardList },
      { href: '/teams', title: 'My Teams', text: 'Manage your teams and players', icon: Users },
      { href: '/registrations', title: 'My Registrations', text: 'View your tournament registrations', icon: Trophy },
      { href: '/schedule', title: 'Schedule & Results', text: 'Upcoming matches and latest results', icon: CalendarDays },
      { href: '/live', title: 'Live Streams', text: 'Watch matches live', icon: Tv },
      { href: '/feedback', title: 'Feedback', text: 'Rate the tournaments and tell us what to improve', icon: MessageSquare },
      { href: '/announcements', title: 'Announcements', text: 'News and updates from the organizers', icon: Megaphone },
    ]
  }
  if (role === 'spectator') {
    return [
      { href: '/live', title: 'Live Tournaments', text: 'Watch ongoing tournaments and matches', icon: Tv },
      { href: '/schedule', title: 'Schedule & Results', text: 'Upcoming matches, results and brackets', icon: CalendarDays },
      { href: '/announcements', title: 'Announcements', text: 'News and updates from the organizers', icon: Megaphone },
      { href: '/feedback', title: 'Feedback', text: 'Share your feedback and ratings', icon: MessageSquare },
    ]
  }
  if (role === 'admin' || role === 'staff') {
    const isAdmin = role === 'admin'
    const cards: (DashCard | false)[] = [
      { href: '/tournaments', title: 'Manage Tournaments', text: 'Create and manage tournaments', icon: ClipboardList },
      // Admin only: staff share this section but can't manage users, the website or the log
      isAdmin && { href: '/admin/users', title: 'Manage Users', text: 'Change roles, edit names and delete accounts', icon: Users },
      isAdmin && { href: '/admin/website', title: 'Website', text: 'Edit the public pages, photos, officers and teams', icon: Globe },
      isAdmin && { href: '/admin/activity', title: 'Activity Log', text: 'Who did what, and when', icon: Activity },
      { href: '/matches', title: 'Match Management', text: 'Schedule and manage matches', icon: Gamepad2 },
      { href: '/admin/verification', title: 'Student Verification', text: "Verify players' student details", icon: GraduationCap },
      { href: '/live', title: 'Live Streams', text: 'Watch streams; configure them from each tournament', icon: RadioTower },
      // Admin only: feedback and sentiment are for the Organizing Committee
      isAdmin && { href: '/admin/feedback', title: 'Feedback Analysis', text: 'Sentiment of audience and player feedback', icon: Brain },
      {
        href: '/announcements',
        title: 'Announcements',
        text: isAdmin ? 'Post and manage announcements' : 'Read the latest announcements',
        icon: Megaphone,
      },
      {
        href: '/analytics',
        title: 'Analytics',
        text: isAdmin ? 'Generate activity, sentiment and engagement reports' : 'Viewership and audience engagement stats',
        icon: ChartColumn,
      },
    ]
    return cards.filter((c): c is DashCard => !!c)
  }
  return []
}

export default function Dashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const router = useRouter()
  usePageTitle('Dashboard')

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        router.push('/auth/login')
        return
      }

      setUser(data.session.user)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single()

      // Without the profile we don't know the role, so the dashboard would be empty
      if (profileError || !profileData) {
        setLoadError(getErrorMessage(profileError, 'Your profile could not be loaded.'))
        setLoading(false)
        return
      }

      // Data Privacy Act: users who haven't agreed to the current Privacy Notice
      // (older or admin-added accounts, or the notice changed) are asked first.
      if ((!profileData.privacy_consent_at || profileData.privacy_consent_version !== PRIVACY_NOTICE_VERSION)) {
        router.replace('/privacy/consent')
        return
      }

      setProfile(profileData)
      setLoading(false)
    }

    getUser()
  }, [router, supabase])

  if (loading) {
    return <PageLoading />
  }

  if (loadError) return <PageError message={loadError} backHref="/" backLabel="Home" />

  const role = profile?.role
  const isOrganizer = role === 'admin' || role === 'staff'
  const RoleIcon = roleIcons[role ?? '']

  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-white px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Dashboard</h1>
          <Link href="/profile" className="px-4 py-2 border-2 border-gold text-gold font-bold hover:bg-gold/10">
            My Profile
          </Link>
        </div>

        {/* Welcome, with the role */}
        <div className="bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6 flex flex-wrap justify-between items-center gap-4">
          <p className="text-lg">
            {/* Older accounts may not have a name yet, so fall back to the email */}
            Welcome, <span className="text-gold font-semibold">{profile?.full_name || user?.email}</span>
          </p>
          <span className={`px-4 py-2 font-bold inline-flex items-center gap-2 ${roleBadge[role ?? ''] ?? 'bg-gold text-black'}`}>
            {RoleIcon && <RoleIcon className="h-4 w-4" />}
            {roleLabels[role ?? ''] ?? 'User'}
          </span>
        </div>

        {/* Open team invites (shows nothing when there are none) */}
        {role === 'player' && <TeamInvites />}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cardsFor(role).map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-sitecard border-2 border-brownlight p-5 shadow-[4px_4px_0_var(--color-brown)] hover:border-gold transition-colors"
            >
              <h3 className="font-bold text-gold mb-2 flex items-center gap-2"><card.icon className="h-4 w-4 shrink-0" />{card.title}</h3>
              <p className="text-gray-400 text-sm">{card.text}</p>
            </Link>
          ))}
        </div>

        {role === 'player' && user && <MyMatches userId={user.id} />}

        {isOrganizer && <NeedsAttention />}

        {/* Shown for every role */}
        <LatestAnnouncements />
      </div>
    </main>
  )
}
