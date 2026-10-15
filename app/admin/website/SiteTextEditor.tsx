'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { DEFAULT_LOGO, SITE_CONTENT_FIELDS } from '@/utils/site';
import { deleteSiteImage } from '@/utils/site-images';
import { refreshSite } from './actions';
import ImageField from './ImageField';

const inputClass =
  'w-full rounded border border-[#00d2ff]/40 bg-[#0a0a0c] px-3 py-2 text-white outline-none focus:border-[#00d2ff]';

// The image keys in site_content (the texts come from SITE_CONTENT_FIELDS)
const IMAGE_KEYS = [
  { key: 'logo_path', label: `Logo (empty = ${DEFAULT_LOGO})` },
  { key: 'about_image_path', label: 'About Us photo' },
];

const groups = [...new Set(SITE_CONTENT_FIELDS.map((f) => f.group))];

// All texts of the site (hero, About Us, footer, social links) plus the logo and About photo.
export default function SiteTextEditor() {
  const supabase = createClient();
  // What is saved, and what is being edited
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
        key, value: values[key].trim(), updated_by: session?.user.id ?? null, updated_at: new Date().toISOString(),
      }));
      // upsert: adds keys that don't exist yet, updates the rest
      const { data, error: saveError } = await supabase.from('site_content').upsert(rows).select('key');
      if (saveError) throw saveError;
      if (!data || data.length !== rows.length) throw new Error('Not everything was saved. Are you logged in as an admin?');

      // Old images that were replaced or removed
      for (const { key } of IMAGE_KEYS) {
        if (changedKeys.includes(key) && saved[key]) await deleteSiteImage(supabase, saved[key]);
      }
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
    // Images uploaded but not saved are deleted again
    for (const { key } of IMAGE_KEYS) {
      if (values[key] && values[key] !== saved[key]) await deleteSiteImage(supabase, values[key]);
    }
    setValues(saved);
  };

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>}
      {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

      <section className="bg-[#1a1a2e] border border-[#00d2ff]/20 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {IMAGE_KEYS.map(({ key, label }) => (
          <ImageField
            key={key}
            label={label}
            value={values[key] || null}
            folder="site"
            onChange={(path) => setValues((v) => ({ ...v, [key]: path ?? '' }))}
          />
        ))}
      </section>

      {groups.map((group) => (
        <section key={group} className="bg-[#1a1a2e] border border-[#00d2ff]/20 rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-[#00d2ff]">{group}</h3>
          {SITE_CONTENT_FIELDS.filter((f) => f.group === group).map((f) => (
            <label key={f.key} className="block text-sm font-semibold text-gray-300">
              {f.label}
              {f.multiline ? (
                <textarea value={values[f.key] ?? ''} rows={5}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={`${inputClass} mt-1 font-normal`} />
              ) : (
                <input value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={`${inputClass} mt-1 font-normal`} />
              )}
            </label>
          ))}
        </section>
      ))}

      {/* Stays visible while scrolling through the long form */}
      <div className="sticky bottom-0 bg-[#0a0a0c]/95 border-t border-[#00d2ff]/30 py-3 flex items-center gap-4">
        <button onClick={handleSave} disabled={busy || changedKeys.length === 0}
          className="bg-[#00d2ff] text-black px-6 py-2 rounded-lg font-bold hover:bg-[#00b8e6] disabled:opacity-50">
          {busy ? 'Saving...' : `Save changes${changedKeys.length ? ` (${changedKeys.length})` : ''}`}
        </button>
        {changedKeys.length > 0 && (
          <button onClick={handleUndo} disabled={busy} className="text-gray-400 hover:text-white">Undo changes</button>
        )}
      </div>
    </div>
  );
}
