'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { siteImageUrl, type HeroImage } from '@/utils/site';

// Event photo carousel on the home page. Moves on every 5 seconds; arrows and dots
// let visitors pick a photo. Shows nothing when there are no photos yet.
export default function HeroCarousel({ images }: { images: HeroImage[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (images.length < 2 || paused) return;
    // WCAG 2.2.2: no auto-advance for users who prefer reduced motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), 5000);
    return () => clearInterval(timer);
  }, [images.length, paused]);

  if (images.length === 0) return null;

  const current = images[index % images.length];
  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length);
  const photo = (
    <Image
      src={siteImageUrl(current.image_path)!}
      alt={current.caption || 'DALTA Esports event photo'}
      fill
      sizes="100vw"
      className="object-cover"
      priority
    />
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Event photos"
      className="relative w-full rounded-2xl border border-stone-200/90 shadow-md bg-stone-950 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="relative aspect-[16/7] overflow-hidden">
        {current.link ? <Link href={current.link}>{photo}</Link> : photo}
        {current.caption && (
          <p className="absolute bottom-0 inset-x-0 bg-stone-950/85 px-6 py-3 text-xs sm:text-sm text-white font-extrabold uppercase tracking-wider backdrop-blur-sm">{current.caption}</p>
        )}
      </div>

      {images.length > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 border border-stone-200 text-stone-950 font-black shadow-sm hover:bg-gold hover:scale-105 transition-all">
            ‹
          </button>
          <button onClick={() => go(1)} aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 border border-stone-200 text-stone-950 font-black shadow-sm hover:bg-gold hover:scale-105 transition-all">
            ›
          </button>
          <div className="absolute top-3 right-3 flex gap-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === index % images.length}
                className={`w-2.5 h-2.5 rounded-full border border-stone-300 transition-all ${i === index % images.length ? 'bg-gold w-6' : 'bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
