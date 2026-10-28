'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TOS_VERSION } from '@/utils/terms';
import { PRIVACY_CONTACT_EMAIL } from '@/utils/privacy';
import { formatDate } from '@/utils/tournaments';
import { usePageTitle } from '@/utils/page-title';

const SECTIONS = [
  { id: 'the-service', navLabel: '1. The service' },
  { id: 'who-can-use-it', navLabel: '2. Who can use it' },
  { id: 'your-account', navLabel: '3. Your account' },
  { id: 'acceptable-use', navLabel: '4. Acceptable use' },
  { id: 'tournaments-and-results', navLabel: '5. Tournaments and results' },
  { id: 'pickem-predictions', navLabel: '6. Pick\'em predictions' },
  { id: 'content-you-provide', navLabel: '7. Content you provide' },
  { id: 'content-we-provide', navLabel: '8. Content we provide' },
  { id: 'third-party-services', navLabel: '9. Third-party services' },
  { id: 'disclaimers-and-liability', navLabel: '10. Disclaimers and liability' },
  { id: 'ending-use', navLabel: '11. Ending use' },
  { id: 'changes-to-these-terms', navLabel: '12. Changes to these terms' },
  { id: 'law-and-contact', navLabel: '13. Law and contact' },
];

export default function TermsPage() {
  usePageTitle('Terms of Service');
  const [activeSection, setActiveSection] = useState('the-service');

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
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-widest">
            Version {TOS_VERSION} · Last updated {formatDate(TOS_VERSION)}
          </p>
          <p className="text-sm sm:text-base lg:text-lg text-stone-700 font-medium tracking-wide uppercase leading-relaxed pt-2 max-w-3xl mx-auto">
            These terms are the agreement between you and DALTA Esports for using the DALTA Esports Tournament Management System. By creating an account or using the service, you accept them. Please also read our{' '}
            <Link href="/privacy" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
              Privacy Notice
            </Link>{' '}
            and{' '}
            <Link href="/conduct" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
              Code of Conduct
            </Link>
            , which are part of these terms.
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
          <section id="the-service" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              1. The service
            </h2>
            <p>
              DALTA Esports is the student esports organization of the University of Perpetual Help System DALTA (UPHSD), Molino Campus. This system lets you create an account, form teams, register for and run tournaments (including AcadArena South Luzon Esports Conference events), follow schedules, brackets and results, watch live streams, make pick&apos;em predictions and send feedback.
            </p>
          </section>

          {/* Section 2 */}
          <section id="who-can-use-it" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              2. Who can use it
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>
                You must be at least 18 years old, or have the consent of a parent or guardian who has read these terms and the{' '}
                <Link href="/privacy" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
                  Privacy Notice
                </Link>{' '}
                with you. When you accept these terms you declare that this is true.
              </li>
              <li>
                Players in school tournaments must be enrolled students and may be asked for student details (student ID, school, course/year) for verification.
              </li>
              <li>One account per person. Accounts are personal and may not be shared or transferred.</li>
              <li>Tournament staff and administrator roles are given only by the organization&apos;s administrators.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="your-account" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              3. Your account
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>Give accurate information and keep it up to date on your profile.</li>
              <li>Keep your password private. You are responsible for what happens under your account.</li>
              <li>
                You can delete your account at any time on your Profile. Some records are kept after deletion as described in the Privacy Notice.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="acceptable-use" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              4. Acceptable use
            </h2>
            <p>
              You agree to follow the{' '}
              <Link href="/conduct" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
                Code of Conduct
              </Link>
              . In short, you must not:
            </p>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>Cheat, fix matches, abuse bugs, or play on someone else&apos;s account (including smurfing).</li>
              <li>Harass, threaten or discriminate against anyone, in content or in conduct.</li>
              <li>Upload unlawful, offensive or misleading content, including false match-proof screenshots.</li>
              <li>Impersonate a person, team or organizer, or register with false student details.</li>
              <li>Interfere with the service: attacks, scraping, spam, or attempts to bypass security or role restrictions.</li>
              <li>Use the service for gambling or any commercial purpose we have not approved.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="tournaments-and-results" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              5. Tournaments and results
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>Each tournament has its own rules set by the organizers; they apply together with these terms. Where they conflict, these terms govern.</li>
              <li>Registration may require student verification, team roster limits and deadlines. Organizers may approve, reject or cancel registrations.</li>
              <li>Match results are submitted by team captains with a proof screenshot and reviewed by organizers. Organizers&apos; decisions on results, forfeits and disputes are final.</li>
              <li>Schedules, brackets and results are public, including team names.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="pickem-predictions" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              6. Pick&apos;em predictions
            </h2>
            <p>
              Pick&apos;em predictions are for audience engagement only. They are not gambling: no payment is taken and no prize is promised for correct picks. Leaderboards show your first name and the first letter of your last name.
            </p>
          </section>

          {/* Section 7 */}
          <section id="content-you-provide" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              7. Content you provide
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>You keep ownership of what you submit (for example match-proof screenshots, team descriptions and feedback comments).</li>
              <li>You give DALTA Esports permission to store, show and use that content to run tournaments and the service — including showing proof screenshots to the two teams and the staff of a match.</li>
              <li>Feedback may be analysed by an automated service for sentiment and topics and kept without your name for statistics.</li>
              <li>We may remove content that breaks these terms.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section id="content-we-provide" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              8. Content we provide
            </h2>
            <p>
              The service, the DALTA Esports name and logo, and the content published on the public website belong to DALTA Esports or its licensors. You may not copy or reuse them outside the service without permission, except for sharing links and previews the service offers.
            </p>
          </section>

          {/* Section 9 */}
          <section id="third-party-services" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              9. Third-party services
            </h2>
            <p>
              Live streams are provided through Facebook and logins, the database and emails through Supabase; the website is hosted on Railway; feedback analysis uses Google Gemini. Their own terms and privacy policies apply to their parts of the service.
            </p>
          </section>

          {/* Section 10 */}
          <section id="disclaimers-and-liability" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              10. Disclaimers and liability
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>The service is provided &quot;as is&quot;. We do not guarantee it will always be available, error-free or that data will never be lost.</li>
              <li>We are not responsible for the conduct of players, teams or viewers, for content submitted by users, or for third-party services such as Facebook streams.</li>
              <li>To the extent the law allows, DALTA Esports is not liable for indirect damages or for losses beyond the fees you paid (the service is free — that amount is zero).</li>
              <li>Nothing in these terms removes rights you have under Philippine law, including the Data Privacy Act of 2012.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section id="ending-use" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              11. Ending use
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>You may stop using the service and delete your account at any time.</li>
              <li>We may suspend or delete accounts that break these terms or the Code of Conduct, and remove teams or registrations for the same reasons.</li>
              <li>Records needed for fairness and accountability (tournament results, match proofs, the activity log) are kept as described in the Privacy Notice.</li>
            </ul>
          </section>

          {/* Section 12 */}
          <section id="changes-to-these-terms" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              12. Changes to these terms
            </h2>
            <p>
              If we change these terms in an important way, we will update the version above and ask you to accept the new version the next time you open the app. Continued use after accepting means you agree to the new version.
            </p>
          </section>

          {/* Section 13 */}
          <section id="law-and-contact" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              13. Law and contact
            </h2>
            <p>
              These terms are governed by the laws of the Republic of the Philippines. Questions:{' '}
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="text-amber-800 font-black uppercase underline hover:text-amber-950"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
