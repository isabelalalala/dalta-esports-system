'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { reloadTo } from '@/utils/auth';
import { useViewer } from '@/utils/use-viewer';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import Avatar from '@/components/Avatar';
import Tooltip from '@/components/Tooltip';

// Right side of the header: theme toggle for everyone; "Log in / Sign up" for visitors; Dashboard,
// notifications, your picture (-> profile) and Log out when logged in. Client-side, so the pages
// themselves can stay cached. On phones the bottom bar has Dashboard, so it is hidden here.
export default function SiteAuthButtons() {
  const viewer = useViewer();

  const handleLogout = async () => {
    await createClient().auth.signOut();
    // A full load, so no page cached while logged in can be shown afterwards (see reloadTo)
    reloadTo('/');
  };

  if (viewer.status === 'loading') {
    // Same width as the logged-out buttons, so the header doesn't jump
    return <div className="h-10 w-40" aria-hidden="true" />;
  }

  if (viewer.userId) {
    return (
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/dashboard"
          className="hidden sm:flex h-10 items-center justify-center px-4 sm:px-5 lg:px-4 xl:px-5 rounded-xl border border-amber-400 bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
        >
          Dashboard
        </Link>
        {/* key: a different user gets a fresh bell (count and Realtime channel). No Tooltip here:
            its dropdown would sit inside the hint's hover area. The bell has its own label. */}
        <NotificationBell key={viewer.userId} userId={viewer.userId} />
        <Tooltip text="My profile: name, picture, game profiles" side="bottom">
          <Link href="/profile" aria-label="My profile" className="rounded-full ring-2 ring-transparent hover:ring-gold transition-shadow">
            <Avatar url={viewer.avatarUrl} name={viewer.fullName} size="md" />
          </Link>
        </Tooltip>
        <Tooltip text="Log out" side="bottom">
          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="h-10 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold text-stone-700 hover:text-red-700 hover:bg-red-50 uppercase tracking-wider transition-colors cursor-pointer"
          >
            {/* Icon on phones and on laptop widths (1024-1279px, where the search shares the row);
                the word where there is room */}
            <LogOut className="h-5 w-5 sm:hidden lg:block xl:hidden" aria-hidden="true" />
            <span className="hidden sm:inline lg:hidden xl:inline">Log out</span>
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <Link
        href="/auth/login"
        className="h-10 flex items-center justify-center px-3 sm:px-5 rounded-xl border border-stone-200 bg-white text-stone-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-stone-50 hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-200"
      >
        Log in
      </Link>
      <Link
        href="/auth/register"
        className="h-10 flex items-center justify-center px-3 sm:px-5 rounded-xl border border-amber-400 bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
      >
        Sign up
      </Link>
    </div>
  );
}
