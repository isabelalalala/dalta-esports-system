import { Trophy } from 'lucide-react';

// Small gold trophy badge with a team's number of tournament titles (Hall of Fame), on team cards
// and team pages. Renders nothing without a title. onDark: on a dark hero.
export default function TitleBadge({ titles, onDark = false }: { titles?: number; onDark?: boolean }) {
  if (!titles) return null;
  const text = `${titles} tournament ${titles === 1 ? 'title' : 'titles'}`;
  return (
    <span
      title={text}
      aria-label={text}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${
        onDark ? 'bg-gold text-ink' : 'border border-gold/60 bg-gold/15 text-amber-800'
      }`}
    >
      <Trophy className="size-3.5" aria-hidden="true" />
      <span aria-hidden="true">×{titles}</span>
    </span>
  );
}
