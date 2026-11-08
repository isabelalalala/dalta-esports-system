'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useViewer } from '@/utils/use-viewer';

const ACK_KEY = 'dalta_flag_notice_seen';

function seenThisSession() {
  try {
    return sessionStorage.getItem(ACK_KEY) === '1';
  } catch {
    return false;
  }
}

// Shown once per browser session to an account flagged at 5 warnings ("pending ban"). It blocks
// the page until acknowledged; afterwards the user can browse, but the database refuses their
// comments and feedback until an admin confirms or dismisses the ban.
export default function FlaggedAccountNotice() {
  const viewer = useViewer();
  const ref = useRef<HTMLDialogElement>(null);
  const [closed, setClosed] = useState(false);
  const show = viewer.status === 'ready' && viewer.banStatus === 'pending' && !closed;

  useEffect(() => {
    const dialog = ref.current;
    if (show && dialog && !dialog.open && !seenThisSession()) dialog.showModal();
  }, [show]);

  if (!show) return null;

  const acknowledge = () => {
    try {
      sessionStorage.setItem(ACK_KEY, '1');
    } catch {
      // Storage blocked: it shows again on the next page, which is acceptable
    }
    setClosed(true);
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="flag-title"
      aria-describedby="flag-text"
      // Esc doesn't skip it: the user has to read and acknowledge it
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-red-200 bg-white p-0 text-stone-950 shadow-xl backdrop:bg-stone-950/70"
    >
      <div className="p-5 sm:p-6 space-y-4">
        <ShieldAlert className="h-10 w-10 text-red-700" aria-hidden="true" />
        <h2 id="flag-title" className="text-lg font-black uppercase tracking-wide">Your account is flagged for a ban</h2>
        <div id="flag-text" className="space-y-2 text-base leading-relaxed text-stone-800">
          <p>
            You have {viewer.warningCount} warnings for comments or feedback that broke the{' '}
            <Link href="/conduct" className="font-bold text-maroon underline">Code of Conduct</Link>.
            An administrator will review your account and either ban it or clear your warnings.
          </p>
          <p>Until then you can still browse, but you can&apos;t comment or send feedback.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Link
            href="/profile#warnings"
            onClick={acknowledge}
            className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-center text-xs font-black uppercase tracking-widest"
          >
            See my warnings
          </Link>
          <button
            type="button"
            onClick={acknowledge}
            autoFocus
            className="px-5 py-2.5 rounded-xl bg-gold hover:bg-golddark text-stone-950 text-xs font-black uppercase tracking-widest cursor-pointer"
          >
            I understand
          </button>
        </div>
      </div>
    </dialog>
  );
}
