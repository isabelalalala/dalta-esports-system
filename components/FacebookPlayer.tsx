'use client';

import { useEffect, useRef, useState } from 'react';
import { facebookEmbedUrl, facebookWatchUrl } from '@/utils/streams';
import { ExternalLink, RotateCcw, VideoOff } from 'lucide-react';

// How long the player may take before we offer the fallback card instead
const LOAD_TIMEOUT_MS = 15_000;

// Facebook's embedded video player, 16:9 and full width (also on phones). Always embeds the
// canonical video address (facebookEmbedUrl), never a share link.
//
// What can and can't be detected: the player is a cross-origin frame, so the page can't read a
// "You don't have permission to view this" message inside it. We can tell when the frame never
// loads (blocked by an ad blocker or network): then a fallback card replaces the broken player.
// The "Watch on Facebook" link below is always there for the cases we can't detect.
export default function FacebookPlayer({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  // Changing the key remounts the iframe ("Try again")
  const [attempt, setAttempt] = useState(0);
  const watchUrl = facebookWatchUrl(url);
  // The iframe is lazy: off-screen players don't load, so the timeout only starts once it's visible
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (state !== 'loading' || !visible) return;
    const timer = setTimeout(() => setState('failed'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state, attempt, visible]);

  return (
    <div>
      <div ref={boxRef} className="relative w-full aspect-video bg-black overflow-hidden">
        {state === 'failed' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
            <VideoOff className="w-8 h-8 text-gold" aria-hidden="true" />
            <p className="text-base font-bold">Can&apos;t load the stream here</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold hover:bg-golddark px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-950"
              >
                Watch on Facebook <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => { setState('loading'); setAttempt((n) => n + 1); }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          </div>
        ) : (
          <iframe
            key={attempt}
            src={facebookEmbedUrl(url)}
            title={title}
            loading="lazy"
            onLoad={() => setState('loaded')}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        Video not showing, or Facebook says you don&apos;t have permission? The stream may be private or restricted,
        or an ad blocker may hide it.{' '}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="text-maroon font-bold underline hover:text-stone-950">
          Watch on Facebook ↗
        </a>
      </p>
    </div>
  );
}
