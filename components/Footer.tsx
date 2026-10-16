import Link from 'next/link';
import Image from 'next/image';
import { getSiteContent } from '@/utils/site-data';
import { DEFAULT_LOGO, logoUrl } from '@/utils/site';

// Footer on every page (added in app/layout.tsx), from the wireframe. The texts and social
// links are edited on /admin/website. Hidden when printing reports.
export default async function Footer() {
  const content = await getSiteContent();
  const logo = logoUrl(content);

  const socials = [
    { label: 'Facebook', href: content.social_facebook },
    { label: 'Instagram', href: content.social_instagram },
    { label: 'TikTok', href: content.social_tiktok },
    { label: 'YouTube', href: content.social_youtube },
  ].filter((s) => s.href.startsWith('https://'));  // only real web links

  return (
    <footer className="bg-sitecard border-t-2 border-brown text-gray-400 text-sm px-4 py-8 print:hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
        <div className="flex items-center gap-3">
          <Image
            src={logo}
            alt="DALTA Esports logo"
            width={48}
            height={48}
            unoptimized={logo !== DEFAULT_LOGO}
            className="border-2 border-gold bg-white"
          />
          <p className="font-pixel text-gold text-[10px] leading-relaxed">{content.footer_tagline}</p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-1">
          <Link href="/about" className="hover:text-gold">About Us</Link>
          <Link href="/divisions" className="hover:text-gold">Esports Division</Link>
          <Link href="/community" className="hover:text-gold">Community</Link>
          <Link href="/privacy" className="hover:text-gold">Privacy Notice</Link>
        </nav>

        <div>
          <p className="font-semibold text-gray-200 mb-1">Connect With Us</p>
          {socials.length === 0 && !content.contact_email && <p className="text-gray-400">Links coming soon.</p>}
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noreferrer" className="hover:text-gold">{s.label}</a>
              </li>
            ))}
            {content.contact_email && (
              <li><a href={`mailto:${content.contact_email}`} className="hover:text-gold">{content.contact_email}</a></li>
            )}
          </ul>
        </div>
      </div>
      <p className="max-w-7xl mx-auto mt-6 text-center text-xs text-gray-400">{content.footer_copyright}</p>
    </footer>
  );
}
