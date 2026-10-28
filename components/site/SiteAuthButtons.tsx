'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import NotificationBell from '@/components/NotificationBell';

// Right side of the header: "Log in / Sign up" for visitors; Dashboard, the notification
// bell and Log out when logged in. Client-side, so the pages themselves can stay cached.
export default function SiteAuthButtons() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    // Update right away when someone logs in or out
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push('/');
  };

  if (userId) {
    return (
      <div className="flex items-center gap-2.5">
        <Link
          href="/dashboard"
          className="h-10 flex items-center justify-center px-4 sm:px-5 rounded-xl border border-amber-400 bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
        >
          Dashboard
        </Link>
        {/* key: a different user gets a fresh bell (count and Realtime channel) */}
        <NotificationBell key={userId} userId={userId} />
        <button
          onClick={handleLogout}
          className="h-10 flex items-center justify-center px-3 rounded-xl text-xs sm:text-sm font-extrabold text-stone-700 hover:text-red-700 hover:bg-red-50 uppercase tracking-wider transition-all duration-200"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Link
        href="/auth/login"
        className="h-10 flex items-center justify-center px-4 sm:px-5 rounded-xl border border-stone-200 bg-white text-stone-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-stone-50 hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-200"
      >
        Log in
      </Link>
      <Link
        href="/auth/register"
        className="h-10 flex items-center justify-center px-4 sm:px-5 rounded-xl border border-amber-400 bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs hover:bg-golddark hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
      >
        Sign up
      </Link>
    </div>
  );
}
