'use client';

import { useLayoutEffect, useRef } from 'react';

// Brand colors for the pieces (theme classes, so no hex in the markup)
const COLORS = ['bg-gold', 'bg-maroon', 'bg-white', 'bg-amber-300', 'bg-golddark'];

// A short burst of confetti from the center of the nearest `relative` parent. It plays once when
// it mounts (CSS "confettiFly" in globals.css), so the parent decides when by rendering it.
// Hidden with reduced motion. Each piece's direction, distance, spin and delay are spread evenly
// from its index (no randomness, so server and browser markup always match) and set as CSS
// variables from JS, like the Tooltip's position.
export default function ConfettiBurst({ count = 28, small = false }: { count?: number; small?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  // Layout effect: the variables are set before the first paint, so the burst starts right
  useLayoutEffect(() => {
    const pieces = ref.current?.children;
    if (!pieces) return;
    const reach = small ? 70 : 170;
    for (let i = 0; i < pieces.length; i++) {
      const el = pieces[i] as HTMLElement;
      // Angles around the circle, a bit more upward; distances alternate so it isn't a ring
      const angle = (i / pieces.length) * Math.PI * 2 + (i % 3) * 0.35;
      const distance = reach * (0.55 + ((i * 37) % 45) / 100);
      el.style.setProperty('--cx', `${Math.round(Math.cos(angle) * distance)}px`);
      el.style.setProperty('--cy', `${Math.round(Math.sin(angle) * distance * 0.75 - reach * 0.25)}px`);
      el.style.setProperty('--cr', `${((i * 97) % 540) - 270}deg`);
      el.style.setProperty('--cd', `${(i % 5) * 0.04}s`);
    }
  }, [small]);

  return (
    <span ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-visible ${small ? 'confetti-sm' : ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`confetti-piece ${COLORS[i % COLORS.length]}`} />
      ))}
    </span>
  );
}
