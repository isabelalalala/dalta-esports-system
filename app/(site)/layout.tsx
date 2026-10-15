import Link from 'next/link';
import Image from 'next/image';
import { getSiteContent } from '@/utils/site-data';
import { DEFAULT_LOGO, logoUrl } from '@/utils/site';
import SiteAuthButtons from '@/components/site/SiteAuthButtons';
import SiteSearchBox from '@/components/site/SiteSearchBox';

// Side navigation from the wireframe
const navLinks = [
  { href: '/about', label: 'About Us' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/events', label: 'Events' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/divisions', label: 'Game Divisions' },
  { href: '/community', label: 'Community' },
];

// Layout of the public website (the "(site)" folder doesn't appear in the URL).
// Wireframe structure, on a dark background with the logo's yellow and brown.
export default async function SiteLayout({ children }: LayoutProps<'/'>) {
  const content = await getSiteContent();
  const logo = logoUrl(content);

  return (
    <div className="flex-1 bg-sitebg text-gray-200">
      {/* Top bar: logo, search, log in */}
      <header className="border-b-2 border-brown bg-sitecard">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={logo}
              alt="DALTA Esports logo"
              width={44}
              height={44}
              unoptimized={logo !== DEFAULT_LOGO}
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

      <div className="max-w-7xl mx-auto px-4 py-6 lg:flex lg:gap-8">
        {/* Side nav: a column on large screens, a menu on phones */}
        <nav aria-label="Site" className="lg:w-48 lg:shrink-0 mb-6 lg:mb-0">
          <details className="lg:hidden border-2 border-brown bg-sitecard">
            <summary className="px-4 py-2 font-pixel text-[10px] text-gold cursor-pointer">Menu</summary>
            <ul className="border-t-2 border-brown">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block px-4 py-2 hover:bg-brown/40">{l.label}</Link>
                </li>
              ))}
            </ul>
          </details>
          <ul className="hidden lg:block sticky top-6 border-2 border-brown bg-sitecard shadow-[4px_4px_0_var(--color-brown)]">
            {navLinks.map((l) => (
              <li key={l.href} className="border-b-2 border-brown last:border-b-0">
                <Link href={l.href} className="block px-4 py-3 text-sm font-semibold hover:bg-brown/40 hover:text-gold">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
