import Link from 'next/link';
import { ChevronDown, Eye, Gamepad2, ShieldCheck, Swords } from 'lucide-react';
import type { HelpSection } from '@/utils/help';

export const HELP_ICONS: Record<HelpSection['id'], typeof Eye> = {
  everyone: Eye,
  player: Gamepad2,
  staff: Swords,
  admin: ShieldCheck,
};

// One Help & FAQ section: title, intro and collapsible questions (/help, public and organizer parts)
export default function HelpSectionView({ section }: { section: HelpSection }) {
  const Icon = HELP_ICONS[section.id];
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 space-y-4">
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
}
