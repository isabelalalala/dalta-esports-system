'use client';

import { useEffect, useRef } from 'react';

const format = (n: number) => n.toLocaleString('en-PH');
const DURATION_MS = 1400;

// A number that counts up from 0 the first time it scrolls into view (ease-out, ~1.4 s).
// The server renders the real number, so it is correct without JavaScript; with reduced motion
// it never animates. Writes the text directly (no re-render per frame).
// delayMs: wait this long after it comes into view (the homepage band fades its stats bar in first).
// When the count finishes, the nearest [data-stat] parent gets data-counted (CSS: the icon bounces).
export default function CountUp({ value, delayMs = 0 }: { value: number; delayMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    el.textContent = '0';
    let frame = 0;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const done = () => el.closest('[data-stat]')?.setAttribute('data-counted', '');
    // Printing / "Export PDF" before the number scrolled into view: show the real value
    const showFinal = () => {
      cancelAnimationFrame(frame);
      el.textContent = format(value);
    };
    window.addEventListener('beforeprint', showFinal);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        wait = setTimeout(() => {
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min(1, (now - start) / DURATION_MS);
            const eased = 1 - Math.pow(1 - progress, 3); // fast start, slow finish
            el.textContent = format(Math.round(value * eased));
            if (progress < 1) frame = requestAnimationFrame(step);
            else done();
          };
          frame = requestAnimationFrame(step);
        }, delayMs);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.removeEventListener('beforeprint', showFinal);
      cancelAnimationFrame(frame);
      clearTimeout(wait);
      el.textContent = format(value);
    };
  }, [value, delayMs]);

  return <span ref={ref} className="tabular-nums">{format(value)}</span>;
}
