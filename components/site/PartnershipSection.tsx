'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Handshake } from 'lucide-react';

interface Partner {
  name: string;
  src: string;
  tagline?: string;
}

const PARTNERS: Partner[] = [
  {
    name: 'AcadArena Education',
    src: '/AcadArena Education.jpg',
    tagline: 'Collegiate Esports Education & Student Programs',
  },
  {
    name: 'Moonton Student Leaders',
    src: '/Moonton Student Leaders.jpg',
    tagline: 'Official MLBB Campus Leadership & Grassroots Esports',
  },
  {
    name: 'Philippine Collegiate Championship',
    src: '/Philippine Collegiate Championship.png',
    tagline: 'Premier Nationwide Collegiate Tournament Circuit',
  },
];

// Marquee speed in CSS pixels per second (a logo stays on screen for several seconds)
const SPEED_PX_PER_S = 35;
// Each track repeats the partners so it is wider than the box, even with few partners
const REPEAT = 3;

// Official partners as a slow right-to-left marquee (CSS in app/globals.css, "Partner marquee").
// Two identical tracks move together, so when the first has moved its full width the second is
// exactly where the first started: the loop restarts without a jump. The duration is measured
// from the track width, so the speed stays the same whatever the number of logos. Hover or
// keyboard focus pauses it; with reduced motion it is a still, centered row of the partners.
export default function PartnershipSection() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const update = () => {
      const seconds = Math.max(10, track.scrollWidth / SPEED_PX_PER_S);
      viewport.style.setProperty('--marquee-duration', `${seconds}s`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const items = Array.from({ length: REPEAT }, () => PARTNERS).flat();

  return (
    <section
      aria-label="Official Partnerships"
      className="relative w-full max-w-5xl mx-auto rounded-3xl border border-transparent bg-white overflow-hidden py-8 sm:py-10 text-center text-stone-950 space-y-5 sm:space-y-6"
    >
      {/* Header: Handshake icon, PARTNERSHIP title and brand maroon subtitle */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 space-y-1.5 flex flex-col items-center justify-center">
        <div className="inline-flex items-center justify-center gap-2.5">
          <Handshake className="h-6 w-6 sm:h-7 sm:w-7 text-maroon shrink-0" />
          <h2 className="text-2xl sm:text-3xl font-black tracking-widest uppercase leading-none text-stone-950">
            PARTNERSHIP
          </h2>
        </div>
        <p className="text-xs sm:text-sm font-bold text-maroon leading-relaxed">
          Empowering collegiate esports through strategic alliances.
        </p>
      </div>

      <div ref={viewportRef} className="partner-marquee relative w-full overflow-hidden flex py-2">
        {/* Narrow edge fades (theme surface color, so they also work in dark mode): only the
            last few pixels of a logo entering or leaving are faded */}
        <div className="partner-marquee-fade absolute inset-y-0 left-0 w-6 sm:w-10 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
        <div className="partner-marquee-fade absolute inset-y-0 right-0 w-6 sm:w-10 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />

        {[0, 1].map((copy) => (
          <div
            key={copy}
            ref={copy === 0 ? trackRef : undefined}
            aria-hidden={copy === 1 || undefined}
            className={`partner-marquee-track gap-4 sm:gap-6 pr-4 sm:pr-6 ${copy === 1 ? 'partner-marquee-copy' : ''}`}
          >
            {items.map((partner, idx) => {
              // Only the first set of the first track is real content (focusable, read out);
              // the rest are visual repeats, hidden with reduced motion
              const original = copy === 0 && idx < PARTNERS.length;
              return (
                <div
                  key={`${copy}-${idx}`}
                  tabIndex={original ? 0 : -1}
                  aria-hidden={!original || undefined}
                  title={partner.name}
                  className={`group/card relative w-28 h-28 sm:w-36 sm:h-36 @3xl:w-40 @3xl:h-40 shrink-0 rounded-2xl overflow-hidden border border-stone-200/90 bg-white shadow-xs transition-all duration-300 hover:scale-105 hover:border-gold/70 hover:shadow-md focus-visible:border-gold ${
                    original ? '' : 'partner-marquee-copy'
                  }`}
                >
                  <Image
                    src={partner.src}
                    alt={original ? partner.name : ''}
                    fill
                    sizes="(max-width: 640px) 112px, (max-width: 768px) 144px, 160px"
                    className="object-cover group-hover/card:scale-105 transition-transform duration-500"
                  />

                  {/* Partner details on hover / keyboard focus */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover/card:opacity-100 group-focus-visible/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 sm:p-3 text-left">
                    <span className="text-white text-[11px] sm:text-xs font-black tracking-wide line-clamp-1 drop-shadow-sm">
                      {partner.name}
                    </span>
                    {partner.tagline && (
                      <span className="text-white/80 text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase line-clamp-2 mt-0.5">
                        {partner.tagline}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
