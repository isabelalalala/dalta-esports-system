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
  // Called with the new file's path (uploaded right away), or null for "Remove"
  onChange: (path: string | null) => void;
  folder: string;
  required?: boolean;
}

// Image picker for /admin/website: shows the current image, uploads a new one immediately
// and hands its path to the form. The form deletes the old file after saving.
export default function ImageField({ label, value, onChange, folder, required = false }: Props) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const url = siteImageUrl(value);

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
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-300">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-32 h-20 border border-gray-700 bg-black overflow-hidden grid place-items-center">
          {url ? <Image src={url} alt="" fill unoptimized className="object-cover" /> : <span className="text-xs text-gray-400">No image</span>}
        </div>
        <label className="cursor-pointer border border-gold text-gold px-3 py-1.5 text-sm font-bold hover:bg-gold/10">
          {uploading ? 'Uploading...' : url ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
        {url && !required && (
          <button type="button" onClick={() => onChange(null)} className="text-sm text-red-400 hover:underline">
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400">PNG, JPG, WebP or GIF, max 5 MB.</p>
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
