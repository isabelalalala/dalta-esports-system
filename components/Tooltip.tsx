'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Props {
  // The hint, e.g. "Recruiting — accept or decline players who want to join your team"
  text: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'right' | 'left';
  // Wrapper element classes (it is inline-flex and relative by default)
  className?: string;
}

const LONG_PRESS_MS = 450;
const SHOW_AFTER_PRESS_MS = 2500;

const sideClass: Record<NonNullable<Props['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-3',
  left: 'right-full top-1/2 -translate-y-1/2 mr-3',
};

// Hover hint for icon buttons, nav items and section titles. Shows on mouse hover and keyboard
// focus (CSS), and on a long press on touch screens (no hover there). The hint is extra help:
// controls still need their own visible text or aria-label.
export default function Tooltip({ text, children, side = 'top', className = '' }: Props) {
  const id = useId();
  const [pressed, setPressed] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <span
      className={`relative inline-flex group/tip ${className}`}
      aria-describedby={id}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return;
        cancelPress();
        pressTimer.current = setTimeout(() => {
          setPressed(true);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setPressed(false), SHOW_AFTER_PRESS_MS);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      // A long press would otherwise also open the phone's link menu
      onContextMenu={(e) => { if (pressed) e.preventDefault(); }}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-50 w-max max-w-64 rounded-xl border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-semibold normal-case tracking-normal leading-snug text-white shadow-lg transition-opacity duration-150 ${sideClass[side]} ${
          pressed ? 'opacity-100' : 'opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100'
        }`}
      >
        {text}
      </span>
    </span>
  );
}
