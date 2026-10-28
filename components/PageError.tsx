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
    <div className="min-h-[60vh] flex-1 bg-white text-stone-950 grid place-items-center px-4 py-10 uppercase">
      <div role="alert" className="w-full max-w-md bg-white rounded-2xl border border-red-500/30 shadow-sm p-6 sm:p-8 text-center space-y-4">
        <h1 className="text-xl font-black text-amber-700 uppercase tracking-wide">Couldn&apos;t load this page</h1>
        <p className="text-stone-600 font-medium text-xs sm:text-sm uppercase tracking-wide break-words">{message}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {/* A full reload, so everything is fetched again */}
          <button onClick={() => window.location.reload()} className="rounded-xl border border-amber-400 bg-gold text-stone-950 px-5 py-2.5 font-black text-xs uppercase tracking-widest shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all">
            Try again
          </button>
          <Link href={backHref} className="rounded-xl border border-stone-200 bg-white text-stone-950 px-5 py-2.5 font-black text-xs uppercase tracking-widest shadow-xs hover:bg-stone-50 hover:border-stone-300 hover:-translate-y-0.5 transition-all">
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
