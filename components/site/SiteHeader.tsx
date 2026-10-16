import Link from 'next/link';
import Image from 'next/image';
import { getSiteContent } from '@/utils/site-data';
import { logoUrl } from '@/utils/site';
import SiteAuthButtons from './SiteAuthButtons';
import SiteSearchBox from './SiteSearchBox';

// The one header of the whole app (added in app/layout.tsx): logo, search, and
// Log in / Sign up, or Dashboard + notifications + Log out when logged in.
// Hidden when printing reports.
export default async function SiteHeader() {
  const content = await getSiteContent();
  const logo = logoUrl(content);

  return (
    <header className="border-b-2 border-brown bg-sitecard print:hidden">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={logo}
            alt="DALTA Esports logo"
            width={44}
            height={44}
            className="border-2 border-gold bg-white"
          />
          <span className="font-pixel text-gold text-xs sm:text-sm leading-relaxed">DALTA<br />ESPORTS</span>
        </Link>
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:flex sm:justify-center">
          <SiteSearchBox />
        </div>
        <SiteAuthButtons />
      </div>
    </header>
  );
}
