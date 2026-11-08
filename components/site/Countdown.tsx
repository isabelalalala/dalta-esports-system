'use client';

import { useSyncExternalStore } from 'react';
import { countdownParts } from '@/utils/countdown';

// One shared clock that ticks every 30 s, read through useSyncExternalStore. The snapshot is the
// current minute, so React re-renders at most once a minute; on the server it is null (the
// countdown appears after hydration, so server and browser HTML always match).
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(notify: () => void) {
  listeners.add(notify);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 30_000);
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const currentMinute = () => Math.floor(Date.now() / 60_000);

const MINUTE = 60_000;

interface Props {
  // When it starts (ISO string or anything Date understands)
  target: string;
  // Shown once the moment has passed (null = show nothing), for startedFor ms (default: always)
  startedText?: string | null;
  startedFor?: number;
  // Text before the numbers, e.g. "Starts in"
  prefix?: string;
  size?: 'lg' | 'sm';
  // 'dark' = on a dark card (gold numbers), 'light' = on a white card (maroon numbers)
  tone?: 'dark' | 'light';
}

// Live countdown to a moment, updated every minute
export default function Countdown({
  target, startedText = null, startedFor = Infinity, prefix, size = 'lg', tone = 'dark',
}: Props) {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  if (minute === null) return <span className={size === 'lg' ? 'inline-block h-8' : 'inline-block h-4'} aria-hidden="true" />;

  const msLeft = new Date(target).getTime() - minute * MINUTE;
  if (msLeft <= 0) {
    return startedText && -msLeft < startedFor ? (
      <span className={`font-black uppercase tracking-wider ${size === 'lg' ? 'text-sm' : 'text-xs'} ${tone === 'dark' ? 'text-gold' : 'text-maroon'}`}>
        {startedText}
      </span>
    ) : null;
  }

  const parts = countdownParts(msLeft);
  const number = `${size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-sm'} font-black tabular-nums ${tone === 'dark' ? 'text-gold' : 'text-maroon'}`;
  const label = `${size === 'lg' ? 'text-xs' : 'text-[11px]'} font-extrabold uppercase tracking-wider ${tone === 'dark' ? 'text-stone-300' : 'text-stone-600'}`;

  return (
    <span
      className={`inline-flex flex-wrap items-baseline ${size === 'lg' ? 'gap-3' : 'gap-1.5'}`}
      aria-label={`${prefix ? `${prefix} ` : ''}${parts.map((p) => `${p.value} ${p.label}`).join(' ')}`}
    >
      {prefix && <span className={label}>{prefix}</span>}
      {parts.map((p) => (
        <span key={p.label} className="inline-flex items-baseline gap-1" aria-hidden="true">
          <span className={number}>{p.value}</span>
          <span className={label}>{p.label}</span>
        </span>
      ))}
    </span>
  );
}
