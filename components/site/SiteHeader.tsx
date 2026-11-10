import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { getSiteContent } from '@/utils/site-data';
import { DEFAULT_LOGO, logoUrl } from '@/utils/site';
import SiteAuthButtons from './SiteAuthButtons';
import SiteSearchBox from './SiteSearchBox';
import HeaderHeight from './HeaderHeight';
import { LivePill } from './LiveNow';

// The one header of the whole app (added in app/layout.tsx): logo, search, and
// Log in / Sign up, or Dashboard + notifications + Log out when logged in.
// Synchronous shell with suspended logo prevents blocking prerenders in RootLayout.
export default function SiteHeader() {
  return (
    <header id="site-header" className="w-full border-b border-stone-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40 print:hidden shadow-xs">
      <div className="w-full px-6 sm:px-8 lg:px-8 xl:px-12 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-4 gap-y-3 lg:gap-4 xl:gap-6">
        {/* Brand Logo & Wordmark */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <Suspense fallback={<LogoImage logo={DEFAULT_LOGO} />}>
            <HeaderLogo />
          </Suspense>
          <span className="flex flex-col justify-center font-black text-sm sm:text-lg leading-tight tracking-wider uppercase transition-colors">
            <span className="text-maroon">DALTA</span>
            <span className="font-extrabold text-xs sm:text-sm tracking-widest text-golddeep">ESPORTS</span>
          </span>
        </Link>

        {/* Search Bar - Center Axis */}
        <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-1 lg:min-w-0 lg:max-w-xl">
          <SiteSearchBox />
        </div>

        {/* Auth CTA Controls */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Pulsing LIVE pill while a stream is live (links straight to it). Suspense: it reads the
              path (to know whether the live banner is showing), which can't block the prerender. */}
          <Suspense fallback={null}>
            <LivePill />
          </Suspense>
          <SiteAuthButtons />
        </div>
      </div>
      <HeaderHeight targetId="site-header" />
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
      width={64}
      height={64}
      className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl border border-stone-200/90 bg-white shadow-xs group-hover:border-amber-500/50 transition-colors object-contain p-0.5"
    />
  );
}
