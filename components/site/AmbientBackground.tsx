'use client';

import { useEffect, useId, useRef } from 'react';

// Slow, faint brand background (maroon and gold glows + a drifting triangle grid) for the footer
// and the home hero. Put it as the first child of a `relative overflow-hidden` box.
// The CSS lives in globals.css ("ambient background"). To save battery the animation is paused
// while the box is off-screen or the tab is hidden; reduced motion shows a still picture.
// onDark: the box is always dark (the photo hero), so the grid is gold in both themes.
export default function AmbientBackground({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // useId() may contain characters that don't work inside url(#...)
  const patternId = 'ambient-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = false;
    const update = () => {
      if (onScreen && document.visibilityState === 'visible') el.removeAttribute('data-paused');
      else el.setAttribute('data-paused', '');
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      // Paused until the observer says it's on screen
      data-paused=""
      className={`pointer-events-none absolute inset-0 overflow-hidden ${onDark ? 'ambient-on-dark' : ''} ${className}`}
    >
      <div className="absolute inset-0 opacity-[0.13]">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>
      {/* Triangles like the DALTA logo, outlined, one 56x32 tile repeated */}
      <svg className="ambient-grid opacity-[0.07]" width="100%" height="100%">
        <defs>
          <pattern id={patternId} width="56" height="32" patternUnits="userSpaceOnUse">
            <path d="M0 32 L14 8 L28 32 M28 0 L42 24 L56 0" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
