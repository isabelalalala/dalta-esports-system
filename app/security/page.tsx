import Link from 'next/link';
import { PRIVACY_CONTACT_EMAIL } from '@/utils/privacy';

// Security policy: how to report vulnerabilities and what we do to protect data.
// Public: no login needed.
export const metadata = { title: 'Security' };

export default function SecurityPage() {
  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-gray-300 px-4 py-10">
      <article className="max-w-3xl mx-auto space-y-8 leading-relaxed">
        <header>
          <Link href="/" className="inline-block text-gold hover:underline mb-6">← Home</Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Security</h1>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">Reporting a vulnerability</h2>
          <p>
            If you find a security issue, email{' '}
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-gold underline">{PRIVACY_CONTACT_EMAIL}</a>{' '}
            with what you found, how to reproduce it and the affected pages. Please give us a reasonable
            time to fix it before making it public. A machine-readable contact file is at{' '}
            <code className="text-xs">/.well-known/security.txt</code>.
          </p>
          <p>
            Please don&apos;t access other people&apos;s data, disrupt the service, or run automated
            attacks against production systems. Good-faith research reported responsibly is welcome.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">How we protect the system</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>All traffic is encrypted (HTTPS).</li>
            <li>Row Level Security in the database decides who can read or write each record by role;
              hiding buttons in the interface is only a convenience.</li>
            <li>Passwords are stored hashed by Supabase Auth; email links expire and work once.</li>
            <li>Uploaded match proofs live in a private bucket; only the two teams and staff can read them,
              through short-lived signed URLs.</li>
            <li>Every important action is written to an admin-only activity log.</li>
            <li>Administrative actions exist only in the database, with no service-level bypass key in the
              application.</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
