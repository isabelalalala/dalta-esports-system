'use client';

import Link from 'next/link';

// Full-page message when a page's data couldn't be loaded at all (no connection, expired
// session, deleted item). Errors after the page has loaded are shown inside the page instead.
export default function PageError({
  message,
  backHref = '/dashboard',
  backLabel = 'Back to Dashboard',
}: {
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-[60vh] flex-1 bg-sitebg text-white grid place-items-center px-4 py-10">
      <div role="alert" className="w-full max-w-md bg-sitecard border-2 border-red-500 shadow-[6px_6px_0_var(--color-brown)] p-6 text-center space-y-4">
        <h1 className="text-lg font-bold text-red-300">Couldn&apos;t load this page</h1>
        <p className="text-gray-300 break-words">{message}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {/* A full reload, so everything is fetched again */}
          <button onClick={() => window.location.reload()} className="bg-gold text-black px-5 py-2 font-bold hover:bg-golddark">
            Try again
          </button>
          <Link href={backHref} className="border-2 border-gold text-gold px-5 py-2 font-bold hover:bg-gold/10">
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
