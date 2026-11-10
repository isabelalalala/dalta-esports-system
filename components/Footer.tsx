import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import {
  Cookie, FileText, Lock, Mail, Scale, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS } from '@/utils/navigation';
import { NAV_ICONS } from '@/components/nav-icons';
import { getSiteContent } from '@/utils/site-data';
import { DEFAULT_LOGO, DEFAULT_SITE_CONTENT, logoUrl, type SiteContent } from '@/utils/site';
import { SOCIAL_NAMES, SocialIcon, type SocialPlatform } from '@/components/BrandIcons';
import Tooltip from '@/components/Tooltip';
import AmbientBackground from '@/components/site/AmbientBackground';
import BackToTop from '@/components/site/BackToTop';

// Footer on every page (added in app/layout.tsx). The texts, social links and contact email are
// edited on /admin/website (Site text): a social button only appears once its link is filled in.
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

// Text labels stay next to the icons: an icon alone would make people guess
// Same names and icons as the menu (utils/navigation.ts)
const PAGES: { href: string; label: string; icon: LucideIcon }[] = [
  NAV_ITEMS.about, NAV_ITEMS.divisions, NAV_ITEMS.hallOfFame, NAV_ITEMS.community, NAV_ITEMS.tournaments, NAV_ITEMS.help,
].map((item) => ({ href: item.href, label: item.label, icon: NAV_ICONS[item.icon] }));

const POLICIES: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/privacy', label: 'Privacy Notice', icon: Lock },
  { href: '/terms', label: 'Terms of Service', icon: FileText },
  { href: '/conduct', label: 'Code of Conduct', icon: Scale },
  { href: '/cookies', label: 'Cookie Policy', icon: Cookie },
  { href: '/security', label: 'Security', icon: ShieldCheck },
];

const linkClass =
  'group inline-flex items-center gap-2.5 rounded-md font-semibold uppercase tracking-wide text-stone-700 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon transition-colors';
const headingClass = 'font-extrabold text-stone-950 text-xs uppercase tracking-widest mb-1';

function LinkList({ label, title, links }: { label: string; title: string; links: typeof PAGES }) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2.5 min-w-0">
      <p className={headingClass}>{title}</p>
      {links.map(({ href, label: text, icon: Icon }) => (
        <Link key={href} href={href} className={linkClass}>
          <Icon className="size-4 shrink-0 text-maroon group-hover:text-golddeep transition-colors" aria-hidden="true" />
          <span>{text}</span>
        </Link>
      ))}
    </nav>
  );
}

function FooterBody({ content, logo }: { content: SiteContent; logo: string }) {
  const socials = (
    [
      ['facebook', content.social_facebook],
      ['instagram', content.social_instagram],
      ['tiktok', content.social_tiktok],
      ['youtube', content.social_youtube],
      ['discord', content.social_discord],
    ] as [SocialPlatform, string][]
  ).filter(([, href]) => href?.startsWith('https://')); // only real web links, never placeholders
  // The admin text usually reads "© 2026 DALTA Esports"; the bottom bar adds the rights line
  const copyright = content.footer_copyright?.trim() || '© 2026 DALTA Esports';

  return (
    <footer className="relative isolate overflow-hidden w-full bg-white border-t border-stone-200/90 text-stone-700 text-sm print:hidden">
      {/* lively: the same living background as the homepage band (third glow + rising sparks) */}
      <AmbientBackground lively className="-z-10" />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 pt-12 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-x-8 gap-y-10 items-start">
          <div className="flex items-start gap-4 sm:col-span-2 lg:col-span-1">
            <Image
              src={logo}
              alt="DALTA Esports logo"
              width={52}
              height={52}
              className="rounded-xl border border-stone-200 bg-white shadow-xs shrink-0 object-contain p-1"
            />
            <div>
              <p className="font-extrabold text-stone-950 text-xs sm:text-sm leading-tight">{content.footer_tagline}</p>
              <p className="text-xs text-maroon font-bold uppercase tracking-widest mt-1">UPHSD - Molino Campus</p>
            </div>
          </div>

          <LinkList label="Footer" title="Pages" links={PAGES} />
          <LinkList label="Legal" title="Compliance & Policies" links={POLICIES} />

          <div className="min-w-0">
            <p className={`${headingClass} mb-3`}>Connect With Us</p>
            {socials.length === 0 && !content.contact_email && (
              <p className="text-stone-600 text-xs">Our social pages will be listed here soon.</p>
            )}
            {socials.length > 0 && (
              <ul className="flex flex-wrap gap-2.5">
                {socials.map(([platform, href]) => (
                  <li key={platform}>
                    <Tooltip text={`DALTA Esports on ${SOCIAL_NAMES[platform]}`}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`DALTA Esports on ${SOCIAL_NAMES[platform]} (opens in a new tab)`}
                        className="grid size-11 place-items-center rounded-full border border-stone-300 bg-white text-stone-800 shadow-xs hover:bg-maroon hover:border-maroon hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon transition-colors"
                      >
                        <SocialIcon platform={platform} />
                      </a>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
            {content.contact_email && (
              <a href={`mailto:${content.contact_email}`} className={`${linkClass} mt-4 normal-case tracking-normal break-all`}>
                <Mail className="size-4 shrink-0 text-maroon group-hover:text-golddeep transition-colors" aria-hidden="true" />
                <span>{content.contact_email}</span>
              </a>
            )}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-stone-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          <p className="text-center sm:text-left text-xs text-stone-600 font-medium uppercase tracking-widest">
            {/rights reserved/i.test(copyright) ? copyright : `${copyright.replace(/\.?\s*$/, '')}. All Rights Reserved.`}
          </p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
