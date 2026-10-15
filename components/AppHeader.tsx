'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import NotificationBell from './NotificationBell';

// The public website has its own header (app/(site)/layout.tsx)
const SITE_PATHS = ['/about', '/campaigns', '/events', '/divisions', '/community', '/search', '/t'];

function isSitePage(path: string) {
  return path === '/' || SITE_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

// Slim bar at the top of every app page while logged in (added in app/layout.tsx).
// Logged-out visitors and the public website don't show it. Hidden when printing reports.
export default function AppHeader() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));

    // Show/hide right away when someone logs in or out
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!userId || isSitePage(pathname)) return null;

  return (
    <header className="bg-[#0a0a0c] border-b border-[#00d2ff]/20 px-4 py-2 print:hidden">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-[#00d2ff] tracking-wide">DALTA Esports</Link>
        {/* key: a different user gets a fresh bell (count and Realtime channel) */}
        <NotificationBell key={userId} userId={userId} />
      </div>
    </header>
  );
}
