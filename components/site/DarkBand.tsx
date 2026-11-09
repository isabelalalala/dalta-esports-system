import type { ReactNode } from 'react';
import AmbientBackground from '@/components/site/AmbientBackground';

// Full-width dark section (straight edges, with slanted gold accents inside: CSS .band-angled) and the moving
// brand background, to break up the long white homepage. The negative margins cancel <main>'s
// side padding (SiteNavLayout: px-4 sm:px-8 lg:px-12 xl:px-16), so the band reaches both edges of
// the content area without making the page scroll sideways. bg-ink keeps light-mode text colors
// inside it in dark mode too (globals.css), so white text stays white.
export default function DarkBand({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section
      aria-label={label}
      className="band-angled relative isolate -mx-4 sm:-mx-8 lg:-mx-12 xl:-mx-16 overflow-hidden bg-ink text-white"
    >
      <div className="absolute inset-0 -z-10 bg-logo-stage opacity-70" aria-hidden="true" />
      <AmbientBackground onDark className="-z-10" />
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 py-16 sm:py-24 space-y-10 sm:space-y-12">{children}</div>
    </section>
  );
}
