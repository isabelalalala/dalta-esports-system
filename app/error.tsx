'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

// Shown instead of a page that crashed (a bug or an unexpected answer), inside the normal
// header and footer. Expected errors (a failed save, a rule in the database) are shown on the
// page itself; this is only the last safety net.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Visible in the browser console (and Railway logs for server errors) for debugging
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 bg-sitebg text-white grid place-items-center px-4 py-16">
      <div role="alert" className="w-full max-w-md bg-sitecard border-2 border-red-500 shadow-[6px_6px_0_var(--color-brown)] p-6 sm:p-8 text-center space-y-4">
        <h1 className="font-pixel text-base sm:text-lg leading-relaxed text-gold">Something went wrong</h1>
        <p className="text-gray-400">
          This page couldn&apos;t be shown. Check your internet connection and try again. If it keeps happening,
          tell the organizers what you were doing.
        </p>
        {error.digest && <p className="text-xs text-gray-500">Error code: {error.digest}</p>}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button onClick={() => retry()} className="bg-gold text-black px-5 py-2 font-bold hover:bg-golddark">
            Try again
          </button>
          <Link href="/dashboard" className="border-2 border-gold text-gold px-5 py-2 font-bold hover:bg-gold/10">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
