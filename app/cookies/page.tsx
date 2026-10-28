'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePageTitle } from '@/utils/page-title';

const SECTIONS = [
  { id: 'overview', navLabel: '1. Overview' },
  { id: 'cookies-we-set', navLabel: '2. Cookies we set' },
  { id: 'third-party-cookies', navLabel: '3. Third-party cookies' },
  { id: 'managing-cookies', navLabel: '4. Managing cookies' },
];

const COOKIES = [
  {
    name: 'sb-*-auth-token',
    purpose: 'Keeps you securely signed in to your account (Supabase authentication session token).',
    lifetime: 'Retained until you explicitly sign out or the session expires.',
  },
  {
    name: 'sb-*-auth-token-code-verifier',
    purpose: 'Temporary cryptographic verifier used during sign-up, login, and password-reset email flows (PKCE standard).',
    lifetime: 'Deleted immediately after the email authorization link is verified or expires.',
  },
];

export default function CookiesPage() {
  usePageTitle('Cookie Policy');
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop - 140;
          const height = el.offsetHeight;
          if (scrollY >= top && scrollY < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main id="main-content" className="min-h-screen w-full bg-white text-stone-900 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 uppercase space-y-10 sm:space-y-12">
      {/* 1. Large Main Hero Container */}
      <section className="w-full rounded-3xl border border-stone-200/90 bg-gradient-to-br from-amber-50/70 via-white to-stone-50 p-8 sm:p-14 lg:p-16 text-center shadow-xs flex flex-col items-center justify-center space-y-4">
        <div className="w-full flex justify-start">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-black text-amber-700 hover:text-amber-800 uppercase tracking-wider transition-colors mb-1"
          >
            ← Back to Home
          </Link>
        </div>
        <div className="max-w-4xl mx-auto space-y-3">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-950 tracking-wider uppercase leading-tight">
            Cookie Policy
          </h1>
          <p className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-widest">
            Minimal &amp; Strictly Necessary Authentication Cookies
          </p>
          <p className="text-sm sm:text-base lg:text-lg text-stone-700 font-medium tracking-wide uppercase leading-relaxed pt-2 max-w-3xl mx-auto">
            This site only uses cookies that are strictly necessary for system authentication and account operation. We do not use advertising, marketing, analytics, or behavioral tracking cookies, so no intrusive cookie consent banner is needed.
          </p>
        </div>
      </section>

      {/* 2. 2-Column Documentation Layout: Left Mini Navigation Tab + Right Document Content */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Mini Navigation Tab */}
        <aside className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 z-10">
          <div className="bg-stone-50/80 lg:bg-transparent rounded-2xl lg:rounded-none border lg:border-0 border-stone-200/90 p-4 lg:p-0 shadow-2xs lg:shadow-none">
            <nav className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-2 lg:gap-1 pb-2 lg:pb-0 border-l-0 lg:border-l-2 lg:border-stone-200">
              {SECTIONS.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`text-left text-xs sm:text-sm uppercase tracking-wide transition-all whitespace-nowrap lg:whitespace-normal py-2 px-3 lg:px-0 lg:pl-4 rounded-xl lg:rounded-none cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/10 lg:bg-transparent text-stone-950 font-black lg:border-l-2 lg:border-stone-950 lg:-ml-0.5'
                        : 'text-stone-500 hover:text-stone-900 font-bold lg:border-l-2 lg:border-transparent lg:hover:border-stone-400'
                    }`}
                  >
                    {sec.navLabel}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Right Content Sections */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-12 sm:space-y-16 text-stone-700 text-xs sm:text-sm lg:text-base leading-relaxed">
          {/* Section 1 */}
          <section id="overview" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              1. Overview
            </h2>
            <p>
              Cookies are small text files stored on your device by your web browser when visiting web applications. DALTA Esports prioritizes digital simplicity and student privacy: our application operates on an essential-only cookie philosophy.
            </p>
            <p>
              We do not track your activity across other websites, compile marketing profiles, or serve targeted third-party advertisements. Every cookie generated directly by this domain exists solely to authenticate your identity and maintain a secure session while you manage rosters, brackets, or match results.
            </p>
          </section>

          {/* Section 2 */}
          <section id="cookies-we-set" className="scroll-mt-24 space-y-6">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              2. Cookies we set
            </h2>
            <p>
              The following essential session and authentication cookies are stored locally when you sign in or interact with account-based features:
            </p>

            {/* Structured Table */}
            <div className="overflow-x-auto rounded-2xl border border-stone-200/90 shadow-2xs bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="py-3 px-4 text-xs font-black text-stone-900 uppercase tracking-wider">Cookie Name</th>
                    <th className="py-3 px-4 text-xs font-black text-stone-900 uppercase tracking-wider">Purpose</th>
                    <th className="py-3 px-4 text-xs font-black text-stone-900 uppercase tracking-wider">Lifetime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
                  {COOKIES.map((cookie) => (
                    <tr key={cookie.name} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-900 whitespace-nowrap">
                        <span className="inline-block bg-amber-100/70 text-amber-950 px-2 py-0.5 rounded border border-amber-300/60">
                          {cookie.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-700 leading-normal">{cookie.purpose}</td>
                      <td className="py-3.5 px-4 text-stone-600 font-medium whitespace-nowrap">{cookie.lifetime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 italic">
              Notice: The cookie identifiers start with the <code className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">sb-</code> prefix and are generated and verified cryptographically by Supabase Auth. Terminating your session via the Sign Out button promptly clears active session tokens.
            </p>
          </section>

          {/* Section 3 */}
          <section id="third-party-cookies" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              3. Third-party cookies
            </h2>
            <p>
              When live tournament streams are embedded within the platform (such as our official Facebook Live player), the external streaming provider may deploy its own cookies to operate video playback, sound levels, and stream telemetry.
            </p>
            <p>
              These third-party cookies are controlled entirely by their respective providers and operate under their individual corporate privacy frameworks. DALTA Esports does not access, read, or process any telemetry generated by these external player widgets.
            </p>
          </section>

          {/* Section 4 */}
          <section id="managing-cookies" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              4. Managing cookies
            </h2>
            <p>
              You maintain full authority over cookie storage through your device and browser settings. Most modern browsers (Chrome, Edge, Firefox, Safari) allow you to view stored cookies, reject persistent cookies, or automatically clear them upon closing your browser.
            </p>
            <p>
              Please note that blocking or rejecting strictly necessary authentication cookies will disrupt account features, preventing you from logging in, checking in to matches, or submitting scores.
            </p>
            <p>
              For comprehensive details regarding how DALTA Esports handles, safeguards, and respects your student information, please review our official{' '}
              <Link href="/privacy" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
                Privacy Notice
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
