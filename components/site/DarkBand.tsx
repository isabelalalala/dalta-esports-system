import type { ReactNode } from 'react';
import AmbientBackground from '@/components/site/AmbientBackground';
import InView from '@/components/site/InView';

// Rising sparks (desktop with a mouse only; CSS hides them on phones and touch screens). Each one
// has its own column, speed, start delay and sideways drift, as CSS variables (globals.css "Phase 9.6").
const EMBERS = [
  '[--x:4%] [--dur:11s] [--delay:0s] [--drift:14px]',
  '[--x:11%] [--dur:9s] [--delay:3.2s] [--drift:-10px]',
  '[--x:17%] [--dur:13s] [--delay:6.1s] [--drift:8px]',
  '[--x:24%] [--dur:10s] [--delay:1.4s] [--drift:-16px]',
  '[--x:31%] [--dur:12s] [--delay:7.8s] [--drift:12px]',
  '[--x:38%] [--dur:9.5s] [--delay:4.6s] [--drift:-8px]',
  '[--x:45%] [--dur:14s] [--delay:2.3s] [--drift:18px]',
  '[--x:52%] [--dur:10.5s] [--delay:8.9s] [--drift:-12px]',
  '[--x:59%] [--dur:12.5s] [--delay:0.8s] [--drift:10px]',
  '[--x:66%] [--dur:9s] [--delay:5.5s] [--drift:-14px]',
  '[--x:72%] [--dur:13.5s] [--delay:3.9s] [--drift:6px]',
  '[--x:78%] [--dur:11.5s] [--delay:9.6s] [--drift:-18px]',
  '[--x:84%] [--dur:10s] [--delay:2.7s] [--drift:12px]',
  '[--x:89%] [--dur:12s] [--delay:6.8s] [--drift:-6px]',
  '[--x:94%] [--dur:9.5s] [--delay:1.9s] [--drift:16px]',
  '[--x:98%] [--dur:13s] [--delay:7.2s] [--drift:-10px]',
];

// Full-width dark section (straight edges, with slanted gold accents inside: CSS .band-angled) and the moving
// brand background, to break up the long white homepage. The negative margins cancel <main>'s
// side padding (SiteNavLayout: px-4 sm:px-8 lg:px-12 xl:px-16), so the band reaches both edges of
// the content area without making the page scroll sideways. bg-ink keeps light-mode text colors
// inside it in dark mode too (globals.css), so white text stays white.
// Phase 9.6: InView starts the one-time entrance (.fx-in children) and pauses the loops off-screen.
export default function DarkBand({ children, label }: { children: ReactNode; label: string }) {
  return (
    <InView
      label={label}
      className="fx-band band-angled relative isolate -mx-4 sm:-mx-8 lg:-mx-12 xl:-mx-16 overflow-hidden bg-ink text-white"
    >
      {/* Layers, bottom to top: ink background, gold angled bands (CSS, z -20), zigzag pattern + two
          faint glows (AmbientBackground, z -10), a third glow, the light sweeping along the gold
          edges and the sparks (z -5), content. No corner spotlight (bg-logo-stage): it lightened
          the bottom-right and the zigzags faded out on that side (9.5). */}
      <AmbientBackground onDark className="-z-10" />
      <div className="band-orb-c" aria-hidden="true" />
      <div className="band-edge-sweep band-edge-sweep-top" aria-hidden="true" />
      <div className="band-edge-sweep band-edge-sweep-bottom" aria-hidden="true" />
      <div className="band-embers" aria-hidden="true">
        {EMBERS.map((vars) => <span key={vars} className={`band-ember ${vars}`} />)}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 py-16 sm:py-24 space-y-10 sm:space-y-12">{children}</div>
    </InView>
  );
}
