'use client';

import { Check, LayoutGrid } from 'lucide-react';
import GameBadge from '@/components/GameBadge';
import Tooltip from '@/components/Tooltip';
import { getGameLogoSet } from '@/utils/game-logos';

// Logo-only game filter (11.4): "All games" as text, then one chip per game showing just its logo.
// The name is in aria-label ("Filter: League of Legends"), a tooltip (hover, focus, long press) and
// visually hidden text. Selected = gold ring + glow + check mark + full-color logo; unselected logos
// are dimmed and light up on hover. On phones the row scrolls sideways with snap points and a fade
// at the edges (no wrapping).
export default function GameFilterChips({
  games, value, onChange, label = 'Game',
}: {
  games: { id: string; name: string }[];
  value: string; // '' = all games
  onChange: (id: string) => void;
  label?: string;
}) {
  const base =
    'relative inline-flex h-12 shrink-0 snap-start items-center justify-center rounded-2xl border transition-all cursor-pointer ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
  const on = 'border-gold bg-white ring-2 ring-gold shadow-[0_0_18px_-4px_var(--color-gold)]';
  const off = 'border-stone-200 bg-white hover:border-gold/70';

  return (
    <div className="chip-fade relative min-w-0 max-w-full">
      {/* relative: the scroll box is the containing block, so nothing inside (e.g. the sr-only text) can widen the page */}
      <div className="relative -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 py-1.5 [scrollbar-width:none]" role="group" aria-label={label}>
        <button
          type="button"
          onClick={() => onChange('')}
          aria-pressed={!value}
          className={`${base} gap-1.5 px-4 text-xs font-black uppercase tracking-wider ${!value ? `${on} text-stone-950` : `${off} text-stone-700`}`}
        >
          <LayoutGrid className="size-4" aria-hidden="true" /> All games
          {!value && <ActiveMark />}
        </button>
        {games.map((g) => {
          const active = value === g.id;
          const full = getGameLogoSet(g.name, g.id)?.label ?? g.name;
          return (
            <Tooltip key={g.id} text={full} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onChange(active ? '' : g.id)}
                aria-pressed={active}
                aria-label={`Filter: ${full}`}
                className={`group/chip ${base} w-28 px-2.5 ${active ? on : off}`}
              >
                <span className={`transition-[opacity,filter] ${active ? 'opacity-100 brightness-110' : 'opacity-65 group-hover/chip:opacity-100'}`}>
                  <GameBadge game={g.id} name={g.name} variant="wordmark" className="h-9 w-24" />
                </span>
                <span className="sr-only">{full}</span>
                {active && <ActiveMark />}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// Check mark on the active chip, so the state doesn't depend on color alone
function ActiveMark() {
  return (
    <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-surface bg-gold text-ink" aria-hidden="true">
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}
