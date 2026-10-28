import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HERO_BANNER,
  DEFAULT_LOGO,
  DEFAULT_SITE_CONTENT,
  heroBannerUrl,
  logoUrl,
  siteImageUrl,
} from './site';

describe('site utils', () => {
  it('returns DEFAULT_HERO_BANNER when content is empty or null', () => {
    expect(heroBannerUrl(null)).toBe(DEFAULT_HERO_BANNER);
    expect(heroBannerUrl(undefined)).toBe(DEFAULT_HERO_BANNER);
    expect(heroBannerUrl(DEFAULT_SITE_CONTENT)).toBe(DEFAULT_HERO_BANNER);
  });

  it('uses hero_banner_path if set in content', () => {
    const url = heroBannerUrl({
      hero_banner_path: 'banners/test-banner.jpg',
    });
    expect(url).toContain('banners/test-banner.jpg');
    expect(url).toContain('site-images');
  });

  it('prefers specificKey over hero_banner_path if specificKey exists', () => {
    const url = heroBannerUrl(
      {
        hero_banner_path: 'banners/default.jpg',
        tournaments_hero_bg_path: 'banners/tournaments.jpg',
      },
      'tournaments_hero_bg_path'
    );
    expect(url).toContain('banners/tournaments.jpg');
  });

  it('falls back to hero_banner_path if specificKey is not provided or empty', () => {
    const url = heroBannerUrl(
      {
        hero_banner_path: 'banners/default.jpg',
        tournaments_hero_bg_path: '',
      },
      'tournaments_hero_bg_path'
    );
    expect(url).toContain('banners/default.jpg');
  });

  it('handles logoUrl fallback', () => {
    expect(logoUrl(DEFAULT_SITE_CONTENT)).toBe(DEFAULT_LOGO);
    const custom = logoUrl({
      ...DEFAULT_SITE_CONTENT,
      logo_path: 'site/custom-logo.png',
    });
    expect(custom).toContain('site/custom-logo.png');
  });

  it('builds site image URLs correctly', () => {
    expect(siteImageUrl(null)).toBeNull();
    expect(siteImageUrl('')).toBeNull();
    expect(siteImageUrl('slides/slide-1.png')).toContain('/storage/v1/object/public/site-images/slides/slide-1.png');
  });
});

