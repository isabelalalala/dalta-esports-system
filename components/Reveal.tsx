'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // Stagger for cards in a row: 0-3 (80 ms steps)
  delay?: 0 | 1 | 2 | 3;
  className?: string;
}

const DELAY_CLASS = ['', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3'] as const;

// Fades and slides its content in the first time it scrolls into view (CSS "Scroll reveal" in
// app/globals.css). Content already on screen when the page opens shows right away. Nothing is
// hidden with reduced motion or without JavaScript. Sets data-revealed on the DOM element
// directly, so revealing doesn't re-render the children.
export default function Reveal({ children, delay = 0, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.revealed = 'true';
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.revealed = 'true';
          observer.disconnect(); // only once
        }
      },
      // Start a little before it is fully in view
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${DELAY_CLASS[delay]} ${className}`}>
      {children}
    </div>
  );
}
