'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

// "Log in / Sign up" for visitors, "Dashboard" when logged in.
// Client-side, so the public pages themselves can stay cached.
export default function SiteAuthButtons() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loggedIn) {
    return (
      <Link href="/dashboard" className="px-4 py-2 border-2 border-gold bg-gold text-sitebg font-bold text-sm shadow-[3px_3px_0_var(--color-brown)] hover:translate-y-px">
        Dashboard
      </Link>
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
