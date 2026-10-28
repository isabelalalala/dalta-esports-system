'use client';

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

export default function PartnershipSection() {
  // Repeat the 3 partner items so each track is full and loops continuously
  const trackItems = [
    ...PARTNERS,
    ...PARTNERS,
    ...PARTNERS,
  ];

  return (
    <section
      aria-label="Official Partnerships"
      className="relative w-full max-w-5xl mx-auto rounded-3xl border border-transparent bg-white overflow-hidden py-8 sm:py-10 text-center text-stone-950 space-y-5 sm:space-y-6 uppercase"
    >
      {/* Inline styles ensure the right-to-left marquee animation runs immediately without browser cache or reduced-motion blockers */}
      <style>{`
        @keyframes marqueeScrollRTL {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-100%, 0, 0);
          }
        }
        .marquee-track-rtl {
          display: flex !important;
          flex-shrink: 0 !important;
          align-items: center !important;
          animation: marqueeScrollRTL 20s linear infinite !important;
          will-change: transform;
        }
        .marquee-container-rtl:hover .marquee-track-rtl {
          animation-play-state: paused !important;
        }
      `}</style>

      {/* Header: Handshake icon, PARTNERSHIP title in pure black, and brand maroon subtitle */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 space-y-1.5 flex flex-col items-center justify-center">
        <div className="inline-flex items-center justify-center gap-2.5">
          <Handshake className="h-6 w-6 sm:h-7 sm:w-7 text-[#5B271E] shrink-0" />
          <h2
            className="text-2xl sm:text-3xl font-black !text-black text-black tracking-widest uppercase leading-none"
            style={{ color: '#000000' }}
          >
            PARTNERSHIP
          </h2>
        </div>
        <p className="text-xs sm:text-sm font-bold text-[#5B271E] uppercase tracking-widest leading-relaxed">
          Empowering collegiate esports through strategic alliances.
        </p>
      </div>

      {/* Sliding loop container with gradient fade edges */}
      <div className="marquee-container-rtl relative w-full overflow-hidden flex py-2">
        {/* Soft edge fades blending into white background */}
        <div className="absolute inset-y-0 left-0 w-12 sm:w-24 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-12 sm:w-24 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

        {/* Track 1: First set moving right to left */}
        <div className="marquee-track-rtl gap-4 sm:gap-6 pr-4 sm:pr-6">
          {trackItems.map((partner, idx) => (
            <div
              key={`track1-${partner.name}-${idx}`}
              className="group/card relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 shrink-0 rounded-2xl overflow-hidden border border-stone-200/90 bg-white shadow-xs transition-all duration-300 hover:scale-105 hover:border-[#FFCC37]/70 hover:shadow-md cursor-pointer"
              title={partner.name}
            >
              <Image
                src={partner.src}
                alt={partner.name}
                fill
                sizes="(max-width: 640px) 112px, (max-width: 768px) 144px, 160px"
                className="object-cover group-hover/card:scale-105 transition-transform duration-500"
              />

              {/* Hover overlay with partner details */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 sm:p-3 text-left">
                <span className="text-white text-[11px] sm:text-xs font-black tracking-wide uppercase line-clamp-1 drop-shadow-sm">
                  {partner.name}
                </span>
                {partner.tagline && (
                  <span className="text-stone-300 text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase line-clamp-2 mt-0.5">
                    {partner.tagline}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Track 2: Duplicate set moving synchronously right to left for infinite seamless loop */}
        <div className="marquee-track-rtl gap-4 sm:gap-6 pr-4 sm:pr-6" aria-hidden="true">
          {trackItems.map((partner, idx) => (
            <div
              key={`track2-${partner.name}-${idx}`}
              className="group/card relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 shrink-0 rounded-2xl overflow-hidden border border-stone-200/90 bg-white shadow-xs transition-all duration-300 hover:scale-105 hover:border-[#FFCC37]/70 hover:shadow-md cursor-pointer"
              title={partner.name}
            >
              <Image
                src={partner.src}
                alt={partner.name}
                fill
                sizes="(max-width: 640px) 112px, (max-width: 768px) 144px, 160px"
                className="object-cover group-hover/card:scale-105 transition-transform duration-500"
              />

              {/* Hover overlay with partner details */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 sm:p-3 text-left">
                <span className="text-white text-[11px] sm:text-xs font-black tracking-wide uppercase line-clamp-1 drop-shadow-sm">
                  {partner.name}
                </span>
                {partner.tagline && (
                  <span className="text-stone-300 text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase line-clamp-2 mt-0.5">
                    {partner.tagline}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
