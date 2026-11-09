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
import NextMatchCard from './NextMatchCard';
import MyTeamsSummary from './MyTeamsSummary';
import LiveNowCard from './LiveNowCard';
import QuickTour from '@/components/QuickTour';
import Tooltip from '@/components/Tooltip';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/utils/types';
import { PRIVACY_NOTICE_VERSION } from '@/utils/privacy';
import PageLoading from '@/components/PageLoading';
import PageError from '@/components/PageError';
import { getErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/utils/page-title';
import { can, isOrganizer } from '@/utils/permissions';
import {
  Activity, Brain, CalendarDays, ChartColumn, ClipboardList,
  Crown, Eye, Gamepad2, Globe, GraduationCap, Megaphone, MessageSquare, RadioTower,
  Shield, Target, Trophy, Tv, Users, type LucideIcon, LifeBuoy } from 'lucide-react';

interface DashCard {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
}

// The first cards of each role's list are its most common tasks
const TOP_CARDS = 4;

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

// Shortcuts for each role, picked by permission (utils/permissions.ts). The pages check the
// role themselves (and RLS protects the data); the cards are only a convenience.
function cardsFor(role: string | undefined): DashCard[] {
  return [...roleCards(role), HELP_CARD];
}

const HELP_CARD: DashCard = { href: '/help', title: 'Help & FAQ', text: 'How teams, streams, feedback and warnings work', icon: LifeBuoy };

function roleCards(role: string | undefined): DashCard[] {
  if (can(role, 'team.join')) {
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
  if (!isOrganizer(role)) {
    return [
      { href: '/live', title: 'Live Tournaments', text: 'Watch ongoing tournaments and matches', icon: Tv },
      { href: '/schedule', title: 'Schedule & Results', text: 'Upcoming matches, results and brackets', icon: CalendarDays },
      { href: '/announcements', title: 'Announcements', text: 'News and updates from the organizers', icon: Megaphone },
      { href: '/feedback', title: 'Feedback', text: 'Share your feedback and ratings', icon: MessageSquare },
    ];
  }
  // Admin and staff share most tools; the first four (the cards) are each role's most common tasks
  const tournaments = { href: '/tournaments', title: 'Manage Tournaments', text: 'Create and manage tournaments', icon: ClipboardList };
  const teams = { href: '/admin/teams', title: 'Teams', text: 'Every team, roster and join request; remove teams', icon: Shield };
  const matches = { href: '/matches', title: 'Match Control', text: 'Schedule matches, check-ins, results and forfeits', icon: Gamepad2 };
  const streams = { href: '/live', title: 'Live Streams', text: 'Watch streams; configure them from each tournament', icon: RadioTower };
  const verification = { href: '/admin/verification', title: 'Student Verification', text: "Verify players' student details", icon: GraduationCap };
  const announcements = {
    href: '/announcements',
    title: 'Announcements',
    text: can(role, 'announcement.post') ? 'Post and manage announcements' : 'Read the latest announcements',
    icon: Megaphone,
  };
  const analytics = {
    href: '/analytics',
    title: can(role, 'report.generate') ? 'Reports' : 'Engagement Stats',
    text: can(role, 'report.generate') ? 'Generate activity, sentiment and engagement reports' : 'Viewership and audience engagement stats',
    icon: ChartColumn,
  };

  if (!can(role, 'user.manage')) {
    return [matches, streams, tournaments, teams, verification, announcements, analytics];
  }
  return [
    tournaments, teams,
    { href: '/admin/users', title: 'Manage Users', text: 'Change roles, edit names and delete accounts', icon: Users },
    analytics, announcements,
    { href: '/admin/feedback', title: 'Feedback & Sentiment', text: 'Sentiment of audience and player feedback', icon: Brain },
    matches, streams, verification,
    { href: '/admin/website', title: 'Website', text: 'Edit the public pages, photos, officers and teams', icon: Globe },
    { href: '/admin/activity', title: 'Activity Log', text: 'Who did what, and when', icon: Activity },
  ];
}

export default function Dashboard() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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

      setProfile(profileData as Profile);
      setLoading(false);
    };

    getUser();
  }, [router, supabase]);

  if (loading) {
    return <PageLoading variant="dashboard" label="Loading dashboard..." />;
  }

  if (loadError) return <PageError message={loadError} backHref="/" backLabel="Home" />;

  const role = profile?.role;
  const RoleIcon = roleIcons[role ?? ''];

  const allCards = cardsFor(role);
  const topCards = allCards.slice(0, TOP_CARDS);
  const moreCards = allCards.slice(TOP_CARDS);

  return (
    // Full width like the other sections (the layout's padding is the only side space)
    <div className="w-full space-y-8 sm:space-y-10">
      {/* 1. Main Welcome Hero Container with Official Banner */}
      <section className="relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-12 @5xl:p-14 text-white flex flex-col @3xl:flex-row @3xl:items-center justify-between gap-6 animate-hero-entrance">
        <PageHeroBackground
          specificKey="dashboard_hero_bg_path"
          alt="DALTA Esports Portal Banner"
          overlayClassName="absolute inset-0 bg-stone-950/80"
        />

        <div className="relative z-10 space-y-3 max-w-prose">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-black tracking-widest uppercase inline-flex items-center gap-1.5 backdrop-blur-xs">
              {RoleIcon && <RoleIcon className="h-3.5 w-3.5 text-gold" />}
              <span>{roleLabels[role ?? ''] ?? 'User'}</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-gold/20 border border-gold/30 text-gold text-xs font-black tracking-widest uppercase">
              Official Portal
            </span>
          </div>

          <h1
            className="text-display font-black tracking-wider uppercase leading-tight animate-hero-title text-white"
          >
            Welcome, <span className="text-gold">{profile?.full_name || user?.email}</span>
          </h1>

          <p
            className="text-xs sm:text-sm font-medium leading-relaxed animate-hero-tagline text-stone-200"
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

      {/* First login: a short, skippable tour (never shown again once dismissed) */}
      <QuickTour />

      {/* 2. Open Team Invites */}
      {can(role, 'team.join') && <div className="animate-stagger-1"><TeamInvites /></div>}

      {/* 3. Quick actions: the role's 4 most common tasks as cards, then every other tool. All
          visible at once (the old carousel hid most actions behind arrows). */}
      <section className="space-y-4 animate-stagger-1" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="text-xl sm:text-2xl font-black text-stone-950 tracking-wider">
          Quick Actions
        </h2>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4 sm:gap-6">
          {topCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center mb-4 group-hover:bg-gold group-hover:text-stone-950 group-hover:border-gold transition-colors">
                  <card.icon className="h-6 w-6 shrink-0" />
                </div>
                <h3 className="font-black text-stone-950 text-base sm:text-lg tracking-wide uppercase group-hover:text-amber-700 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed mt-2">{card.text}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-black text-amber-700 uppercase tracking-wider">
                <span>Open</span>
                <span className="group-hover:translate-x-1 transition-transform motion-reduce:transform-none">→</span>
              </div>
            </Link>
          ))}
        </div>

        {moreCards.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
            {moreCards.map((card) => (
              <Tooltip key={card.href} text={card.text} className="flex w-full">
                <Link
                  href={card.href}
                  className="group w-full flex items-center gap-3 rounded-xl border border-stone-200/90 bg-white px-4 py-3 shadow-2xs hover:border-amber-500/50 hover:bg-stone-50 transition-colors"
                >
                  <card.icon className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                  <span className="font-black text-sm uppercase tracking-wide text-stone-950 group-hover:text-amber-700">{card.title}</span>
                </Link>
              </Tooltip>
            ))}
          </div>
        )}
      </section>

      {/* 4. Two columns on wide screens: matches, attention list and announcements on the left
          (wider); next match, my teams and live now in a side column on the right */}
      <div className="grid grid-cols-1 @5xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)] gap-6 sm:gap-8 items-start">
        <div className="min-w-0 space-y-6 sm:space-y-8">
          {can(role, 'team.join') && user && (
            <div className="animate-stagger-2">
              <MyMatches userId={user.id} />
            </div>
          )}
          {can(role, 'match.manage') && (
            <div className="animate-stagger-2">
              <NeedsAttention />
            </div>
          )}
          <div className="animate-stagger-3">
            <LatestAnnouncements />
          </div>
        </div>

        <aside className="min-w-0 space-y-6 animate-stagger-2" aria-label="At a glance">
          {can(role, 'team.join') && user && <NextMatchCard userId={user.id} />}
          {can(role, 'team.join') && <MyTeamsSummary />}
          <LiveNowCard />
        </aside>
      </div>
    </div>
  );
}
