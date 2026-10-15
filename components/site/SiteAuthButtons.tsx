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
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="px-4 py-2 border-2 border-gold bg-gold text-sitebg font-bold text-sm shadow-[3px_3px_0_var(--color-brown)] hover:translate-y-px">
          Dashboard
        </Link>
        {/* key: a different user gets a fresh bell (count and Realtime channel) */}
        <NotificationBell key={userId} userId={userId} />
        <button onClick={handleLogout} className="px-3 py-2 text-sm font-bold text-gray-300 hover:text-gold">
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Link href="/auth/login" className="px-4 py-2 border-2 border-gold text-gold font-bold text-sm hover:bg-gold/10">
        Log in
      </Link>
      <Link href="/auth/register" className="px-4 py-2 border-2 border-gold bg-gold text-sitebg font-bold text-sm shadow-[3px_3px_0_var(--color-brown)] hover:translate-y-px">
        Sign up
      </Link>
    </div>
  );
}
