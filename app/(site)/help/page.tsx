import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { HELP_SECTIONS } from '@/utils/help';
import PageHeroBackground from '@/components/site/PageHeroBackground';
import HelpSectionView, { HELP_ICONS } from '@/components/HelpSectionView';
import OrganizerHelp from './OrganizerHelp';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  description: 'How DALTA Esports works: accounts, watching streams, Pick\'em, feedback, warnings, teams and registration.',
};

// Help page. The spectator and player questions (utils/help.ts) are public; the staff and admin
// questions (utils/help-organizer.ts, server only) are added by <OrganizerHelp> only for a
// logged-in organizer.
export default function HelpPage() {
  return (
    <div className="w-full space-y-10">
      <section className="animate-hero-entrance relative w-full rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden shadow-md p-8 sm:p-14 text-center text-white flex flex-col items-center justify-center space-y-6">
        <PageHeroBackground specificKey="hero_banner_path" alt="DALTA Esports Help banner" />
        <div className="relative z-10 max-w-3xl mx-auto space-y-3">
          <h1 className="animate-hero-title text-page-hero font-black tracking-wider uppercase leading-tight text-white flex items-center justify-center gap-3">
            <LifeBuoy className="size-[0.8em] text-gold" aria-hidden="true" /> Help &amp; FAQ
          </h1>
          <p className="text-base sm:text-lg font-medium leading-relaxed text-white">
            Quick answers for spectators and players.
          </p>
        </div>
        {/* Jump to a section */}
        <nav aria-label="Help sections" className="relative z-10 flex flex-wrap justify-center gap-2">
          {HELP_SECTIONS.map((s) => {
            const Icon = HELP_ICONS[s.id];
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-gold hover:text-stone-950 hover:border-gold transition-colors"
              >
                <Icon className="size-4" aria-hidden="true" /> {s.title}
              </a>
            );
          })}
        </nav>
      </section>

      {HELP_SECTIONS.map((section) => (
        <HelpSectionView key={section.id} section={section} />
      ))}

      {/* Staff/admin questions: only for a logged-in organizer (checked on the server) */}
      <Suspense fallback={null}>
        <OrganizerHelp />
      </Suspense>

      <p className="text-center text-stone-600">
        Still stuck? Restart the quick tour from <Link href="/profile" className="font-bold text-maroon underline">My Profile</Link>,
        or read the <Link href="/conduct" className="font-bold text-maroon underline">Code of Conduct</Link>.
      </p>
    </div>
  );
}
