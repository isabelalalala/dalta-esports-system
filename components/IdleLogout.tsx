'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useViewer } from '@/utils/use-viewer';
import { reloadTo } from '@/utils/auth';
import ConfirmDialog from '@/components/ConfirmDialog';

// Admins and staff are logged out after 30 minutes without activity, with a warning 1 minute
// before (Supabase's session length is one setting for the whole project, so this shorter limit
// for organizers lives in the app). Activity in any open tab counts: the last activity time is
// shared through localStorage. Players and spectators are not affected.
const IDLE_MS = 30 * 60_000;
const WARN_MS = 60_000;
const KEY = 'dalta_last_activity';
const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'] as const;

function readLast(): number {
  try {
    return Number(localStorage.getItem(KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

export default function IdleLogout() {
  const viewer = useViewer();
  const organizer = viewer.role === 'admin' || viewer.role === 'staff';
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    if (!organizer) return;
    let last = Date.now();
    const mark = () => {
      last = Date.now();
      try {
        localStorage.setItem(KEY, String(last));
      } catch {
        // private mode: this tab alone counts
      }
    };
    mark();
    let throttle = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttle < 15_000) return; // at most every 15 s
      throttle = now;
      mark();
      setWarning(false);
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const timer = setInterval(async () => {
      const idle = Date.now() - Math.max(last, readLast());
      if (idle >= IDLE_MS) {
        clearInterval(timer);
        await createClient().auth.signOut();
        reloadTo('/auth/login?idle=1');
      } else if (idle >= IDLE_MS - WARN_MS) {
        setWarning(true);
      }
    }, 10_000);

    return () => {
      clearInterval(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [organizer]);

  if (!organizer || !warning) return null;
  return (
    <ConfirmDialog
      title="Still there?"
      confirmLabel="Stay logged in"
      onConfirm={() => {
        try {
          localStorage.setItem(KEY, String(Date.now()));
        } catch {
          // ignore
        }
        setWarning(false);
      }}
      onClose={() => setWarning(false)}
    >
      <p>For security, organizer accounts are logged out after 30 minutes without activity. You&apos;ll be logged out in about a minute.</p>
    </ConfirmDialog>
  );
}
