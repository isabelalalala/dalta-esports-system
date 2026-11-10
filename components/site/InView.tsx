'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// A <section> that tells its CSS when it is on screen (Phase 9.6, "Choose your game" band):
// - data-inview is set the first time it scrolls into view and stays (starts the one-time entrance)
// - data-offscreen is set while it is off-screen or the tab is hidden (pauses the idle loops)
// Both are written on the DOM element directly, so nothing re-renders. Without JavaScript the CSS
// shows everything (the entrance rules only apply with `scripting: enabled`).
export default function InView({
  children, className = '', label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.inview = 'true';
      return;
    }
    let onScreen = false;
    const update = () => {
      if (onScreen && document.visibilityState === 'visible') delete el.dataset.offscreen;
      else el.dataset.offscreen = '';
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) el.dataset.inview = 'true';
        update();
      },
      // The entrance starts once a fifth of the band is visible
      { threshold: 0.2 },
    );
    observer.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    // Paused until the observer says it's on screen
    <section ref={ref} aria-label={label} data-offscreen="" className={className}>
      {children}
    </section>
  );
}
