'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { DEFAULT_HERO_BANNER, DEFAULT_LOGO, SITE_CONTENT_FIELDS, siteImageUrl } from '@/utils/site';
import { clearSiteBannerClientCache } from '@/components/site/PageHeroBackground';
import { deleteSiteImage } from '@/utils/site-images';
import { refreshSite } from './actions';
import ImageField from './ImageField';

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

const BRAND_IMAGE_KEYS = [
  { key: 'logo_path', label: `Logo (default = ${DEFAULT_LOGO})`, folder: 'site', fallback: DEFAULT_LOGO },
  { key: 'about_image_path', label: 'About Us Hero Background Image', folder: 'site', fallback: '' },
];

const SLIDE_IMAGE_KEYS = [
  { key: 'home_slide_1_path', label: 'Home Slideshow — Photo 1 (Primary)', folder: 'slides' },
  { key: 'home_slide_2_path', label: 'Home Slideshow — Photo 2', folder: 'slides' },
  { key: 'home_slide_3_path', label: 'Home Slideshow — Photo 3', folder: 'slides' },
  { key: 'home_slide_4_path', label: 'Home Slideshow — Photo 4', folder: 'slides' },
  { key: 'home_slide_5_path', label: 'Home Slideshow — Photo 5', folder: 'slides' },
];

const HERO_BANNER_KEY = {
  key: 'hero_banner_path',
  label: 'Default Hero Banner (Tournaments, Events, Community, Dashboard, etc.)',
  folder: 'banners',
  fallback: DEFAULT_HERO_BANNER,
  description: 'This background image is used across the main container hero banners on all pages unless a page-specific banner is set below.',
};

const PAGE_SPECIFIC_HERO_KEYS = [
  { key: 'tournaments_hero_bg_path', label: 'Tournaments Page Banner (Optional Override)', folder: 'banners' },
  { key: 'events_hero_bg_path', label: 'Events Page Banner (Optional Override)', folder: 'banners' },
  { key: 'community_hero_bg_path', label: 'Community Page Banner (Optional Override)', folder: 'banners' },
  { key: 'divisions_hero_bg_path', label: 'Game Divisions Banner (Optional Override)', folder: 'banners' },
  { key: 'campaigns_hero_bg_path', label: 'Campaigns Page Banner (Optional Override)', folder: 'banners' },
  { key: 'dashboard_hero_bg_path', label: 'Dashboard Banner (Optional Override)', folder: 'banners' },
];

const ALL_IMAGE_KEYS = [
  ...BRAND_IMAGE_KEYS,
  ...SLIDE_IMAGE_KEYS,
  HERO_BANNER_KEY,
  ...PAGE_SPECIFIC_HERO_KEYS,
];

const groups = [...new Set(SITE_CONTENT_FIELDS.map((f) => f.group))];

