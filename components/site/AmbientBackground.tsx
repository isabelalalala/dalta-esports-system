'use client';

import { useEffect, useRef } from 'react';

// Slow, faint brand background (maroon and gold glows + a drifting triangle grid) for the footer
// and the home hero. Put it as the first child of a `relative overflow-hidden` box.
// The CSS lives in globals.css ("ambient background"). To save battery the animation is paused
// while the box is off-screen or the tab is hidden; reduced motion shows a still picture.
// onDark: the box is always dark (the photo hero), so the grid is gold in both themes.
// Rising sparks for `lively`: each has its own column, speed, start delay and sideways drift
// (CSS variables read by .ambient-spark in globals.css)
const SPARKS = [
  '[--x:4%] [--dur:11s] [--delay:0s] [--drift:14px]',
  '[--x:11%] [--dur:9s] [--delay:3.2s] [--drift:-10px]',
  '[--x:17%] [--dur:13s] [--delay:6.1s] [--drift:8px]',
  '[--x:24%] [--dur:10s] [--delay:1.4s] [--drift:-16px]',
  '[--x:31%] [--dur:12s] [--delay:7.8s] [--drift:12px]',
  '[--x:38%] [--dur:9.5s] [--delay:4.6s] [--drift:-8px]',
  '[--x:45%] [--dur:14s] [--delay:2.3s] [--drift:18px]',
  '[--x:52%] [--dur:10.5s] [--delay:8.9s] [--drift:-12px]',
  '[--x:59%] [--dur:12.5s] [--delay:0.8s] [--drift:10px]',
  '[--x:66%] [--dur:9s] [--delay:5.5s] [--drift:-14px]',
  '[--x:72%] [--dur:13.5s] [--delay:3.9s] [--drift:6px]',
  '[--x:78%] [--dur:11.5s] [--delay:9.6s] [--drift:-18px]',
  '[--x:84%] [--dur:10s] [--delay:2.7s] [--drift:12px]',
  '[--x:89%] [--dur:12s] [--delay:6.8s] [--drift:-6px]',
  '[--x:94%] [--dur:9.5s] [--delay:1.9s] [--drift:16px]',
  '[--x:98%] [--dur:13s] [--delay:7.2s] [--drift:-10px]',
];

// lively: also a third glow and slowly rising sparks (desktop with a mouse only), for the big
// background areas that should feel alive: the homepage "Choose your game" band and the footer.
export default function AmbientBackground({
  className = '', onDark = false, lively = false,
}: { className?: string; onDark?: boolean; lively?: boolean }) {
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
        {lively && <div className="ambient-orb ambient-orb-c" />}
      </div>
      {lively && (
        <div className="ambient-sparks">
          {SPARKS.map((vars) => <span key={vars} className={`ambient-spark ${vars}`} />)}
        </div>
      )}
    </div>
  );
}
