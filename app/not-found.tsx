import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found | DALTA Esports',
};

// 404 for every page: unknown addresses and notFound() (e.g. a deleted tournament on /t/[id]).
// Rendered inside the root layout, so the normal header and footer are around it.
export default function NotFound() {
  return (
    <main className="flex-1 bg-sitebg text-white grid place-items-center px-4 py-16">
      <div className="w-full max-w-md bg-sitecard border-2 border-gold shadow-[6px_6px_0_var(--color-brown)] p-6 sm:p-8 text-center space-y-4">
        <p className="font-pixel text-3xl text-gold">404</p>
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="text-gray-400">
          This page doesn&apos;t exist or was removed. If you followed a link to a tournament or match, it may have
          been deleted.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href="/" className="bg-gold text-black px-5 py-2 font-bold hover:bg-golddark">Home</Link>
          <Link href="/dashboard" className="border-2 border-gold text-gold px-5 py-2 font-bold hover:bg-gold/10">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
