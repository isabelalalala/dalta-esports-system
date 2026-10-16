import type { ReactNode } from 'react';
import Image from 'next/image';
import { siteImageUrl } from '@/utils/site';

// Small building blocks shared by the public website pages

// Page heading in the pixel font, with an optional line under it
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-8 space-y-2">
      <h1 className="font-pixel text-gold text-xl sm:text-2xl leading-relaxed">{title}</h1>
      {subtitle && <p className="text-gray-400">{subtitle}</p>}
    </header>
  );
}

// A bordered box in the wireframe style
export function SiteBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-2 border-brownlight bg-sitecard shadow-[4px_4px_0_var(--color-brown)] p-5 ${className}`}>
      {children}
    </div>
  );
}

// Section heading inside a page
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-pixel text-gold text-sm sm:text-base leading-relaxed mb-4">{children}</h2>;
}

// Shown when a list has nothing published yet
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-gray-400 border-2 border-dashed border-brown p-6 text-center">{children}</p>;
}

// Text typed in /admin/website: keep the line breaks the admin typed
export function Paragraphs({ text }: { text: string }) {
  if (!text) return null;
  return <p className="whitespace-pre-wrap leading-relaxed text-gray-300">{text}</p>;
}

// Photo from the site-images bucket, or the person's initials when there is none
const photoSizes = { sm: 'w-14 h-14', md: 'w-24 h-24', lg: 'w-40 h-40' };

export function PersonPhoto({ path, name, size = 'md' }: { path: string | null; name: string; size?: keyof typeof photoSizes }) {
  const url = siteImageUrl(path);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <div className={`relative shrink-0 border-2 border-gold bg-brown overflow-hidden grid place-items-center ${photoSizes[size]}`}>
      {url ? (
        <Image src={url} alt={name} fill unoptimized className="object-cover" />
      ) : (
        <span className="font-pixel text-gold text-xs" aria-hidden>{initials || '?'}</span>
      )}
    </div>
  );
}

// A person (officer, coach, player): photo, name and a line under it
export function PersonCard({ name, line, photoPath, extra }: {
  name: string;
  line?: string;
  photoPath: string | null;
  extra?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 border-2 border-brownlight bg-sitecard p-4 shadow-[4px_4px_0_var(--color-brown)]">
      <PersonPhoto path={photoPath} name={name} />
      <div>
        <p className="font-bold text-white">{name}</p>
        {line && <p className="text-sm text-gold">{line}</p>}
        {extra && <p className="text-xs text-gray-400 mt-0.5">{extra}</p>}
      </div>
    </div>
  );
}
