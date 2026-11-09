import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, Eye, Gamepad2, LifeBuoy, ShieldCheck, Swords } from 'lucide-react';
import { HELP_SECTIONS, type HelpSection } from '@/utils/help';
import PageHeroBackground from '@/components/site/PageHeroBackground';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  description: 'How DALTA Esports works: accounts, teams, registration, streams, feedback, warnings and organizer tools.',
};

const ICONS: Record<HelpSection['id'], typeof Eye> = {
  everyone: Eye,
  player: Gamepad2,
  staff: Swords,
  admin: ShieldCheck,
};

// Public help page: one collapsible FAQ section per role. Content in utils/help.ts.
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
            Quick answers for spectators, players and organizers.
          </p>
        </div>
        {/* Jump to a role */}
        <nav aria-label="Help sections" className="relative z-10 flex flex-wrap justify-center gap-2">
          {HELP_SECTIONS.map((s) => {
            const Icon = ICONS[s.id];
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

      {HELP_SECTIONS.map((section) => {
        const Icon = ICONS[section.id];
        return (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 space-y-4">
            <div>
              <h2 id={`${section.id}-title`} className="text-xl sm:text-2xl font-black uppercase tracking-wide flex items-center gap-2">
                <Icon className="size-6 text-maroon" aria-hidden="true" /> {section.title}
              </h2>
              <p className="text-stone-600 font-medium mt-1">{section.intro}</p>
            </div>
            <div className="divide-y divide-stone-200/90 rounded-2xl border border-stone-200/90 bg-white shadow-xs">
              {section.items.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold text-stone-950 hover:bg-stone-50 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-maroon [&::-webkit-details-marker]:hidden">
                    <span>{item.q}</span>
                    <ChevronDown className="size-5 shrink-0 text-stone-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="space-y-2 px-5 pb-5 text-stone-800 leading-relaxed">
                    {item.a.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {item.link && (
                      <Link href={item.link.href} className="inline-block pt-1 text-sm font-black uppercase tracking-wider text-maroon hover:underline">
                        {item.link.label} →
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-center text-stone-600">
        Still stuck? Restart the quick tour from <Link href="/profile" className="font-bold text-maroon underline">My Profile</Link>,
        or read the <Link href="/conduct" className="font-bold text-maroon underline">Code of Conduct</Link>.
      </p>
    </div>
  );
}
