'use client';

import { useEffect, useRef } from 'react';

const format = (n: number) => n.toLocaleString('en-PH');
const DURATION_MS = 1400;

// A number that counts up from 0 the first time it scrolls into view (ease-out, ~1.4 s).
// The server renders the real number, so it is correct without JavaScript; with reduced motion
// it never animates. Writes the text directly (no re-render per frame).
export default function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    el.textContent = '0';
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - progress, 3); // fast start, slow finish
          el.textContent = format(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = format(value);
    };
  }, [value]);

  return <span ref={ref} className="tabular-nums">{format(value)}</span>;
}
