'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { DEFAULT_HERO_BANNER, siteImageUrl, type SiteContentKey } from '@/utils/site';
import { createClient } from '@/utils/supabase/client';

// Client-side cache to share between page navigations without duplicate queries
let cachedSiteBannerMap: Record<string, string> | null = null;
let cachedFetchPromise: Promise<Record<string, string>> | null = null;

export function clearSiteBannerClientCache() {
  cachedSiteBannerMap = null;
  cachedFetchPromise = null;
}

const BANNER_KEYS = [
  'hero_banner_path',
  'about_image_path',
  'tournaments_hero_bg_path',
  'events_hero_bg_path',
  'community_hero_bg_path',
  'divisions_hero_bg_path',
  'campaigns_hero_bg_path',
  'dashboard_hero_bg_path',
];

async function fetchBannerMap(): Promise<Record<string, string>> {
  if (cachedSiteBannerMap) return cachedSiteBannerMap;
  if (!cachedFetchPromise) {
    const supabase = createClient();
    cachedFetchPromise = (async () => {
      try {
        const { data } = await supabase
          .from('site_content')
          .select('key, value')
          .in('key', BANNER_KEYS);
        const map: Record<string, string> = {};
        for (const row of data || []) {
          if (row.value) map[row.key] = row.value;
        }
        cachedSiteBannerMap = map;
        return map;
      } catch {
        return {};
      } finally {
        cachedFetchPromise = null;
      }
    })();
  }
  return cachedFetchPromise;
}

interface PageHeroBackgroundProps {
  src?: string;
  specificKey?: SiteContentKey;
  alt?: string;
  priority?: boolean;
  className?: string;
  overlayClassName?: string;
}

export default function PageHeroBackground({
  src,
  specificKey,
  alt = 'DALTA Esports Banner',
  priority = true,
  className = 'object-cover object-center scale-105',
  overlayClassName = 'absolute inset-0 bg-stone-950/75',
}: PageHeroBackgroundProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (src) return src;
    if (cachedSiteBannerMap) {
      if (specificKey && cachedSiteBannerMap[specificKey]) {
        return siteImageUrl(cachedSiteBannerMap[specificKey]) ?? DEFAULT_HERO_BANNER;
      }
      if (cachedSiteBannerMap.hero_banner_path) {
        return siteImageUrl(cachedSiteBannerMap.hero_banner_path) ?? DEFAULT_HERO_BANNER;
      }
    }
    return DEFAULT_HERO_BANNER;
  });

  useEffect(() => {
    if (src) {
      return;
    }
    let cancelled = false;
    fetchBannerMap().then((map) => {
      if (cancelled) return;
      if (specificKey && map[specificKey]) {
        const url = siteImageUrl(map[specificKey]);
        if (url) return setResolvedSrc(url);
      }
      if (map.hero_banner_path) {
        const url = siteImageUrl(map.hero_banner_path);
        if (url) return setResolvedSrc(url);
      }
      setResolvedSrc(DEFAULT_HERO_BANNER);
    });
    return () => {
      cancelled = true;
    };
  }, [src, specificKey]);

  return (
    <div className="absolute inset-0 -z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <Image
        src={src ?? resolvedSrc}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 1200px"
        className={className}
        priority={priority}
      />
      <div className={overlayClassName} />
    </div>
  );
}
