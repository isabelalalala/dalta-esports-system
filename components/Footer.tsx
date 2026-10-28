import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { getSiteContent } from '@/utils/site-data';
import { DEFAULT_LOGO, DEFAULT_SITE_CONTENT, logoUrl, type SiteContent } from '@/utils/site';

// Footer on every page (added in app/layout.tsx), from the wireframe. The texts and social
// links are edited on /admin/website.
// Wrapped in Suspense to prevent blocking prerendering in RootLayout.
export default function Footer() {
  return (
    <Suspense fallback={<FooterBody content={DEFAULT_SITE_CONTENT} logo={DEFAULT_LOGO} />}>
      <AsyncFooter />
    </Suspense>
  );
}

async function AsyncFooter() {
  const content = await getSiteContent();
  const logo = logoUrl(content);
  return <FooterBody content={content} logo={logo} />;
}

function FooterBody({ content, logo }: { content: SiteContent; logo: string }) {
  const socials = [
    { label: 'Facebook', href: content.social_facebook },
    { label: 'Instagram', href: content.social_instagram },
    { label: 'TikTok', href: content.social_tiktok },
    { label: 'YouTube', href: content.social_youtube },
  ].filter((s) => s.href.startsWith('https://'));  // only real web links

  return (
    <footer className="w-full bg-white border-t border-stone-200/90 text-stone-700 text-sm px-6 sm:px-8 lg:px-12 py-12 uppercase print:hidden">
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
        <div className="flex items-start gap-4 sm:col-span-2 lg:col-span-1">
          <Image
            src={logo}
            alt="DALTA Esports logo"
            width={52}
            height={52}
            className="rounded-xl border border-stone-200 bg-white shadow-xs shrink-0 object-contain p-1"
          />
          <div>
            <p className="font-extrabold text-stone-950 text-xs sm:text-sm leading-tight tracking-wider uppercase">{content.footer_tagline}</p>
            <p className="text-xs text-[#5B271E] font-bold tracking-widest mt-1">UPHSD - Molino Campus</p>
          </div>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2">
          <p className="font-extrabold text-stone-950 text-xs tracking-widest mb-1">Pages</p>
          <Link href="/about" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">About Us</Link>
          <Link href="/divisions" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Esports Division</Link>
          <Link href="/community" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Community</Link>
          <Link href="/tournaments" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Tournaments</Link>
        </nav>

        <nav aria-label="Legal" className="flex flex-col gap-2">
          <p className="font-extrabold text-stone-950 text-xs tracking-widest mb-1">Compliance & Policies</p>
          <Link href="/privacy" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Privacy Notice</Link>
          <Link href="/terms" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Terms of Service</Link>
          <Link href="/conduct" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Code of Conduct</Link>
          <Link href="/cookies" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Cookie Policy</Link>
          <Link href="/security" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">Security</Link>
        </nav>

        <div>
          <p className="font-extrabold text-stone-950 text-xs tracking-widest mb-2">Connect With Us</p>
          {socials.length === 0 && !content.contact_email && <p className="text-stone-500 text-xs">Links coming soon.</p>}
          <ul className="flex flex-col gap-2">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noreferrer" className="hover:text-[#FFCC37] font-semibold tracking-wide transition-colors">
                  {s.label} →
                </a>
              </li>
            ))}
            {content.contact_email && (
              <li className="mt-2 pt-2 border-t border-stone-200">
                <a href={`mailto:${content.contact_email}`} className="text-xs text-amber-800 hover:underline font-bold">
                  {content.contact_email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <p className="w-full mt-10 pt-6 border-t border-stone-200 text-center text-xs text-stone-500 font-medium tracking-widest">
        {content.footer_copyright}
      </p>
    </footer>
  );
}
