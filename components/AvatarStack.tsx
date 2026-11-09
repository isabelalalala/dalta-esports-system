import Avatar from '@/components/Avatar';

// A row of overlapping member avatars (team cards, registration cards): the first `max` people and
// "+N" for the rest. The names are read out once as a list for screen readers.
export default function AvatarStack({
  people, total, max = 5,
}: {
  people: { name: string | null; avatar_url: string | null }[];
  // Everyone on the team (people may hold only the first few)
  total?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = Math.max((total ?? people.length) - shown.length, 0);
  if (shown.length === 0) return null;

  return (
    <span className="flex items-center" aria-label={`Members: ${shown.map((p) => p.name || 'Player').join(', ')}${extra ? ` and ${extra} more` : ''}`}>
      {shown.map((p, i) => (
        <span key={i} className={`rounded-full ring-2 ring-surface ${i > 0 ? '-ml-2' : ''}`} aria-hidden="true">
          <Avatar url={p.avatar_url} name={p.name} size="sm" />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-2 inline-flex size-8 items-center justify-center rounded-full bg-stone-200 text-[11px] font-black text-stone-700 ring-2 ring-surface" aria-hidden="true">
          +{extra}
        </span>
      )}
    </span>
  );
}
