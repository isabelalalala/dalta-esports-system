'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tv, X } from 'lucide-react';
import { useLiveStream, type LiveStreamInfo } from '@/utils/use-live-stream';

// Which stream's banner was dismissed this visit (sessionStorage, kept in memory when storage is
// blocked). Shared by the banner and the header pill: on phones only one of them shows at a time.
const HIDDEN_KEY = 'dalta_live_banner_hidden';
const hiddenListeners = new Set<() => void>();
let hiddenInMemory: string | null = null;

function readHidden(): string | null {
  try {
    return sessionStorage.getItem(HIDDEN_KEY) ?? hiddenInMemory;
  } catch {
    return hiddenInMemory;
  }
}

function hideBanner(href: string) {
  hiddenInMemory = href;
  try {
    sessionStorage.setItem(HIDDEN_KEY, href);
  } catch {
    // private mode: hidden until the next page load
  }
  hiddenListeners.forEach((notify) => notify());
}

function subscribeHidden(notify: () => void) {
  hiddenListeners.add(notify);
  return () => {
    hiddenListeners.delete(notify);
  };
}

// Is the sticky banner on screen? Not when it was dismissed, or on the stream page itself.
function useBannerVisible(live: LiveStreamInfo | null): boolean {
  const pathname = usePathname();
  const hidden = useSyncExternalStore(subscribeHidden, readHidden, () => null);
  return !!live && hidden !== live.href && pathname !== live.href;
}

// Pulsing red dot (the pulse is off with reduced motion)
function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden="true">
      <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-white" />
    </span>
  );
}

// Header: a small pulsing LIVE pill whenever a stream is live, linking straight to it. On phones
// and tablets it waits until the banner below is dismissed, so there are never two LIVE buttons;
// from the lg breakpoint both show (the banner is a slim strip there, the pill is in the header).
export function LivePill() {
  const live = useLiveStream();
  const bannerVisible = useBannerVisible(live);
  if (!live) return null;
  return (
    <Link
      href={live.href}
      aria-label={`Live now: ${live.title}. Watch the stream`}
      title={`Live now: ${live.title}`}
      className={`${bannerVisible ? 'hidden lg:inline-flex' : 'inline-flex'} h-11 shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-xs font-black uppercase tracking-widest text-white shadow-xs hover:bg-red-700 transition-colors`}
    >
      <LiveDot /> Live
    </Link>
  );
}

// Every page: a slim sticky banner under the header while a match is streaming. Dismissible for the
// rest of the visit (sessionStorage); hidden on the stream page itself.
export function LiveBanner() {
  const live = useLiveStream();
  const visible = useBannerVisible(live);
  if (!live || !visible) return null;

  const dismiss = () => hideBanner(live.href);

  return (
    <div className="sticky top-[var(--site-header-h,0px)] z-30 bg-red-600 text-white shadow-sm print:hidden" role="region" aria-label="Live now">
      <div className="flex items-center gap-3 px-4 sm:px-8 py-2 text-xs sm:text-sm font-bold">
        <span className="inline-flex shrink-0 items-center gap-1.5 font-black uppercase tracking-widest"><LiveDot /> Live now</span>
        <span className="min-w-0 flex-1 truncate">{live.title}</span>
        <Link href={live.href} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 font-black uppercase tracking-wider hover:bg-white/25 min-h-9">
          <Tv className="size-4" aria-hidden="true" /> Watch
        </Link>
        <button type="button" onClick={dismiss} aria-label="Hide the live banner" className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-white/15">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
