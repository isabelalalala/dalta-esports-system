import Link from 'next/link';
import { getDivisions } from '@/utils/site-data';
import GameLogo from '@/components/GameLogo';
import TiltCard from '@/components/TiltCard';
import Reveal from '@/components/Reveal';

// "Choose your game" row in the homepage's dark band: one tile per published division, linking to
// its page. Tiles tilt toward the mouse and a gold light runs around the border on hover / focus.
export default async function GameTiles() {
  const divisions = (await getDivisions()).filter((d) => d.is_published);
  if (divisions.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 min-[380px]:grid-cols-2 @3xl:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 sm:gap-4">
      {divisions.map((d, i) => (
        <li key={d.game_id} className="min-w-0">
          <Reveal delay={(i % 4) as 0 | 1 | 2 | 3} className="h-full">
            <TiltCard className="h-full">
              <Link
                href={`/divisions/${d.game_id}`}
                className="group border-trace flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10"
              >
                <span className="relative block aspect-[4/3] bg-logo-stage-strong">
                  <GameLogo
                    name={d.games?.name}
                    gameId={d.game_id}
                    balanced
                    className="absolute inset-0"
                    imageClassName="drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-110"
                    sizes="(max-width: 768px) 45vw, 200px"
                  />
                </span>
                <span className="block truncate px-3 py-2.5 text-center text-[11px] sm:text-xs font-black uppercase tracking-widest text-white group-hover:text-gold transition-colors">
                  {d.games?.name ?? d.game_id}
                </span>
              </Link>
            </TiltCard>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
