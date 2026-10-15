'use client';

import { useEffect, useState } from 'react';

interface Props {
  // A path on this site, e.g. /t/<id>; the full address is built in the browser
  path: string;
  title: string;
  text?: string;
}

// "Share" opens the phone's share sheet (Messenger, Facebook, ...) where available;
// otherwise "Copy link" and "Share on Facebook".
export default function ShareButton({ path, title, text }: Props) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [url, setUrl] = useState(path);

  // window/navigator only exist in the browser, so these are read after the first render
  useEffect(() => {
    const check = () => {
      setUrl(`${window.location.origin}${path}`);
      setCanShare(typeof navigator.share === 'function');
    };
    check();
  }, [path]);

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

  const buttonClass = 'px-3 py-1.5 border-2 border-gold text-gold text-sm font-bold hover:bg-gold/10';

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {canShare && (
        <button onClick={handleShare} className="px-3 py-1.5 border-2 border-gold bg-gold text-sitebg text-sm font-bold">
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
