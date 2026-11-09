'use client';

import { useEffect, useRef } from 'react';

// Fill time in ms (ease-out)
const DURATION = 900;

// A native <progress> bar that fills from 0 to its value the first time it scrolls into view
// (tournament slots, pick'em split). The real value is in the markup and the aria-label from the
// start; the fill only moves the element's value directly (no re-renders). Later value changes
// (a new pick, a new registration) just move the bar, and with reduced motion (or no
// IntersectionObserver) it simply shows the value.
export default function AnimatedProgress({
  value, max, className = '', label,
}: { value: number; max: number; className?: string; label: string }) {
  const ref = useRef<HTMLProgressElement>(null);
  const filled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already filled once: a new value (or an interrupted fill) just shows the value
    if (filled.current) {
      el.value = value;
      return;
    }
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      filled.current = true;
      return;
    }
    let frame = 0;
    el.value = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      filled.current = true;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        el.value = value * (1 - Math.pow(1 - t, 3));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      // Not started yet (dev double effect, or the value changed first): put the value back
      if (!filled.current) el.value = value;
    };
  }, [value]);

  return <progress ref={ref} value={value} max={max} aria-label={label} className={className} />;
}
