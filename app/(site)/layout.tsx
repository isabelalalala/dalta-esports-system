import Link from 'next/link';

// Side navigation from the wireframe
const navLinks = [
  { href: '/about', label: 'About Us' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/events', label: 'Events' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/divisions', label: 'Game Divisions' },
  { href: '/community', label: 'Community' },
];

// Layout of the public website (the "(site)" folder doesn't appear in the URL): the side nav
// from the wireframe. The header (components/site/SiteHeader.tsx) is on every page, in app/layout.tsx.
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex-1 bg-sitebg text-gray-200">
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

        <main id="main-content" className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
