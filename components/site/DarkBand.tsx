import type { ReactNode } from 'react';
import AmbientBackground from '@/components/site/AmbientBackground';

// Full-width dark section on the homepage ("Choose your game"). Same building blocks as the footer
// (docs/brand.md "Motion"): AmbientBackground lively (onDark: drifting glows on the shared zigzag
// pattern, a third glow and rising sparks). The angled look = two thin slanted gold accent lines
// (CSS .band-angled) with a light running along them every few seconds (.band-edge-sweep).
// The negative margins cancel <main>'s side padding (SiteNavLayout: px-4 sm:px-8 lg:px-12 xl:px-16),
// so the band reaches both edges of the content area without making the page scroll sideways.
// bg-ink keeps light-mode text colors inside it in dark mode too (globals.css).
export default function DarkBand({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section
      aria-label={label}
      className="band-angled relative isolate -mx-4 sm:-mx-8 lg:-mx-12 xl:-mx-16 overflow-hidden bg-ink text-white"
    >
      <AmbientBackground onDark lively className="-z-10" />
      <div className="band-edge-sweep band-edge-sweep-top" aria-hidden="true" />
      <div className="band-edge-sweep band-edge-sweep-bottom" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 py-16 sm:py-24 space-y-10 sm:space-y-12">{children}</div>
    </section>
  );
}
