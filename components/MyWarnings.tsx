'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useViewer } from '@/utils/use-viewer';
import { formatDateTime } from '@/utils/tournaments';
import SectionHint from '@/components/SectionHint';
import { WARNING_LIMIT } from '@/utils/moderation-rules';

interface Warning {
  id: string;
  source: string;
  type: string;
  reason: string;
  created_at: string;
  removed_at: string | null;
  removal_reason: string | null;
}


// "Warnings" on /profile (#warnings): the user's current count out of 5 and their history.
// Users read only their own warnings (RLS); admins see everyone's on /admin/moderation.
export default function MyWarnings({ userId }: { userId: string }) {
  const supabase = createClient();
  const viewer = useViewer();
  const [warnings, setWarnings] = useState<Warning[] | null>(null);

  useEffect(() => {
    supabase
      .from('user_warnings')
      .select('id, source, type, reason, created_at, removed_at, removal_reason')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => setWarnings(error ? [] : ((data ?? []) as Warning[])));
    // viewer.warningCount changes when a new warning arrives (notification): reload then
  }, [supabase, userId, viewer.warningCount]);

  const active = (warnings ?? []).filter((w) => !w.removed_at);

  return (
    <section id="warnings" className="scroll-mt-28 bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4" aria-labelledby="warnings-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="warnings-title" className="text-lg sm:text-xl font-black text-stone-950 tracking-wider flex items-center gap-1.5">
          Warnings
          <SectionHint text="Comments and feedback are checked automatically. Profanity gives 1 warning; bullying, hate or threats are hidden and give 1 warning. At 5 warnings an admin reviews your account." />
        </h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black ${
          active.length === 0 ? 'bg-emerald-50 text-emerald-800' : active.length >= WARNING_LIMIT ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'
        }`}>
          {active.length === 0 ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {active.length} of {WARNING_LIMIT}
        </span>
      </div>

      {viewer.banStatus === 'pending' && (
        <p role="status" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
          Your account is flagged for a ban and waits for an admin. Until then you can&apos;t comment or send feedback.
        </p>
      )}

      {warnings === null ? (
        <p className="text-stone-600">Loading...</p>
      ) : warnings.length === 0 ? (
        <p className="text-stone-600">No warnings. Thanks for keeping DALTA friendly!</p>
      ) : (
        <ul className="space-y-2">
          {warnings.map((w) => (
            <li key={w.id} className={`rounded-xl border p-3 text-sm ${w.removed_at ? 'border-stone-200 bg-stone-50 text-stone-600' : 'border-yellow-300 bg-yellow-50 text-stone-900'}`}>
              <p className="flex flex-wrap gap-x-2 font-black">
                <span>{w.type === 'offensive' ? 'Offensive content' : 'Profanity'}</span>
                <span className="font-semibold text-stone-600">in a {w.source} · {formatDateTime(w.created_at)}</span>
                {w.removed_at && <span className="font-semibold">· removed</span>}
              </p>
              {w.reason && <p className="mt-0.5 break-words">{w.reason}</p>}
              {w.removed_at && w.removal_reason && <p className="mt-0.5 text-xs break-words">Removed: {w.removal_reason}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-stone-600">
        See the <Link href="/conduct" className="font-bold text-maroon underline">Code of Conduct</Link>. If you think a warning is a
        mistake, contact the organizers.
      </p>
    </section>
  );
}
