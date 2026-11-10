'use client';

import Link from 'next/link';
import { useViewer } from '@/utils/use-viewer';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import AccountMenu from './AccountMenu';

// Right side of the header: theme toggle for everyone; "Log in / Sign up" for visitors; Dashboard,
// notifications and the avatar menu (profile, Log out) when logged in. Client-side, so the pages
// themselves can stay cached. On phones the bottom bar has Dashboard, so it is hidden here.
export default function SiteAuthButtons() {
  const viewer = useViewer();

  if (viewer.status === 'loading') {
    // Exactly the size of the logged-out buttons (theme + Log in + Sign up: 217px on phones, 266px
    // from sm), so the header doesn't wrap differently and push the page down when they appear
    return <div className="h-11 w-[217px] sm:w-[266px]" aria-hidden="true" />;
  }

  if (viewer.userId) {
    return (
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/dashboard"
          className="hidden sm:flex h-11 items-center justify-center px-4 sm:px-5 lg:px-4 xl:px-5 rounded-xl border border-amber-400 bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
        >
          Dashboard
        </Link>
        {/* key: a different user gets a fresh bell (count and Realtime channel). No Tooltip here:
            its dropdown would sit inside the hint's hover area. The bell has its own label. */}
        <NotificationBell key={viewer.userId} userId={viewer.userId} />
        {/* Avatar menu: profile, notifications and a labelled Log out (with confirmation on phones) */}
        <AccountMenu fullName={viewer.fullName} avatarUrl={viewer.avatarUrl} role={viewer.role} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <Link
        href="/auth/login"
        className="h-11 flex items-center justify-center px-3 sm:px-5 rounded-xl border border-stone-200 bg-white text-stone-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-stone-50 hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-200"
      >
        Log in
      </Link>
      <Link
        href="/auth/register"
        className="h-11 flex items-center justify-center px-3 sm:px-5 rounded-xl border border-amber-400 bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
      >
        Sign up
      </Link>
    </div>
  );
}
