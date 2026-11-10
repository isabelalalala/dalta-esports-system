import Link from 'next/link';
import { getDivisions } from '@/utils/site-data';
import GameLogo from '@/components/GameLogo';
import TiltCard from '@/components/TiltCard';
import GameLiveDot from './GameLiveDot';

// Each game's brand color for the hover glow and the idle "breathing" light behind its logo, as an
// RGB triple for rgb(var(--game) / alpha) in globals.css ("Phase 9.6"). Unknown games stay gold.
const GAME_COLOR: Record<string, string> = {
  mlbb: '[--game:249_115_22]', // orange
  valorant: '[--game:255_70_85]', // Valorant red
  tekken8: '[--game:236_72_153]', // red-pink
  lol: '[--game:200_170_110]', // LoL gold
  codm: '[--game:250_204_21]', // yellow
};

// Entrance stagger: the cards come in one after another, 80 ms apart, after the title and buttons
const CARD_DELAY = [
  '[--fx-delay:600ms]', '[--fx-delay:680ms]', '[--fx-delay:760ms]', '[--fx-delay:840ms]',
  '[--fx-delay:920ms]', '[--fx-delay:1000ms]', '[--fx-delay:1080ms]', '[--fx-delay:1160ms]',
];

// "Choose your game" row in the homepage's dark band: one card per published division, linking to
// its page. Hover / keyboard focus: the card lifts, leans toward the mouse (TiltCard, mouse only),
// glows in the game's color and a light shine passes over it; pressing it sinks it a little.
// While a game has a live match, a pulsing LIVE badge sits in the corner (GameLiveDot).
export default async function GameTiles() {
  const divisions = (await getDivisions()).filter((d) => d.is_published);
  if (divisions.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 min-[380px]:grid-cols-2 @3xl:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 sm:gap-4">
      {divisions.map((d, i) => {
        const name = d.games?.name ?? d.game_id;
        return (
          // fx-in/fx-card: the entrance lives on the <li>, so its delay never slows the hover effects
          <li key={d.game_id} className={`fx-in fx-card relative min-w-0 ${CARD_DELAY[i % CARD_DELAY.length]}`}>
            <TiltCard className="h-full">
              <Link
                href={`/divisions/${d.game_id}`}
                className={`game-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 outline-none ${GAME_COLOR[d.game_id] ?? ''}`}
              >
                <span className="relative block aspect-[4/3] bg-logo-stage-strong">
                  {/* Slow breathing light in the game's color behind the logo (opacity only) */}
                  <span className={`game-breathe absolute inset-0 ${CARD_DELAY[(i * 3) % CARD_DELAY.length]}`} aria-hidden="true" />
                  <GameLogo
                    name={d.games?.name}
                    gameId={d.game_id}
                    balanced
                    decorative
                    className="absolute inset-0"
                    imageClassName="drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105"
                    sizes="(max-width: 768px) 45vw, 200px"
                  />
                </span>
                <span className="relative block truncate px-3 py-2.5 text-center text-[11px] sm:text-xs font-black uppercase tracking-widest text-white">
                  {name}
                </span>
              </Link>
            </TiltCard>
            <GameLiveDot gameId={d.game_id} gameName={name} />
          </li>
        );
      })}
    </ul>
  );
}
