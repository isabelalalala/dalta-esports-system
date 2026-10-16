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
      <body className="min-h-screen bg-sitebg text-white grid place-items-center px-4 font-sans">
        <title>Something went wrong | DALTA Esports</title>
        <div role="alert" className="w-full max-w-md bg-sitecard border-2 border-red-500 shadow-[6px_6px_0_var(--color-brown)] p-6 sm:p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-gold">Something went wrong</h1>
          <p className="text-gray-400">
            DALTA Esports couldn&apos;t load. Check your internet connection and try again.
          </p>
          {error.digest && <p className="text-xs text-gray-400">Error code: {error.digest}</p>}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button onClick={() => retry()} className="bg-gold text-black px-5 py-2 font-bold hover:bg-golddark">
              Try again
            </button>
            <Link href="/" className="border-2 border-gold text-gold px-5 py-2 font-bold hover:bg-gold/10">Home</Link>
          </div>
        </div>
      </body>
    </html>
  );
}
