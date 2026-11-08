'use client';

import { useState } from 'react';
import Image from 'next/image';
import { initialsOf } from '@/utils/avatars';

const sizes = {
  xs: { box: 'h-6 w-6 text-[10px]', px: 24 },
  sm: { box: 'h-8 w-8 text-xs', px: 32 },
  md: { box: 'h-10 w-10 text-sm', px: 40 },
  lg: { box: 'h-16 w-16 text-xl', px: 64 },
  xl: { box: 'h-28 w-28 text-3xl', px: 112 },
} as const;

interface Props {
  url?: string | null;
  name?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

// Profile picture (avatars bucket), or the person's initials on a gold circle when there is none
// or the image can't load. Decorative next to a visible name, so the alt text is empty then.
export default function Avatar({ url, name, size = 'md', className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const { box, px } = sizes[size];
  const base = `relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${box} ${className}`;

  if (url && !failed) {
    return (
      <span className={`${base} bg-stone-200`}>
        <Image
          src={url}
          alt={name ? `${name}'s profile picture` : 'Profile picture'}
          width={px}
          height={px}
          // Already resized to 512x512 WebP when uploaded
          unoptimized
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className={`${base} bg-gold font-black text-stone-950`} aria-hidden={name ? true : undefined}>
      {initialsOf(name)}
    </span>
  );
}
