import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { getSiteContent } from '@/utils/site-data';
import { DEFAULT_LOGO, logoUrl } from '@/utils/site';
import SiteAuthButtons from './SiteAuthButtons';
import SiteSearchBox from './SiteSearchBox';

// The one header of the whole app (added in app/layout.tsx): logo, search, and
// Log in / Sign up, or Dashboard + notifications + Log out when logged in.
// Synchronous shell with suspended logo prevents blocking prerenders in RootLayout.
export default function SiteHeader() {
  return (
    <header className="w-full border-b border-stone-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40 print:hidden shadow-xs">
      <div className="w-full px-6 sm:px-8 lg:px-12 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 sm:gap-6">
        {/* Brand Logo & Wordmark */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <Suspense fallback={<LogoImage logo={DEFAULT_LOGO} />}>
            <HeaderLogo />
          </Suspense>
          <span className="flex flex-col justify-center font-black text-xs sm:text-sm leading-tight tracking-wider uppercase transition-colors">
            <span style={{ color: '#5B271E' }} className="text-[#5B271E]">DALTA</span>
            <span style={{ color: '#C89300' }} className="font-extrabold text-[11px] sm:text-xs tracking-widest">ESPORTS</span>
          </span>
        </Link>

        {/* Search Bar - Center Axis */}
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-xl">
          <SiteSearchBox />
        </div>

        {/* Auth CTA Controls */}
        <div className="shrink-0 flex items-center">
          <SiteAuthButtons />
        </div>
      </div>
    </header>
  );
}

async function HeaderLogo() {
  const content = await getSiteContent();
  const logo = logoUrl(content);
  return <LogoImage logo={logo} />;
}

function LogoImage({ logo }: { logo: string }) {
  return (
    <Image
      src={logo}
      alt="DALTA Esports logo"
      width={40}
      height={40}
      className="rounded-xl border border-stone-200/90 bg-white shadow-xs group-hover:border-amber-500/50 transition-colors object-contain p-0.5"
    />
  );
}
