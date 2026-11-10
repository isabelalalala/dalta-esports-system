'use client';

import { useEffect, useRef } from 'react';

// Slow, faint brand background (maroon and gold glows + a drifting triangle grid) for the footer
// and the home hero. Put it as the first child of a `relative overflow-hidden` box.
// The CSS lives in globals.css ("ambient background"). To save battery the animation is paused
// while the box is off-screen or the tab is hidden; reduced motion shows a still picture.
// onDark: the box is always dark (the photo hero), so the grid is gold in both themes.
export default function AmbientBackground({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

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
      className={`pointer-events-none absolute inset-0 m-0! overflow-hidden ${onDark ? 'ambient-on-dark' : ''} ${className}`}
    >
      {/* Triangles like the DALTA logo: one 56x32 tile repeated (CSS mask, globals.css
          "zigzag pattern"), always edge to edge */}
      <div className="zigzag-pattern" />
      {/* Maroon (left) and gold (right) glows on top at low opacity: they tint the pattern, never hide it */}
      <div className="absolute inset-0 opacity-(--ambient-glow-opacity)">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>
    </div>
  );
}
