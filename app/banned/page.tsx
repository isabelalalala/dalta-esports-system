'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { reloadTo } from '@/utils/auth';
import { usePageTitle } from '@/utils/page-title';

// Where proxy.ts sends banned accounts. Public (not in proxy.ts): it has to load for them.
export default function BannedPage() {
  usePageTitle('Account banned');
  const [state, setState] = useState<'loading' | 'banned' | 'ok'>('loading');
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return setState('ok');
      // Everyone can read their own profile row
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
      const row = profile as { ban_status?: string; ban_reason?: string | null } | null;
      if (row?.ban_status === 'banned') {
        setReason(row.ban_reason ?? null);
        setState('banned');
      } else {
        setState('ok');
      }
    });
  }, []);

  const logOut = async () => {
    await createClient().auth.signOut();
    reloadTo('/');
  };

  return (
    <main id="main-content" className="flex-1 w-full bg-white text-stone-950 px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-4 text-center">
        {state === 'loading' ? (
          <p className="text-stone-600">Checking your account...</p>
        ) : state === 'banned' ? (
          <>
            <Ban className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
            <h1 className="text-2xl font-black uppercase tracking-wide">Your account is banned</h1>
            <p className="text-base leading-relaxed text-stone-800">
              An administrator banned this account for breaking the{' '}
              <Link href="/conduct" className="font-bold text-maroon underline">Code of Conduct</Link>.
            </p>
            {reason && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-800 break-words">
                <span className="font-black">Reason:</span> {reason}
              </p>
            )}
            <p className="text-sm text-stone-600">
              If you think this is a mistake, contact the DALTA Esports organizers (see the{' '}
              <Link href="/privacy" className="underline">Privacy Notice</Link> for the contact).
            </p>
            <button
              type="button"
              onClick={logOut}
              className="px-5 py-2.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 text-xs font-black uppercase tracking-widest cursor-pointer"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black uppercase tracking-wide">Your account isn&apos;t banned</h1>
            <Link href="/dashboard" className="inline-block font-bold text-maroon underline">Go to your dashboard</Link>
          </>
        )}
      </div>
    </main>
  );
}
