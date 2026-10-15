import Link from 'next/link';

// Shown at the bottom of every page (added in app/layout.tsx). Hidden when printing reports.
export default function Footer() {
  return (
    <footer className="bg-[#0a0a0c] border-t border-[#00d2ff]/20 text-gray-400 text-sm px-4 py-6 print:hidden">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="font-semibold text-[#00d2ff]">Game With Purpose</p>
        <p>© 2026 DALTA Esports</p>
        <Link href="/privacy" className="hover:text-[#00d2ff] hover:underline">Privacy Notice</Link>
      </div>
    </footer>
  );
}
