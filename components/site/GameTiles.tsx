import Link from 'next/link';
import { getDivisions } from '@/utils/site-data';
import GameLogo from '@/components/GameLogo';
import GameBadge from '@/components/GameBadge';
import TiltCard from '@/components/TiltCard';
import Reveal from '@/components/Reveal';
import GameLiveDot from './GameLiveDot';

// "Choose your game" row in the homepage's dark band: one card per published division, linking to
// its page. The same card as on /divisions (docs/brand.md "Motion"): TiltCard + card-interactive +
// border-trace, the bg-logo-stage-strong stage with GameLogo balanced (all five logos equally big)
// and the same white name bar. Cards come in with Reveal and the shared stagger. A pulsing LIVE
// badge sits in the corner while a game has a live match (GameLiveDot, the shared LivePulse).
export default async function GameTiles() {
  const divisions = (await getDivisions()).filter((d) => d.is_published);
  if (divisions.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 min-[380px]:grid-cols-2 @3xl:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 sm:gap-4">
      {divisions.map((d, i) => {
        const name = d.games?.name ?? d.game_id;
        return (
          <li key={d.game_id} className="relative min-w-0">
            <Reveal delay={(i % 4) as 0 | 1 | 2 | 3} className="h-full">
              <TiltCard className="h-full">
                <Link
                  href={`/divisions/${d.game_id}`}
                  className="group card-interactive border-trace flex h-full flex-col overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs"
                >
                  <span className="relative block aspect-[4/3] overflow-hidden border-b border-stone-800/80 bg-ink">
                    <span className="pointer-events-none absolute inset-0 bg-logo-stage-strong" aria-hidden="true" />
                    <GameLogo
                      name={d.games?.name}
                      gameId={d.game_id}
                      balanced
                      decorative
                      className="absolute inset-0"
                      imageClassName="drop-shadow-[0_6px_24px_rgba(0,0,0,0.7)] group-hover:scale-108 transition-transform duration-300"
                      sizes="(max-width: 768px) 45vw, 200px"
                    />
                  </span>
                  <span className="flex min-w-0 items-center justify-center gap-2 px-3 py-3 font-black text-stone-950 text-xs sm:text-sm uppercase tracking-wide group-hover:text-maroon transition-colors">
                    {/* withName: the icon is decorative and the name is read once */}
                    <GameBadge name={name} game={d.game_id} size="xs" withName className="min-w-0" nameClassName="truncate" />
                  </span>
                </Link>
              </TiltCard>
            </Reveal>
            <GameLiveDot gameId={d.game_id} gameName={name} />
          </li>
        );
      })}
    </ul>
  );
}
