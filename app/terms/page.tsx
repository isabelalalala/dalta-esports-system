import type { ReactNode } from 'react';
import Link from 'next/link';
import { TOS_VERSION } from '@/utils/terms';
import { PRIVACY_CONTACT_EMAIL } from '@/utils/privacy';
import { formatDate } from '@/utils/tournaments';

// Terms of Service. Public: no login needed.
// DRAFT for organization/adviser review — confirm the text before public launch.
// Keep it in sync with what the app really does; if it changes in an important way,
// update TOS_VERSION in utils/terms.ts so everyone is asked to accept again.
export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-gray-300 px-4 py-10">
      <article className="max-w-3xl mx-auto space-y-8 leading-relaxed">
        <header>
          <Link href="/" className="inline-block text-gold hover:underline mb-6">← Home</Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Terms of Service</h1>
          <p className="text-sm text-gray-400 mt-2">Version {TOS_VERSION} · Last updated {formatDate(TOS_VERSION)}</p>
          <p className="mt-4">
            These terms are the agreement between you and DALTA Esports for using the DALTA Esports
            Tournament Management System. By creating an account or using the service, you accept them.
            Please also read our <Link href="/privacy" className="text-gold underline">Privacy Notice</Link> and{' '}
            <Link href="/conduct" className="text-gold underline">Code of Conduct</Link>, which are part of
            these terms.
          </p>
        </header>

        <Section title="1. The service">
          <p>
            DALTA Esports is the student esports organization of the University of Perpetual Help System DALTA
            (UPHSD), Molino Campus. This system lets you create an account, form teams, register for and run
            tournaments (including AcadArena South Luzon Esports Conference events), follow schedules, brackets
            and results, watch live streams, make pick&apos;em predictions and send feedback.
          </p>
        </Section>

        <Section title="2. Who can use it">
          <ul className="list-disc pl-6 space-y-1">
            <li>You must be at least 18 years old, or have the consent of a parent or guardian who has read
              these terms and the <Link href="/privacy" className="text-gold underline">Privacy Notice</Link> with
              you. When you accept these terms you declare that this is true.</li>
            <li>Players in school tournaments must be enrolled students and may be asked for student details
              (student ID, school, course/year) for verification.</li>
            <li>One account per person. Accounts are personal and may not be shared or transferred.</li>
            <li>Tournament staff and administrator roles are given only by the organization&apos;s
              administrators.</li>
          </ul>
        </Section>

        <Section title="3. Your account">
          <ul className="list-disc pl-6 space-y-1">
            <li>Give accurate information and keep it up to date on your profile.</li>
            <li>Keep your password private. You are responsible for what happens under your account.</li>
            <li>You can delete your account at any time on your Profile. Some records are kept after deletion
              as described in the Privacy Notice.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree to follow the <Link href="/conduct" className="text-gold underline">Code of Conduct</Link>.
            In short, you must not:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Cheat, fix matches, abuse bugs, or play on someone else&apos;s account (including smurfing).</li>
            <li>Harass, threaten or discriminate against anyone, in content or in conduct.</li>
            <li>Upload unlawful, offensive or misleading content, including false match-proof screenshots.</li>
            <li>Impersonate a person, team or organizer, or register with false student details.</li>
            <li>Interfere with the service: attacks, scraping, spam, or attempts to bypass security or
              role restrictions.</li>
            <li>Use the service for gambling or any commercial purpose we have not approved.</li>
          </ul>
        </Section>

        <Section title="5. Tournaments and results">
          <ul className="list-disc pl-6 space-y-1">
            <li>Each tournament has its own rules set by the organizers; they apply together with these terms.
              Where they conflict, these terms govern.</li>
            <li>Registration may require student verification, team roster limits and deadlines. Organizers may
              approve, reject or cancel registrations.</li>
            <li>Match results are submitted by team captains with a proof screenshot and reviewed by
              organizers. Organizers&apos; decisions on results, forfeits and disputes are final.</li>
            <li>Schedules, brackets and results are public, including team names.</li>
          </ul>
        </Section>

        <Section title="6. Pick&apos;em predictions">
          <p>
            Pick&apos;em predictions are for audience engagement only. They are not gambling: no payment is
            taken and no prize is promised for correct picks. Leaderboards show your first name and the first
            letter of your last name.
          </p>
        </Section>

        <Section title="7. Content you provide">
          <ul className="list-disc pl-6 space-y-1">
            <li>You keep ownership of what you submit (for example match-proof screenshots, team descriptions
              and feedback comments).</li>
            <li>You give DALTA Esports permission to store, show and use that content to run tournaments and the
              service — including showing proof screenshots to the two teams and the staff of a match.</li>
            <li>Feedback may be analysed by an automated service for sentiment and topics and kept without your
              name for statistics.</li>
            <li>We may remove content that breaks these terms.</li>
          </ul>
        </Section>

        <Section title="8. Content we provide">
          <p>
            The service, the DALTA Esports name and logo, and the content published on the public website belong
            to DALTA Esports or its licensors. You may not copy or reuse them outside the service without
            permission, except for sharing links and previews the service offers.
          </p>
        </Section>

        <Section title="9. Third-party services">
          <p>
            Live streams are provided through Facebook and logins, the database and emails through Supabase; the
            website is hosted on Railway; feedback analysis uses Google Gemini. Their own terms and privacy
            policies apply to their parts of the service.
          </p>
        </Section>

        <Section title="10. Disclaimers and liability">
          <ul className="list-disc pl-6 space-y-1">
            <li>The service is provided &quot;as is&quot;. We do not guarantee it will always be available,
              error-free or that data will never be lost.</li>
            <li>We are not responsible for the conduct of players, teams or viewers, for content submitted by
              users, or for third-party services such as Facebook streams.</li>
            <li>To the extent the law allows, DALTA Esports is not liable for indirect damages or for losses
              beyond the fees you paid (the service is free — that amount is zero).</li>
            <li>Nothing in these terms removes rights you have under Philippine law, including the Data Privacy
              Act of 2012.</li>
          </ul>
        </Section>

        <Section title="11. Ending use">
          <ul className="list-disc pl-6 space-y-1">
            <li>You may stop using the service and delete your account at any time.</li>
            <li>We may suspend or delete accounts that break these terms or the Code of Conduct, and remove teams
              or registrations for the same reasons.</li>
            <li>Records needed for fairness and accountability (tournament results, match proofs, the activity
              log) are kept as described in the Privacy Notice.</li>
          </ul>
        </Section>

        <Section title="12. Changes to these terms">
          <p>
            If we change these terms in an important way, we will update the version above and ask you to accept
            the new version the next time you open the app. Continued use after accepting means you agree to the
            new version.
          </p>
        </Section>

        <Section title="13. Law and contact">
          <p>
            These terms are governed by the laws of the Republic of the Philippines. Questions:{' '}
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-gold underline">{PRIVACY_CONTACT_EMAIL}</a>.
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}
