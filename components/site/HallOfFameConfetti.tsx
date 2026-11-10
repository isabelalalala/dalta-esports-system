'use client';

import { useEffect, useState } from 'react';
import ConfettiBurst from '@/components/ConfettiBurst';

const KEY = 'dalta_hof_confetti';

// One confetti burst over the Hall of Fame hero, the first time it's opened in this browser
// session (sessionStorage; every visit when storage is blocked). Hidden with reduced motion
// (ConfettiBurst's CSS).
export default function HallOfFameConfetti() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === '1';
      sessionStorage.setItem(KEY, '1');
    } catch {
      // private mode: celebrate anyway
    }
    if (seen) return;
    // After the first paint, so the burst is visible
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);
  return show ? <ConfettiBurst count={36} /> : null;
}
