'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom' | 'right' | 'left';

interface Props {
  // The hint, e.g. "Recruiting — accept or decline players who want to join your team"
  text: string;
  // Optional bold first line (the sidebar's icon-only rail shows the menu label here)
  heading?: string;
  children: ReactNode;
  side?: Side;
  // Wrapper element classes (it is inline-flex by default)
  className?: string;
}

const SHOW_DELAY_MS = 300;
const LONG_PRESS_MS = 450;
const SHOW_AFTER_PRESS_MS = 2500;
const GAP = 10; // space between the element and the bubble, in px
const EDGE = 8; // the bubble stays this far from the window edges

// Places the bubble next to the trigger, on the chosen side, then keeps it inside the window
// (flips to the other side if there is no room). Runs on the real DOM, so no re-render is needed.
function placeBubble(trigger: HTMLElement, bubble: HTMLElement, side: Side) {
  const t = trigger.getBoundingClientRect();
  const b = bubble.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let s = side;
  if (s === 'right' && t.right + GAP + b.width > vw - EDGE) s = 'left';
  else if (s === 'left' && t.left - GAP - b.width < EDGE) s = 'right';
  else if (s === 'top' && t.top - GAP - b.height < EDGE) s = 'bottom';
  else if (s === 'bottom' && t.bottom + GAP + b.height > vh - EDGE) s = 'top';

  let left: number;
  let top: number;
  if (s === 'right' || s === 'left') {
    left = s === 'right' ? t.right + GAP : t.left - GAP - b.width;
    top = t.top + t.height / 2 - b.height / 2;
  } else {
    left = t.left + t.width / 2 - b.width / 2;
    top = s === 'bottom' ? t.bottom + GAP : t.top - GAP - b.height;
  }
  left = Math.min(Math.max(left, EDGE), vw - EDGE - b.width);
  top = Math.min(Math.max(top, EDGE), vh - EDGE - b.height);

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  bubble.style.visibility = 'visible';
}

// Hover hint for icon buttons, nav items and section titles. Shows after a short delay on mouse
// hover and keyboard focus, and on a long press on touch screens (no hover there). The bubble is
// drawn in a portal with position: fixed, so a parent with overflow (the sidebar) can't clip it
// or get a sideways scrollbar from it. The hint is extra help: controls still need their own
// visible text or aria-label (screen readers get the text through aria-describedby).
export default function Tooltip({ text, heading, children, side = 'top', className = '' }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);

  const clearTimers = () => {
    [showTimer, pressTimer, hideTimer].forEach((t) => {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    });
  };

  const showSoon = () => {
    clearTimers();
    showTimer.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  };

  const hide = () => {
    clearTimers();
    pressed.current = false;
    setOpen(false);
  };

  useEffect(() => clearTimers, []);

  // Position the bubble once it is in the DOM (before the browser paints)
  useLayoutEffect(() => {
    if (open && triggerRef.current && bubbleRef.current) {
      placeBubble(triggerRef.current, bubbleRef.current, side);
    }
  }, [open, side, text, heading]);

  // While open: hide on scroll (the position would be stale), on resize and on Escape
  useEffect(() => {
    if (!open) return;
    const close = () => {
      pressed.current = false;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className={`inline-flex ${className}`}
      aria-describedby={id}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') showSoon();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch') hide();
      }}
      onFocus={(e) => {
        // Keyboard focus only: a mouse click also focuses, and the hover already handles that
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) showSoon();
      }}
      onBlur={hide}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') {
          hide(); // clicking dismisses the hint
          return;
        }
        clearTimers();
        pressTimer.current = setTimeout(() => {
          pressed.current = true;
          setOpen(true);
          hideTimer.current = setTimeout(hide, SHOW_AFTER_PRESS_MS);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'touch' && pressTimer.current) clearTimeout(pressTimer.current);
      }}
      onPointerCancel={() => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
      }}
      // A long press would otherwise also open the phone's link menu
      onContextMenu={(e) => {
        if (pressed.current) e.preventDefault();
      }}
    >
      {children}
      {/* Always in the DOM for screen readers; the visible bubble below is decorative */}
      <span id={id} className="sr-only">
        {heading ? `${heading}: ${text}` : text}
      </span>
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 z-[60] invisible w-max max-w-64 rounded-xl border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-semibold normal-case tracking-normal leading-snug text-white shadow-lg animate-tooltip-in"
          >
            {heading && <span className="block font-black uppercase tracking-wider">{heading}</span>}
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
