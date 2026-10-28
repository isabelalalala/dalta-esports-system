import type { ReactNode } from 'react';
import Image from 'next/image';
import { Gamepad2 } from 'lucide-react';
import { siteImageUrl } from '@/utils/site';

// Small building blocks shared by the public website pages
// Softened & refined: Natural border-radius, thin intentional borders, polished empty states.

// Page heading in uppercase Montserrat
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-8 space-y-2">
      <h1 className="font-black text-stone-950 text-2xl sm:text-4xl tracking-wider uppercase leading-tight">{title}</h1>
      {subtitle && <p className="text-stone-600 text-sm sm:text-base font-semibold tracking-wide uppercase">{subtitle}</p>}
    </header>
  );
}

// A softened, rounded container box
export function SiteBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200/90 bg-white shadow-xs p-6 sm:p-8 hover:shadow-md transition-shadow ${className}`}>
      {children}
    </div>
  );
}

// Section heading inside a page
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-black text-stone-950 text-lg sm:text-xl tracking-wider uppercase mb-4">{children}</h2>;
}

// Polished empty state with soft background and clean typography
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="w-full rounded-2xl border border-stone-200/80 bg-stone-50/70 p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-1.5 shadow-xs">
      <p className="text-stone-800 font-extrabold text-sm uppercase tracking-wider">{children}</p>
      <p className="text-stone-500 text-xs font-semibold uppercase tracking-wide">Nothing published here yet</p>
    </div>
  );
}

// Text typed in /admin/website: keep the line breaks the admin typed
export function Paragraphs({ text }: { text: string }) {
  if (!text) return null;
  return <p className="whitespace-pre-wrap leading-relaxed text-stone-800 font-medium uppercase tracking-wide">{text}</p>;
}

// Photo from the site-images bucket, or the person's initials when there is none
const photoSizes = { sm: 'w-14 h-14', md: 'w-24 h-24', lg: 'w-40 h-40' };

export function PersonPhoto({ path, name, size = 'md' }: { path: string | null; name: string; size?: keyof typeof photoSizes }) {
  const url = siteImageUrl(path);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <div className={`relative shrink-0 rounded-xl border border-stone-200/90 bg-amber-50/60 overflow-hidden grid place-items-center shadow-xs ${photoSizes[size]}`}>
      {url ? (
        <Image src={url} alt={name} fill sizes="160px" className="object-cover" />
      ) : (
        <span className="font-black text-[#5B271E] text-sm uppercase tracking-wider" aria-hidden>{initials || '?'}</span>
      )}
    </div>
  );
}

// A person (officer, coach, player): large portrait photoholder, name, position, and optional game
export function PersonCard({
  name,
  line,
  photoPath,
  extra,
}: {
  name: string;
  line?: string;
  photoPath: string | null;
  extra?: string;
}) {
  const url = siteImageUrl(photoPath);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="group flex flex-col rounded-2xl sm:rounded-3xl border border-stone-200/90 bg-white shadow-xs hover:shadow-lg hover:-translate-y-1 hover:border-amber-500/50 transition-all duration-300 overflow-hidden">
      {/* Large photoholder with portrait aspect ratio */}
      <div className="relative aspect-[3/4] w-full bg-stone-100 overflow-hidden border-b border-stone-100">
        {url ? (
          <Image
            src={url}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
            className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-stone-100 to-stone-50/40 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-stone-200/90 shadow-2xs flex items-center justify-center text-[#5B271E] font-black text-xl sm:text-2xl uppercase tracking-wider mb-2">
              {initials || '?'}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              DALTA Esports
            </span>
          </div>
        )}
      </div>

      {/* Details below photo */}
      <div className="p-4 sm:p-5 flex flex-col justify-start text-left flex-1 space-y-1">
        <h4 className="font-black text-stone-950 text-base sm:text-lg uppercase tracking-wide leading-snug group-hover:text-[#FFCC37] transition-colors">
          {name}
        </h4>
        {line && (
          <p className="text-xs sm:text-sm font-extrabold text-[#5B271E] uppercase tracking-wider">
            {line}
          </p>
        )}
        {extra && (
          <div className="pt-2 mt-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200/80 text-[10px] sm:text-[11px] font-black text-stone-700 uppercase tracking-wider">
              <Gamepad2 className="h-3.5 w-3.5 text-[#5B271E] shrink-0" />
              <span className="truncate">{extra}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
