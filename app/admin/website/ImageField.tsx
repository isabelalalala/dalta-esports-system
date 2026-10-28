'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { siteImageUrl } from '@/utils/site';
import { uploadSiteImage } from '@/utils/site-images';

interface Props {
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  folder: string;
  required?: boolean;
  fallbackUrl?: string;
  description?: string;
}

export default function ImageField({
  label,
  value,
  onChange,
  folder,
  required = false,
  fallbackUrl,
  description,
}: Props) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const url = siteImageUrl(value);
  const displayUrl = url || fallbackUrl;
  const isFallback = !url && Boolean(fallbackUrl);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      onChange(await uploadSiteImage(supabase, file, folder));
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2 text-stone-950">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-stone-800 tracking-wider uppercase">{label}</p>
        {isFallback && (
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
            Using Default
          </span>
        )}
      </div>
      {description && <p className="text-[11px] text-stone-500 font-medium normal-case">{description}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-32 h-20 rounded-xl border border-stone-300 bg-stone-100 overflow-hidden grid place-items-center shadow-2xs">
          {displayUrl ? (
            <Image src={displayUrl} alt="" fill sizes="128px" className="object-cover" />
          ) : (
            <span className="text-[11px] text-stone-400 font-semibold uppercase">No photo</span>
          )}
        </div>
        <label className="cursor-pointer rounded-xl bg-gold hover:bg-golddark border border-amber-400 text-stone-950 px-4 py-2 text-xs font-black uppercase tracking-wider shadow-xs hover:-translate-y-0.5 transition-all">
          {uploading ? 'Uploading...' : url ? 'Replace' : isFallback ? 'Change Photo' : 'Upload Photo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
        {url && !required && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-bold text-red-600 hover:text-red-700 uppercase underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
      <p className="text-stone-400 text-xs font-medium">PNG, JPG, WebP or GIF, max 5 MB.</p>
      {error && <p className="text-xs font-bold text-red-600" role="alert">{error}</p>}
    </div>
  );
}
