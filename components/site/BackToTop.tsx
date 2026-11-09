'use client';

import { ArrowUp } from 'lucide-react';

// Footer button that scrolls back to the top (instantly with reduced motion).
export default function BackToTop() {
  const goTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };
  return (
    <button
      type="button"
      onClick={goTop}
      className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-stone-800 hover:border-gold hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon transition-colors cursor-pointer"
    >
      <ArrowUp className="size-4" aria-hidden="true" />
      Back to top
    </button>
  );
}
