'use client';

import { useEffect, useState } from 'react';
import { SITE_URL } from '@/utils/site-url';

interface Props {
  // A path on this site, e.g. /t/<id>
  path: string;
  title: string;
  text?: string;
}

// "Share" opens the phone's share sheet (Messenger, Facebook, ...) where available;
// otherwise "Copy link" and "Share on Facebook".
export default function ShareButton({ path, title, text }: Props) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  // Always the official address (NEXT_PUBLIC_SITE_URL), not the one in the address bar,
  // so links copied on localhost or a Vercel preview still open the live site
  const url = `${SITE_URL}${path}`;

  // navigator only exists in the browser, so this is read after the first render
  useEffect(() => {
    const check = () => setCanShare(typeof navigator.share === 'function');
    check();
  }, []);

  const handleShare = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // Closing the share sheet throws; nothing to do
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers: select-and-copy fallback
      window.prompt('Copy this link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buttonClass = 'px-3 py-1.5 border-2 border-gold text-stone-950 text-sm font-bold hover:bg-gold/10';

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {canShare && (
        <button onClick={handleShare} className="px-3 py-1.5 border-2 border-gold bg-gold text-stone-950 text-sm font-bold hover:bg-golddark">
          Share
        </button>
      )}
      <button onClick={handleCopy} className={buttonClass} aria-live="polite">
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        className={buttonClass}
      >
        Share on Facebook
      </a>
    </div>
  );
}
