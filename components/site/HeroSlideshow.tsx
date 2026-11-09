'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AmbientBackground from '@/components/site/AmbientBackground';
import { heroBannerUrl, siteImageUrl, type HeroImage, type SiteContent } from '@/utils/site';

interface Props {
  title: string;
  tagline: string;
  images?: HeroImage[];
  content?: Partial<SiteContent> | null;
}

const DEFAULT_ALT = 'DALTA Esports official tournament organization';

export default function HeroSlideshow({ title, tagline, images = [], content }: Props) {
  // 1. Direct slide uploads from Site Text media editor
  const uploadedSlidePaths = [
    content?.home_slide_1_path,
    content?.home_slide_2_path,
    content?.home_slide_3_path,
    content?.home_slide_4_path,
    content?.home_slide_5_path,
  ].filter(Boolean) as string[];

  const uploadedSlides = uploadedSlidePaths
    .map((path, idx) => ({
      url: siteImageUrl(path) ?? '',
      alt: `DALTA Esports Tournament Showcase ${idx + 1}`,
    }))
    .filter((s) => Boolean(s.url));

  // 2. Carousel table images
  const customSlides = images
    .map((img) => ({
      url: siteImageUrl(img.image_path) ?? '',
      alt: img.caption || 'DALTA Esports tournament',
    }))
    .filter((s) => Boolean(s.url));

  // 3. Nothing uploaded: one slide with the hero banner (uploaded one, or the photo in /public).
  //    Only the org's own images are shown on the official site, no third-party stock photos.
  const fallbackSlides = [{ url: heroBannerUrl(content), alt: DEFAULT_ALT }];

  const slides =
    uploadedSlides.length > 0
      ? uploadedSlides
      : customSlides.length > 0
      ? customSlides
      : fallbackSlides;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length, paused]);

  return (
    <section
      aria-label="DALTA Esports Hero"
      className="@container relative w-full rounded-2xl overflow-hidden border border-stone-200/90 shadow-md bg-stone-950 min-h-[520px] sm:min-h-[600px] @5xl:min-h-[660px] flex items-center justify-center animate-hero-entrance"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Background Slideshow Images */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {slides.map((slide, idx) => (
          <div
            key={slide.url}
            className={`absolute inset-0 transition-[opacity,transform] duration-1000 ease-in-out ${
              idx === current ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
            }`}
          >
            <Image
              src={slide.url}
              alt={slide.alt}
              fill
              sizes="100vw"
              priority={idx === 0}
              className="object-cover object-center"
            />
          </div>
        ))}
      </div>

      {/* Dark semi-transparent overlay ensuring high-contrast readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/75 backdrop-blur-[1px]" />
      {/* Slow brand glow + triangle grid over the photo, under the text */}
      <AmbientBackground onDark />

      {/* Foreground Hero Content */}
      <div className="relative z-10 w-full px-4 py-14 sm:px-12 sm:py-20 text-center space-y-6 sm:space-y-8 max-w-6xl mx-auto">
        {/* Hero Title: one line. "DALTA ESPORTS" is ~9 font-sizes wide, so the size is the hero's
            width (100cqi, the section is a container) minus the side padding, divided by 9 (by 9.3
            from sm, where the letter spacing is wider), capped at 7rem. It may wrap only on
            phones narrower than 340px. */}
        <h1 className="font-black text-hero sm:text-[length:clamp(1.75rem,calc((100cqi_-_6rem)/9.3),7rem)] tracking-tight sm:tracking-normal uppercase leading-[1.02] drop-shadow-xl animate-hero-title min-[340px]:whitespace-nowrap">
          {title.toUpperCase().includes('DALTA') ? (
            <>
              <span className="text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]">DALTA</span>{' '}
              <span className="text-gold text-glow-gold">ESPORTS</span>
            </>
          ) : (
            <span className="text-gold text-glow-gold">{title}</span>
          )}
        </h1>

        {/* Hero Tagline */}
        <p className="text-stone-100 text-base sm:text-xl @5xl:text-2xl max-w-4xl mx-auto font-medium leading-relaxed drop-shadow-md animate-hero-tagline">
          {tagline}
        </p>

        {/* Modern Rounded CTA Buttons */}
        <div className="flex flex-wrap justify-center items-center gap-4 pt-2 animate-hero-cta">
          <Link
            href="/auth/register"
            className="px-8 py-3.5 rounded-xl bg-gold text-stone-950 font-black text-xs sm:text-sm uppercase tracking-widest border border-amber-300 shadow-md hover:bg-golddark hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
          >
            Join DALTA Esports
          </Link>
          <Link
            href="/divisions"
            className="px-8 py-3.5 rounded-xl bg-white/10 text-white font-extrabold text-xs sm:text-sm uppercase tracking-widest border border-white/30 backdrop-blur-md hover:bg-white/20 hover:border-white/50 hover:-translate-y-0.5 transition-all duration-200"
          >
            Explore Our Team
          </Link>
        </div>

        {/* Slide Indicator Dots */}
        {slides.length > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4" aria-label="Slideshow pagination">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === current}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current ? 'w-8 bg-gold' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

