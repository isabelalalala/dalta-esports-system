import type { ReactNode } from 'react';
import AmbientBackground from '@/components/site/AmbientBackground';
import Reveal from '@/components/Reveal';

// Full-width dark section on the homepage ("Choose your game"). Same building blocks as the page
// heroes and the footer (docs/brand.md "Motion"): AmbientBackground (onDark: drifting glows on the
// shared zigzag pattern) and one hero-sweep light, which waits until the band scrolls into view
// (it sits in a Reveal). The angled look = two thin slanted gold accent lines (CSS .band-angled).
// The negative margins cancel <main>'s side padding (SiteNavLayout: px-4 sm:px-8 lg:px-12 xl:px-16),
// so the band reaches both edges of the content area without making the page scroll sideways.
// bg-ink keeps light-mode text colors inside it in dark mode too (globals.css).
export default function DarkBand({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section
      aria-label={label}
      className="band-angled relative isolate -mx-4 sm:-mx-8 lg:-mx-12 xl:-mx-16 overflow-hidden bg-ink text-white"
    >
      <AmbientBackground onDark className="-z-10" />
      <Reveal className="pointer-events-none absolute inset-0 -z-10 m-0! overflow-hidden">
        <div className="hero-sweep" aria-hidden="true" />
      </Reveal>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 py-16 sm:py-24 space-y-10 sm:space-y-12">{children}</div>
    </section>
  );
}
