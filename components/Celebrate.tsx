'use client';

import { useEffect, useState } from 'react';
import ConfettiBurst from '@/components/ConfettiBurst';
import { toast } from '@/components/Toaster';

// A small one-time celebration (confetti burst + a short message) for good news the person hasn't
// seen yet: their registration was approved, their team won a match. "Seen" is remembered per
// device (localStorage), so it plays once, not on every visit. Put it inside a `relative` box.
// The confetti is hidden with reduced motion (CSS); the message still shows.
export default function Celebrate({ storageKey, message }: { storageKey: string; message: string }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const key = `dalta_celebrated:${storageKey}`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === '1';
      if (!seen) localStorage.setItem(key, '1');
    } catch {
      seen = true; // no storage (private mode): don't celebrate on every load
    }
    if (seen) return;
    // A moment after the page appears, so it's noticed
    const timer = setTimeout(() => {
      setPlay(true);
      toast.success(message);
    }, 400);
    return () => clearTimeout(timer);
  }, [storageKey, message]);

  return play ? <ConfettiBurst count={22} /> : null;
}
