'use client';

import { useRef, type ReactNode } from 'react';

// Max tilt in degrees each way (subtle: the card leans toward the mouse, it doesn't spin)
const MAX_TILT = 6;

// Wraps a card so it tilts slightly toward the mouse pointer (CSS .tilt-card in globals.css).
// Only for a real mouse: touch and pen are ignored, and reduced motion keeps the card flat (CSS).
// The values go straight to CSS variables on the element, so moving the mouse doesn't re-render.
export default function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const box = el.getBoundingClientRect();
    // -0.5 .. 0.5 from the center of the card
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    el.style.setProperty('--tilt-x', `${(x * MAX_TILT * 2).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(-y * MAX_TILT * 2).toFixed(2)}deg`);
    el.dataset.tilting = '';
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty('--tilt-x');
    el.style.removeProperty('--tilt-y');
    delete el.dataset.tilting;
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`tilt-card ${className}`}>
      {children}
    </div>
  );
}
