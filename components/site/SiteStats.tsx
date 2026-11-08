import { Gamepad2, Swords, Trophy, Users } from 'lucide-react';
import { getSiteStats } from '@/utils/site-data';
import Reveal from '@/components/Reveal';
import CountUp from './CountUp';

// "DALTA in numbers": four totals that count up when they scroll into view (homepage, About).
// Renders nothing (not even an empty wrapper) until get_site_stats() exists (202611091200_site_stats).
export default async function SiteStats() {
  const stats = await getSiteStats();
  if (!stats) return null;

  // A zero ("0 matches played") reads badly on a public page: those tiles are left out
  const tiles = [
    { label: 'Players', value: stats.players, Icon: Users },
    { label: 'Teams', value: stats.teams, Icon: Gamepad2 },
    { label: 'Tournaments', value: stats.tournaments, Icon: Trophy },
    { label: 'Matches played', value: stats.matches, Icon: Swords },
  ].filter((t) => t.value > 0);
  if (tiles.length === 0) return null;

  return (
    <Reveal>
    <section aria-label="DALTA Esports in numbers" className="rounded-3xl border border-stone-800/80 bg-ink text-white shadow-md overflow-hidden relative">
      <div className="absolute inset-0 bg-logo-stage pointer-events-none" aria-hidden="true" />
      <dl className="relative grid grid-cols-2 @3xl:grid-cols-none @3xl:grid-flow-col @3xl:auto-cols-fr divide-white/10 @3xl:divide-x">
        {tiles.map(({ label, value, Icon }) => (
          <div key={label} className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 sm:py-8 text-center">
            <Icon className="order-1 h-5 w-5 text-gold" aria-hidden="true" />
            {/* The label comes first for screen readers; order-* shows the number above it */}
            <dt className="order-3 text-[11px] sm:text-xs font-black uppercase tracking-widest text-stone-300">{label}</dt>
            <dd className="order-2 text-3xl sm:text-4xl font-black text-white">
              <CountUp value={value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
    </Reveal>
  );
}
