'use client';

import { useEffect, useRef } from 'react';

// A score number that flips down like a scoreboard digit when it changes while the page is open
// (live pages reload by themselves). Nothing animates on the first render, and nothing with
// reduced motion (CSS "animate-score-flip" in globals.css).
// fallback = what to show when there is no score yet ("0" for a live match, "-" for a result)
export default function FlipScore({
  value, className = '', fallback = '0',
}: { value: number | null | undefined; className?: string; fallback?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (el && previous.current !== value) {
      // Restart the animation: remove the class, force a reflow, add it again
      el.classList.remove('animate-score-flip');
      void el.offsetWidth;
      el.classList.add('animate-score-flip');
    }
    previous.current = value;
  }, [value]);

  return (
    <span ref={ref} className={`inline-block tabular-nums ${className}`}>
      {value ?? fallback}
    </span>
  );
}
