'use client';

import { useEffect } from 'react';

// Registers public/sw.js (offline fallback page only) in production. In development it would
// keep old pages around while editing, so it is skipped there.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not supported (some in-app browsers): the site works the same without it
    });
  }, []);
  return null;
}
