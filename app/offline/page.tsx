import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

// Shown by the service worker (public/sw.js) when a page can't load because the device is offline.
// Kept plain: no data, no scripts needed.
export default function OfflinePage() {
  return (
    <main id="main-content" className="min-h-[70vh] w-full grid place-items-center bg-white px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 text-center shadow-sm space-y-4">
        <Image src="/icons/icon-192.png" alt="DALTA Esports logo" width={72} height={72} unoptimized className="mx-auto rounded-2xl" />
        <h1 className="text-2xl font-black uppercase tracking-wider text-stone-950">You&apos;re offline</h1>
        <p className="text-sm text-stone-600">
          This page needs an internet connection. Check your Wi-Fi or mobile data, then try again.
          Scores and brackets always load fresh, so nothing old is shown.
        </p>
        {/* A full page load on purpose: client navigation can't work while offline */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="btn btn-primary">Try again</a>
      </div>
    </main>
  );
}
