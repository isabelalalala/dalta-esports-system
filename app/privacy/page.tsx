'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_CONTACT_PERSON,
  PRIVACY_NOTICE_VERSION,
} from '@/utils/privacy';
import { formatDate } from '@/utils/tournaments';
import { usePageTitle } from '@/utils/page-title';

const SECTIONS = [
  { id: 'who-we-are', navLabel: '1. Who we are' },
  { id: 'what-we-collect', navLabel: '2. What we collect' },
  { id: 'why-we-use-it', navLabel: '3. Why we use it' },
  { id: 'who-can-see-it', navLabel: '4. Who can see it' },
  { id: 'services-that-process-data', navLabel: '5. Services that process data' },
  { id: 'how-long-we-keep-it', navLabel: '6. How long we keep it' },
  { id: 'your-rights', navLabel: '7. Your rights' },
  { id: 'how-we-protect-it', navLabel: '8. How we protect it' },
  { id: 'users-under-18', navLabel: '9. Users under 18' },
  { id: 'changes-to-this-notice', navLabel: '10. Changes to this notice' },
];

export default function PrivacyNoticePage() {
  usePageTitle('Privacy Notice');
  const [activeSection, setActiveSection] = useState('who-we-are');

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
            Privacy Notice
          </h1>
          <p className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-widest">
            Last updated {formatDate(PRIVACY_NOTICE_VERSION)}
          </p>
          <p className="text-sm sm:text-base lg:text-lg text-stone-700 font-medium tracking-wide uppercase leading-relaxed pt-2 max-w-3xl mx-auto">
            DALTA Esports respects your privacy. This notice explains what personal data the DALTA Esports Tournament Management System collects, why, who can see it, how long we keep it, and what you can do about it, as required by the Data Privacy Act of 2012 (Republic Act No. 10173).
          </p>
        </div>
      </section>

      {/* 2. 2-Column Documentation Layout: Left Mini Navigation Tab + Right Policy Content */}
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

        {/* Right Policy Content Sections */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-12 sm:space-y-16 text-stone-700 text-xs sm:text-sm lg:text-base leading-relaxed">
          {/* Section 1 */}
          <section id="who-we-are" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              1. Who we are
            </h2>
            <p>
              DALTA Esports is the student esports organization of the University of Perpetual Help System DALTA (UPHSD), Molino Campus. We run this system to organize tournaments, including those of the AcadArena South Luzon Esports Conference (SLEC). DALTA Esports is responsible for the personal data in this system.
            </p>
            <p>
              Questions or requests: <strong className="text-stone-950 font-black">{PRIVACY_CONTACT_PERSON}</strong>,{' '}
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="text-amber-800 font-black uppercase underline hover:text-amber-950"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>.
            </p>
          </section>

          {/* Section 2 */}
          <section id="what-we-collect" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              2. What we collect
            </h2>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong className="text-stone-950 font-black">Account:</strong> your email address, full name, password, role (player or audience) and the date you joined. Your password is stored only in scrambled (hashed) form; nobody, including us, can read it.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Player details:</strong> in-game name (IGN), in-game role and rank for each game you play.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Student details (players):</strong> your student ID number, school and course/year, and whether an organizer verified them (with the date, and the reason if they were not accepted).
              </li>
              <li>
                <strong className="text-stone-950 font-black">Teams and tournaments:</strong> the teams you create or join, the tournaments your team registers for, match check-ins, and the results and screenshots captains submit as proof of a match result (these can show in-game names).
              </li>
              <li>
                <strong className="text-stone-950 font-black">Feedback:</strong> the ratings and comments you send (one per tournament, per match and one general), and the sentiment (positive, neutral or negative) and topics we detect in them. To stay within the analysis limits, we also note when your feedback was analysed; this note is deleted after one day.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Pick&apos;em predictions:</strong> which team you picked to win a match, and whether the pick was right.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Viewing activity:</strong> which live streams you opened and on which day. While a stream page is open, we also see that you are watching it right now; that is not saved.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Consent:</strong> the date and time you agreed to this notice.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Activity log:</strong> a record of important actions, with your name and the time, e.g. approving a registration, entering a match result, changing a role, withdrawing a registration or deleting your account. It never contains your email or student ID.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Cookies:</strong> only the cookies needed to keep you logged in. We don&apos;t use advertising or tracking cookies.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="why-we-use-it" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              3. Why we use it
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>To create and protect your account and let you log in.</li>
              <li>To run tournaments: team registration, approval, schedules, brackets and match results.</li>
              <li>To check that players in school tournaments are eligible students (student verification).</li>
              <li>To share announcements, schedules and live streams.</li>
              <li>To show you in-app notifications about your registrations, matches, teams, student verification and announcements.</li>
              <li>To understand feedback and improve future events.</li>
              <li>To prepare reports for the organizing committee, such as the number of participants, viewers and the overall sentiment of feedback. Reports show totals, not personal profiles.</li>
            </ul>
            <p className="pt-2">
              We process your data based on your consent, and because it is needed to provide the service you signed up for. We don&apos;t sell your data or use it for advertising.
            </p>
          </section>

          {/* Section 4 */}
          <section id="who-can-see-it" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              4. Who can see it
            </h2>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong className="text-stone-950 font-black">Anyone, even without an account:</strong> tournament details, brackets and match results, which include team names, and the percentage of pick&apos;em picks for each team (never who picked what). The public pages also show our officers&apos; and official players&apos; names, positions, in-game roles and photos.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Pick&apos;em leaderboards (logged-in users):</strong> your first name and the first letter of your last name (e.g. &quot;Juan C.&quot;) with your number of correct picks, once you make a pick in that tournament. Nobody else sees your individual picks.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Logged-in users:</strong> teams and their members (name, IGN and in-game role), player game profiles (IGN, in-game role, rank), team registrations, announcements, and who checked in for a match and when. Team captains can search players by name or IGN to add them to a team.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Tournament staff and administrators:</strong> all accounts, including email addresses, student details and viewing activity, to manage the system, verify students and prepare reports.
              </li>
              <li>
                Other users never see your student ID, school or course/year; they only see a &quot;Verified&quot; badge next to your name on team rosters.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Administrators only:</strong> feedback comments and their sentiment. Staff only see the number of feedback and the average rating.
              </li>
              <li>Your own feedback is visible to you and to administrators, not to other users.</li>
              <li>Result screenshots are visible only to the members of the two teams in that match and to tournament staff.</li>
              <li>
                Organizers may download files to run tournaments: registrations (which include each member&apos;s student ID, school and course/year), team rosters, schedules and results. Administrators can also download the full account list (names, email addresses, student details, consent date) and all feedback including comment text. Every download is recorded in the activity log.
              </li>
              <li>
                The activity log is visible to administrators only. It helps keep tournaments fair and lets us see who made a change.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="services-that-process-data" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              5. Services that process data for us
            </h2>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong className="text-stone-950 font-black">Supabase:</strong> stores the database and handles logins and emails (confirmation and password reset).
              </li>
              <li>
                <strong className="text-stone-950 font-black">Railway:</strong> hosts the website.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Google Gemini:</strong> detects the sentiment and topics of feedback. Only the comment and rating are sent, without your name or email. Google may keep and review this content under its own terms, so please don&apos;t write personal information in feedback.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Facebook:</strong> live streams play in Facebook&apos;s video player. When you watch, Facebook may collect data and set cookies under its own privacy policy.
              </li>
            </ul>
            <p className="pt-2">These services may store data on servers outside the Philippines.</p>
          </section>

          {/* Section 6 */}
          <section id="how-long-we-keep-it" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              6. How long we keep it
            </h2>
            <p>
              We keep your data for as long as your account exists. When you delete your account (or an administrator deletes it at your request):
            </p>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong className="text-stone-950 font-black">Deleted:</strong> your account and profile (including your student details), player details, team memberships, teams you captain alone, registrations you made, your pick&apos;em picks and your viewing activity.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Kept without your name:</strong> your feedback (rating, comment and sentiment), so event statistics stay correct. It is no longer linked to you. Saved reports may contain totals and short examples of feedback comments.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Kept as event records:</strong> tournaments, brackets, match results, and the screenshots submitted as match proof — these stay part of the event&apos;s records even after an account is deleted, and may still show in-game names. Organizers can remove the image files manually from storage when they are no longer needed. Answered team invitations are also kept as history.
              </li>
            </ul>
            <p className="pt-2">
              <strong className="text-stone-950 font-black">Activity log:</strong> entries are kept for one year, even after an account is deleted, so organizers stay accountable for their actions. They contain names only. After one year they are deleted.
            </p>
            <p>Copies in our service providers&apos; backups are removed when those backups expire.</p>
          </section>

          {/* Section 7 */}
          <section id="your-rights" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              7. Your rights
            </h2>
            <p>Under the Data Privacy Act you have the right to:</p>
            <ul className="list-disc pl-6 space-y-3">
              <li><strong className="text-stone-950 font-black">Be informed</strong> about how your data is used (this notice).</li>
              <li><strong className="text-stone-950 font-black">Access</strong> your data and get a copy of it.</li>
              <li>
                <strong className="text-stone-950 font-black">Correct</strong> wrong data. You can change your name, player details and password on your{' '}
                <Link href="/profile" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
                  Profile
                </Link>.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Object or withdraw consent</strong> and have your data{' '}
                <strong className="text-stone-950 font-black">erased</strong>: delete your account on your Profile under &quot;Delete my account&quot;. A team captain with players must remove them or delete the team first.
              </li>
              <li>
                <strong className="text-stone-950 font-black">Data portability</strong> and to{' '}
                <strong className="text-stone-950 font-black">claim damages</strong> if your data is misused.
              </li>
              <li>
                <strong className="text-stone-950 font-black">File a complaint</strong> with the National Privacy Commission (privacy.gov.ph).
              </li>
            </ul>
            <p className="pt-2">
              For anything you can&apos;t do yourself, email{' '}
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="text-amber-800 font-black uppercase underline hover:text-amber-950"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>. We will reply within 15 working days.
            </p>
          </section>

          {/* Section 8 */}
          <section id="how-we-protect-it" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              8. How we protect it
            </h2>
            <ul className="list-disc pl-6 space-y-2.5">
              <li>All connections are encrypted (HTTPS).</li>
              <li>Access rules in the database decide who can read or change each record, based on your role.</li>
              <li>Only organizers can open the management and report pages.</li>
              <li>Email links (confirmation and password reset) expire and work only once.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section id="users-under-18" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              9. Users under 18
            </h2>
            <p>
              Students under 18 may create an account only with the consent of a parent or guardian, who should read this notice with them. When you accept the{' '}
              <Link href="/terms" className="text-amber-800 font-black uppercase underline hover:text-amber-950">
                Terms of Service
              </Link>{' '}
              you declare that you are at least 18 or have that consent; we record the date and version of your acceptance. A parent or guardian can contact us to access or delete their child&apos;s data.
            </p>
          </section>

          {/* Section 10 */}
          <section id="changes-to-this-notice" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-950 tracking-wider uppercase pb-3 border-b-2 border-stone-200">
              10. Changes to this notice
            </h2>
            <p>
              If we change this notice in an important way, we will update the date above and ask you to agree again the next time you open your dashboard.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
