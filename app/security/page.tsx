'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PRIVACY_CONTACT_EMAIL } from '@/utils/privacy';
import { usePageTitle } from '@/utils/page-title';

const SECTIONS = [
  { id: 'reporting-a-vulnerability', navLabel: '1. Reporting a vulnerability' },
  { id: 'responsible-disclosure', navLabel: '2. Responsible disclosure' },
  { id: 'how-we-protect-the-system', navLabel: '3. How we protect the system' },
];

export default function SecurityPage() {
  usePageTitle('Security');
  const [activeSection, setActiveSection] = useState('reporting-a-vulnerability');

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
            Security Policy
          </h1>
          <p className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-widest">
            Vulnerability Reporting &amp; System Safeguards
          </p>
          <p className="text-sm sm:text-base lg:text-lg text-stone-700 font-medium tracking-wide uppercase leading-relaxed pt-2 max-w-3xl mx-auto">
            DALTA Esports is dedicated to securing our tournament infrastructure and defending our student community. This page outlines our coordinated vulnerability disclosure program and the defense mechanisms safeguarding our system.
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
          <section id="reporting-a-vulnerability" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              1. Reporting a vulnerability
            </h2>
            <p>
              If you identify a security defect, exposure, or bug within the DALTA Esports Tournament Management System, please report it immediately to our security response team:
            </p>
            <div className="rounded-2xl border border-stone-200/90 bg-amber-50/40 p-5 sm:p-6 space-y-2">
              <p className="font-bold text-stone-900">
                Primary Security Contact:{' '}
                <a
                  href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                  className="text-amber-800 font-black uppercase underline hover:text-amber-950"
                >
                  {PRIVACY_CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-xs sm:text-sm text-stone-600">
                Machine-readable RFC 9116 discovery instructions are located at{' '}
                <code className="font-mono bg-stone-100 text-stone-800 px-2 py-0.5 rounded border border-stone-200">
                  /.well-known/security.txt
                </code>
              </p>
            </div>
            <p>
              When reporting, please provide comprehensive details: a concise summary of the issue, clear reproduction steps or proof-of-concept payload, the affected endpoints, and potential severity impact.
            </p>
            <p>
              We kindly ask security researchers to give us reasonable time to triage, remediate, and verify the patch before making any technical disclosures public.
            </p>
          </section>

          {/* Section 2 */}
          <section id="responsible-disclosure" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              2. Responsible disclosure
            </h2>
            <p>
              We welcome and value constructive, ethical security research conducted in good faith. To protect the integrity of our student competitors and tournament brackets, your research must adhere to the following ground rules:
            </p>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>
                <strong>Respect User Privacy:</strong> Do not inspect, modify, or download personal data, student credentials, or private match proof belonging to other accounts.
              </li>
              <li>
                <strong>Maintain Availability:</strong> Do not execute denial of service (DoS/DDoS) attacks, automated brute-force attempts, or high-volume stress testing on production servers.
              </li>
              <li>
                <strong>No Social Engineering:</strong> Do not target students, team captains, referees, or university administrators with phishing campaigns or impersonation attempts.
              </li>
              <li>
                <strong>Coordinate Disclosures:</strong> Maintain confidentiality while our volunteer development engineers work to deploy a fix.
              </li>
            </ul>
            <p>
              Security reports made in compliance with these guidelines will not be subject to legal action by DALTA Esports.
            </p>
          </section>

          {/* Section 3 */}
          <section id="how-we-protect-the-system" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              3. How we protect the system
            </h2>
            <p>
              The DALTA Esports Tournament Management System integrates multi-layered technical controls to prevent unauthorized access and protect student data:
            </p>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>
                <strong>End-to-End Transport Encryption:</strong> All communications between your browser and our servers are encrypted in transit over modern TLS/HTTPS.
              </li>
              <li>
                <strong>Database Row Level Security (RLS):</strong> Authorization is enforced directly inside PostgreSQL policies. Interface visibility restrictions are purely aesthetic; the database validates every read, write, update, and delete against verified user roles.
              </li>
              <li>
                <strong>Cryptographic Authentication:</strong> Passwords are cryptographically salted and hashed by Supabase Auth (Argon2 / bcrypt standards). Login and password-reset links utilize one-time PKCE verifiers that expire quickly.
              </li>
              <li>
                <strong>Isolated Evidence Storage:</strong> Uploaded match result screenshots reside inside private storage buckets with strict access policies. Only participating teams and assigned tournament officials receive temporary, signed URLs.
              </li>
              <li>
                <strong>Immutable Audit Logging:</strong> Critical administrator actions, dispute resolutions, and verification status adjustments are permanently captured in a secure activity audit trail.
              </li>
              <li>
                <strong>Zero Client-Side Service Keys:</strong> Administrative capabilities exist solely within authenticated database functions, preventing privileged keys from ever being exposed in client application bundles.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
