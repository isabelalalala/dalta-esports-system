'use client';

import { useEffect } from 'react';

// Keeps the CSS variable --site-header-h equal to the header's real height. The header's height
// changes with the screen size (one row on desktop, two on phones), and the sticky side nav in
// SiteNavLayout uses this variable to stay just below it.
export default function HeaderHeight({ targetId }: { targetId: string }) {
  useEffect(() => {
    const header = document.getElementById(targetId);
    if (!header) return;
    const update = () =>
      document.documentElement.style.setProperty('--site-header-h', `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, [targetId]);

  return null;
}
