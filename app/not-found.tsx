import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found | DALTA Esports',
};

// 404 for every page: unknown addresses and notFound() (e.g. a deleted tournament on /t/[id]).
// Rendered inside the root layout, so the normal header and footer are around it.
export default function NotFound() {
  return (
    <main className="flex-1 bg-white text-stone-950 grid place-items-center px-4 py-16 uppercase">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 text-center space-y-4">
        <p className="font-black text-4xl text-amber-700 tracking-wider">404</p>
        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide">Page not found</h1>
        <p className="text-stone-600 font-medium text-xs sm:text-sm uppercase tracking-wide leading-relaxed">
          This page doesn&apos;t exist or was removed. If you followed a link to a tournament or match, it may have
          been deleted.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href="/" className="rounded-xl border border-amber-400 bg-gold text-stone-950 px-5 py-2.5 font-black text-xs uppercase tracking-widest shadow-xs hover:bg-golddark hover:-translate-y-0.5 transition-all">Home</Link>
          <Link href="/dashboard" className="rounded-xl border border-stone-200 bg-white text-stone-950 px-5 py-2.5 font-black text-xs uppercase tracking-widest shadow-xs hover:bg-stone-50 hover:border-stone-300 hover:-translate-y-0.5 transition-all">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
