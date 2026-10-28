'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PRIVACY_CONTACT_EMAIL } from '@/utils/privacy';
import { usePageTitle } from '@/utils/page-title';

const SECTIONS = [
  { id: 'fair-play', navLabel: '1. Fair play' },
  { id: 'respect', navLabel: '2. Respect' },
  { id: 'honest-results', navLabel: '3. Honest results' },
  { id: 'enforcement', navLabel: '4. Enforcement' },
  { id: 'report-a-problem', navLabel: '5. Report a problem' },
];

export default function ConductPage() {
  usePageTitle('Code of Conduct');
  const [activeSection, setActiveSection] = useState('fair-play');

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
            Code of Conduct
          </h1>
          <p className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-widest">
            Official Organization Ethics &amp; Sportsmanship Standards
          </p>
          <p className="text-sm sm:text-base lg:text-lg text-stone-700 font-medium tracking-wide uppercase leading-relaxed pt-2 max-w-3xl mx-auto">
            DALTA Esports is a collegiate esports community. Compete hard, respect everyone, and keep it honest. This code is an integral part of the{' '}
            <Link href="/terms" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
              Terms of Service
            </Link>
            ; violations may lead to match forfeits, disqualification, or account termination.
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
          <section id="fair-play" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              1. Fair play
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>Play to win, honestly. No cheating, exploits, match-fixing or throwing games.</li>
              <li>
                Play on your own account. No account sharing, and no smurfing (using a secondary account or lower rank to secure easier matches).
              </li>
              <li>Follow official tournament rules and the organizers&apos; schedule and format.</li>
              <li>Check in on time and show up for all scheduled matches. Repeated no-shows can lead to immediate forfeiture and removal.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section id="respect" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              2. Respect
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>Treat players, teams, organizers, casters, and spectators with dignity and respect — in the app, in-game, and at live campus events.</li>
              <li>Harassment, hate speech, discrimination, toxicity, threats, or personal attacks will not be tolerated under any circumstances.</li>
              <li>Player handles, team names, logos, or posted media must not be offensive, hateful, or impersonate others.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="honest-results" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              3. Honest results
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>Submit legitimate results with real, unedited proof screenshots. Falsified or manipulated evidence is treated as severe cheating.</li>
              <li>If you dispute a match result, submit a formal dispute with clear justification through the system.</li>
              <li>Tournament officials review all disputes thoroughly. Final decisions rendered by the organizing committee are binding and conclusive.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="enforcement" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              4. Enforcement
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>Violating this code may incur formal warnings, match forfeits, tournament disqualification, revocation of student verification status, or account suspension/deletion.</li>
              <li>Severe, repeated, or malicious infractions may be formally escalated to the University Student Affairs Office (UPHSD Molino) or partner leagues.</li>
              <li>All verified members have a responsibility to keep collegiate gaming honorable. See something that breaks this code? Report it promptly to tournament staff.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="report-a-problem" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              5. Report a problem
            </h2>
            <p>
              To report misconduct, cheating, or harassment, contact the DALTA Esports Organizing Committee at{' '}
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="text-amber-800 font-black uppercase underline hover:text-amber-950"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>{' '}
              or submit a sentiment report through the in-app feedback module.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
