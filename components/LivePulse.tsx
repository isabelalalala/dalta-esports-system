// The one LIVE indicator dot of the whole site (docs/brand.md "Motion"): a solid dot with a ring
// that softly pulses outward (animate-ping; off with reduced motion, then just the dot). Used in the
// header LIVE pill, the live banner, LiveTag, match cards, the ticker, the stream pages, schedule,
// live list and the game tiles. Decorative: always next to a visible "Live" word.
//   tone 'red'   = red dot on a light background
//   tone 'white' = white dot on a red background (pills, tags, banners)
const SIZES = { xs: 'size-1.5', sm: 'size-2', md: 'size-2.5', lg: 'size-3' } as const;

export default function LivePulse({
  tone = 'red', size = 'sm', className = '',
}: {
  tone?: 'red' | 'white';
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const ring = tone === 'white' ? 'bg-white' : 'bg-red-500';
  const dot = tone === 'white' ? 'bg-white' : 'bg-red-600';
  return (
    <span className={`relative inline-flex shrink-0 ${s} ${className}`} aria-hidden="true">
      <span className={`absolute inline-flex size-full rounded-full opacity-75 animate-ping ${ring}`} />
      <span className={`relative inline-flex ${s} rounded-full ${dot}`} />
    </span>
  );
}
