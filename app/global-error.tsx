'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';
import './globals.css';

// Last safety net: shown when the root layout itself (header/footer) fails.
// It replaces the whole document, so it has its own <html> and <body> and imports the theme.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-stone-950 grid place-items-center px-4 font-sans uppercase">
        <title>Something went wrong | DALTA Esports</title>
        <div role="alert" className="w-full max-w-md bg-white rounded-2xl border border-red-500/30 shadow-sm p-6 sm:p-8 text-center space-y-4">
          <h1 className="text-xl sm:text-2xl font-black text-amber-700 uppercase tracking-wide">Something went wrong</h1>
          <p className="text-stone-600 font-medium text-xs sm:text-sm uppercase tracking-wide leading-relaxed">
            DALTA Esports couldn&apos;t load. Check your internet connection and try again.
          </p>
          {error.digest && <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Error code: {error.digest}</p>}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button onClick={() => retry()} className="rounded-xl border border-amber-400 bg-gold text-stone-950 px-5 py-2.5 font-black text-xs uppercase tracking-widest shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all">
              Try again
            </button>
            <Link href="/" className="rounded-xl border border-stone-200 bg-white text-stone-950 px-5 py-2.5 font-black text-xs uppercase tracking-widest shadow-xs hover:bg-stone-50 hover:border-stone-300 hover:-translate-y-0.5 transition-all">Home</Link>
          </div>
        </div>
      </body>
    </html>
  );
}
