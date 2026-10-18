import Link from 'next/link';

// Cookie policy. Public: no login needed.
// The app only sets strictly-necessary authentication cookies, so no consent
// banner is required — this page documents them for transparency.
export const metadata = { title: 'Cookie Policy' };

const cookies = [
  {
    name: 'sb-*-auth-token',
    purpose: 'Keeps you signed in (Supabase session token).',
    lifetime: 'Until you sign out or the session expires.',
  },
  {
    name: 'sb-*-auth-token-code-verifier',
    purpose: 'Temporary cookie used during sign-up, sign-in and password-reset email links (PKCE).',
    lifetime: 'Deleted when the email link is used or expires.',
  },
];

export default function CookiesPage() {
  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-gray-300 px-4 py-10">
      <article className="max-w-3xl mx-auto space-y-8 leading-relaxed">
        <header>
          <Link href="/" className="inline-block text-gold hover:underline mb-6">← Home</Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Cookie Policy</h1>
          <p className="mt-4">
            This site only uses cookies that are strictly necessary for it to work. We do not use
            advertising, analytics or tracking cookies, so no cookie consent banner is needed.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">Cookies we set</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-brownlight">
              <thead>
                <tr className="border-b border-brownlight bg-sitecard text-left">
                  <th className="px-3 py-2 font-semibold text-white">Cookie</th>
                  <th className="px-3 py-2 font-semibold text-white">Purpose</th>
                  <th className="px-3 py-2 font-semibold text-white">Lifetime</th>
                </tr>
              </thead>
              <tbody>
                {cookies.map((c) => (
                  <tr key={c.name} className="border-b border-brownlight last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{c.name}</td>
                    <td className="px-3 py-2">{c.purpose}</td>
                    <td className="px-3 py-2">{c.lifetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The cookie names start with <code className="text-xs">sb-</code> and are set by our login
            provider (Supabase). Signing out removes the session.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">Third-party cookies</h2>
          <p>
            Live streams play inside Facebook&apos;s video player — Facebook may set its own cookies on
            those pages under its own privacy policy. We have no control over them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">Managing cookies</h2>
          <p>
            You can block or delete cookies in your browser settings. If you block the session cookies
            above, you will not be able to sign in. See the{' '}
            <Link href="/privacy" className="text-gold underline">Privacy Notice</Link> for how we handle
            personal data.
          </p>
        </section>
      </article>
    </main>
  );
}
