'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import MyMatches from './MyMatches';
import LatestAnnouncements from './LatestAnnouncements';
import TeamInvites from '@/components/TeamInvites';
import NeedsAttention from './NeedsAttention';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/utils/types';
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { getErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/utils/page-title';
import {
  Activity, Brain, CalendarDays, ChartColumn, ChevronLeft, ChevronRight, ClipboardList,
  Crown, Eye, Gamepad2, Globe, GraduationCap, Megaphone, MessageSquare, RadioTower,
  Target, Trophy, Tv, Users, type LucideIcon,
} from 'lucide-react';

interface DashCard {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
}

const PAGE_SIZE = 4;

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  staff: 'Tournament Staff',
  player: 'Player',
  spectator: 'Spectator',
};

const roleIcons: Record<string, LucideIcon> = {
  admin: Crown,
  staff: Gamepad2,
  player: Target,
  spectator: Eye,
};

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
    ];
  }
  if (role === 'spectator') {
    return [
      { href: '/live', title: 'Live Tournaments', text: 'Watch ongoing tournaments and matches', icon: Tv },
      { href: '/schedule', title: 'Schedule & Results', text: 'Upcoming matches, results and brackets', icon: CalendarDays },
      { href: '/announcements', title: 'Announcements', text: 'News and updates from the organizers', icon: Megaphone },
      { href: '/feedback', title: 'Feedback', text: 'Share your feedback and ratings', icon: MessageSquare },
    ];
  }
  if (role === 'admin' || role === 'staff') {
    const isAdmin = role === 'admin';
    const cards: (DashCard | false)[] = [
      { href: '/tournaments', title: 'Manage Tournaments', text: 'Create and manage tournaments', icon: ClipboardList },
      isAdmin && { href: '/admin/users', title: 'Manage Users', text: 'Change roles, edit names and delete accounts', icon: Users },
      isAdmin && { href: '/admin/website', title: 'Website', text: 'Edit the public pages, photos, officers and teams', icon: Globe },
      isAdmin && { href: '/admin/activity', title: 'Activity Log', text: 'Who did what, and when', icon: Activity },
      { href: '/matches', title: 'Match Management', text: 'Schedule and manage matches', icon: Gamepad2 },
      { href: '/admin/verification', title: 'Student Verification', text: "Verify players' student details", icon: GraduationCap },
      { href: '/live', title: 'Live Streams', text: 'Watch streams; configure them from each tournament', icon: RadioTower },
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
    ];
    return cards.filter((c): c is DashCard => !!c);
  }
  return [];
}

export default function Dashboard() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const router = useRouter();
  usePageTitle('Dashboard');

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      setUser(data.session.user);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profileError || !profileData) {
        setLoadError(getErrorMessage(profileError, 'Your profile could not be loaded.'));
        setLoading(false);
        return;
      }

      if (!profileData.privacy_consent_at || profileData.privacy_consent_version !== PRIVACY_NOTICE_VERSION) {
        router.replace('/privacy/consent');
        return;
      }

      setProfile(profileData);
      setLoading(false);
    };

    getUser();
  }, [router, supabase]);

  if (loading) {
    return <PageLoading variant="dashboard" label="Loading dashboard..." />;
  }

  if (loadError) return <PageError message={loadError} backHref="/" backLabel="Home" />;

  const role = profile?.role;
  const isOrganizer = role === 'admin' || role === 'staff';
  const RoleIcon = roleIcons[role ?? ''];

  const allCards = cardsFor(role);
  const totalPages = Math.ceil(allCards.length / PAGE_SIZE) || 1;
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleCards = allCards.slice(safePageIndex * PAGE_SIZE, (safePageIndex + 1) * PAGE_SIZE);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 sm:space-y-10 uppercase">
      {/* 1. Main Welcome Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 lg:p-14 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 animate-hero-entrance">
        <PageHeroBackground
          specificKey="dashboard_hero_bg_path"
          alt="DALTA Esports Portal Banner"
          overlayClassName="absolute inset-0 bg-stone-950/80"
        />

        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-black tracking-widest uppercase inline-flex items-center gap-1.5 backdrop-blur-xs">
              {RoleIcon && <RoleIcon className="h-3.5 w-3.5 text-[#FFCC37]" />}
              <span>{roleLabels[role ?? ''] ?? 'User'}</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-[#FFCC37]/20 border border-[#FFCC37]/30 text-[#FFCC37] text-xs font-black tracking-widest uppercase">
              Official Portal
            </span>
          </div>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black !text-white text-white tracking-wider uppercase leading-tight animate-hero-title"
            style={{ color: '#ffffff' }}
          >
            Welcome, <span style={{ color: '#FFCC37' }}>{profile?.full_name || user?.email}</span>
          </h1>

          <p
            className="text-xs sm:text-sm !text-stone-200 text-stone-200 font-medium tracking-wide uppercase leading-relaxed animate-hero-tagline"
            style={{ color: '#e7e5e4' }}
          >
            DALTA Esports System · Collegiate Tournament Operations, Team Rosters, and Match Schedules.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gold text-stone-950 font-black text-xs uppercase tracking-wider border border-amber-400 shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all"
          >
            <Target className="h-4 w-4 text-stone-950" />
            <span>My Profile</span>
          </Link>
        </div>
      </section>

      {/* 2. Open Team Invites */}
      {role === 'player' && <div className="animate-stagger-1"><TeamInvites /></div>}

      {/* 3. Action Shortcuts Carousel (4 Services per view with Left & Right Arrow controls) */}
      <section className="space-y-4 animate-stagger-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider">
              Quick Actions
            </h2>
          </div>

          <div className="relative w-full">
            {/* Left Arrow Button */}
            {totalPages > 1 && (
              <button
                type="button"
                onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={safePageIndex === 0}
                aria-label="Previous services"
                className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-stone-200/90 text-stone-900 shadow-md hover:shadow-lg hover:bg-stone-50 hover:border-amber-500/60 hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}

            {/* 4 Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 min-h-[240px]">
              {visibleCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center mb-4 group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500 transition-all duration-200">
                      <card.icon className="h-6 w-6 shrink-0" />
                    </div>
                    <h3 className="font-black text-stone-950 text-base sm:text-lg tracking-wide uppercase group-hover:text-amber-700 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-600 font-medium tracking-wide leading-relaxed mt-2 uppercase">
                      {card.text}
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-black text-amber-700 uppercase tracking-wider">
                    <span>Explore</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Right Arrow Button */}
            {totalPages > 1 && (
              <button
                type="button"
                onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={safePageIndex >= totalPages - 1}
                aria-label="Next services"
                className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-stone-200/90 text-stone-900 shadow-md hover:shadow-lg hover:bg-stone-50 hover:border-amber-500/60 hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}
          </div>

          {/* Pagination indicator dots */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-1" aria-label="Quick action pagination">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPageIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === safePageIndex}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    i === safePageIndex ? 'w-8 bg-amber-500' : 'w-2 bg-stone-300 hover:bg-stone-400'
                  }`}
                />
              ))}
            </div>
          )}
        </section>

        {/* 4. Player Upcoming Matches */}
        {role === 'player' && user && (
          <div className="animate-stagger-2">
            <MyMatches userId={user.id} />
          </div>
        )}

        {/* 5. Organizer Needs Attention */}
        {isOrganizer && (
          <div className="animate-stagger-2">
            <NeedsAttention />
          </div>
        )}

        {/* 6. Organization Latest Announcements */}
        <div className="animate-stagger-3">
          <LatestAnnouncements />
        </div>
    </div>
  );
}