export default function SiteTextEditor() {
  const supabase = createClient();
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data, error: loadError } = await supabase.from('site_content').select('key, value');
      if (loadError) return setError(getErrorMessage(loadError, 'Failed to load the texts'));
      const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
      setSaved(map);
      setValues(map);
    };
    load();
  }, [supabase, reloadCount]);

  const changedKeys = Object.keys(values).filter((k) => (values[k] ?? '') !== (saved[k] ?? ''));

  const handleSave = async () => {
    for (const k of changedKeys) {
      const v = values[k].trim();
      if (k.startsWith('social_') && v && !v.startsWith('https://')) {
        return setError('Social links must start with https://');
      }
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const rows = changedKeys.map((key) => ({
        key,
        value: values[key].trim(),
        updated_by: session?.user.id ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { data, error: saveError } = await supabase.from('site_content').upsert(rows).select('key');
      if (saveError) throw saveError;
      if (!data || data.length !== rows.length) throw new Error('Not everything was saved. Are you logged in as an admin?');

      for (const { key } of ALL_IMAGE_KEYS) {
        if (changedKeys.includes(key) && saved[key]) await deleteSiteImage(supabase, saved[key]);
      }
      clearSiteBannerClientCache();
      await refreshSite();
      setMessage('Saved. The website is updated.');
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save'));
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    for (const { key } of ALL_IMAGE_KEYS) {
      if (values[key] && values[key] !== saved[key]) await deleteSiteImage(supabase, values[key]);
    }
    setValues(saved);
  };

  const activeMainBanner = values.hero_banner_path ? (siteImageUrl(values.hero_banner_path) || DEFAULT_HERO_BANNER) : DEFAULT_HERO_BANNER;

  return (
    <div className="space-y-6 text-stone-950">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
          {message}
        </div>
      )}

      {/* 1. Brand & Organization Assets */}
      <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-black text-amber-700 tracking-wider uppercase">
            Brand & Identity Photos
          </h3>
          <p className="text-xs text-stone-500 font-medium normal-case mt-0.5">
            Official organization logo and About Us story photo.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {BRAND_IMAGE_KEYS.map(({ key, label, folder, fallback }) => (
            <ImageField
              key={key}
              label={label}
              value={values[key] || null}
              fallbackUrl={fallback}
              folder={folder}
              onChange={(path) => setValues((v) => ({ ...v, [key]: path ?? '' }))}
            />
          ))}
        </div>
      </section>

      {/* 2. Home Page Hero Slideshow Backgrounds */}
      <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-black text-amber-700 tracking-wider uppercase">
            Home Page Hero Slideshow Backgrounds
          </h3>
          <p className="text-xs text-stone-500 font-medium normal-case mt-0.5">
            Upload custom background photos that automatically rotate on the Home Page hero container (5-second intervals). If empty, curated default stage imagery is displayed.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {SLIDE_IMAGE_KEYS.map(({ key, label, folder }) => (
            <ImageField
              key={key}
              label={label}
              value={values[key] || null}
              folder={folder}
              onChange={(path) => setValues((v) => ({ ...v, [key]: path ?? '' }))}
            />
          ))}
        </div>
      </section>

      {/* 3. Main Container Hero Banner Backgrounds */}
      <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h3 className="text-base sm:text-lg font-black text-amber-700 tracking-wider uppercase">
            Page Hero Banner Backgrounds
          </h3>
          <p className="text-xs text-stone-500 font-medium normal-case mt-0.5">
            Change the background photo displayed across the main container hero banners. The default hero banner applies across all pages. You can also specify unique banners for individual sections below.
          </p>
        </div>

        {/* Primary Default Hero Banner */}
        <div className="p-4 sm:p-5 rounded-xl bg-stone-50 border border-stone-200">
          <ImageField
            label={HERO_BANNER_KEY.label}
            value={values[HERO_BANNER_KEY.key] || null}
            fallbackUrl={HERO_BANNER_KEY.fallback}
            description={HERO_BANNER_KEY.description}
            folder={HERO_BANNER_KEY.folder}
            onChange={(path) => setValues((v) => ({ ...v, [HERO_BANNER_KEY.key]: path ?? '' }))}
          />
        </div>

        {/* Section Overrides */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-black text-stone-700 tracking-widest uppercase">
            Optional Section Hero Overrides
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PAGE_SPECIFIC_HERO_KEYS.map(({ key, label, folder }) => (
              <ImageField
                key={key}
                label={label}
                value={values[key] || null}
                fallbackUrl={activeMainBanner}
                folder={folder}
                onChange={(path) => setValues((v) => ({ ...v, [key]: path ?? '' }))}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Text Groups */}
      {groups.map((group) => (
        <section key={group} className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <h3 className="text-base sm:text-lg font-black text-amber-700 tracking-wider uppercase pb-2 border-b border-stone-100">
            {group}
          </h3>
          <div className="space-y-4">
            {SITE_CONTENT_FIELDS.filter((f) => f.group === group).map((f) => (
              <label key={f.key} className="block text-xs font-black text-stone-800 tracking-wider uppercase">
                <span className="block mb-1.5">{f.label}</span>
                {f.multiline ? (
                  <textarea
                    value={values[f.key] ?? ''}
                    rows={4}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className={`${inputClass} font-normal`}
                  />
                ) : (
                  <input
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className={`${inputClass} font-normal`}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      {/* Floating Save Actions Bar */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-2xl p-4 shadow-md flex items-center justify-between gap-4">
        <div className="text-xs font-black text-stone-700 tracking-wider">
          {changedKeys.length > 0 ? (
            <span className="text-amber-700">{changedKeys.length} unsaved changes</span>
          ) : (
            <span>All text changes up to date</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {changedKeys.length > 0 && (
            <button
              onClick={handleUndo}
              disabled={busy}
              className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-4 py-2 text-xs tracking-wider transition-all cursor-pointer"
            >
              Undo
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={busy || changedKeys.length === 0}
            className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
