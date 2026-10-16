import type { ReactNode } from 'react';
import Link from 'next/link';
import { PRIVACY_CONTACT_EMAIL, PRIVACY_CONTACT_PERSON, PRIVACY_NOTICE_VERSION } from '@/utils/privacy';
import { formatDate } from '@/utils/tournaments';

// Privacy Notice (Data Privacy Act of 2012, RA 10173). Public: no login needed.
// Keep it in sync with what the app really does; if it changes in an important way,
// update PRIVACY_NOTICE_VERSION in utils/privacy.ts.
export const metadata = { title: 'Privacy notice' };

export default function PrivacyNoticePage() {
  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-gray-300 px-4 py-10">
      <article className="max-w-3xl mx-auto space-y-8 leading-relaxed">
        <header>
          <Link href="/" className="inline-block text-gold hover:underline mb-6">← Home</Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Privacy Notice</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated {formatDate(PRIVACY_NOTICE_VERSION)}</p>
          <p className="mt-4">
            DALTA Esports respects your privacy. This notice explains what personal data the DALTA Esports
            Tournament Management System collects, why, who can see it, how long we keep it, and what you can do
            about it, as required by the Data Privacy Act of 2012 (Republic Act No. 10173).
          </p>
        </header>

        <Section title="1. Who we are">
          <p>
            DALTA Esports is the student esports organization of the University of Perpetual Help System DALTA
            (UPHSD), Molino Campus. We run this system to organize tournaments, including those of the AcadArena
            South Luzon Esports Conference (SLEC). DALTA Esports is responsible for the personal data in this
            system.
          </p>
          <p>
            Questions or requests: <strong className="text-white">{PRIVACY_CONTACT_PERSON}</strong>,{' '}
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-gold underline">{PRIVACY_CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="2. What we collect">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-white">Account:</strong> your email address, full name, password, role
              (player or audience) and the date you joined. Your password is stored only in scrambled (hashed) form;
              nobody, including us, can read it.</li>
            <li><strong className="text-white">Player details:</strong> in-game name (IGN), in-game role and rank
              for each game you play.</li>
            <li><strong className="text-white">Student details (players):</strong> your student ID number, school and
              course/year, and whether an organizer verified them (with the date, and the reason if they were not
              accepted).</li>
            <li><strong className="text-white">Teams and tournaments:</strong> the teams you create or join, the
              tournaments your team registers for, match check-ins, and the results and screenshots captains submit
              as proof of a match result (these can show in-game names).</li>
            <li><strong className="text-white">Feedback:</strong> the ratings and comments you send (one per
              tournament, per match and one general), and the sentiment (positive, neutral or negative) and topics
              we detect in them. To stay within the analysis limits, we also note when your feedback was analysed;
              this note is deleted after one day.</li>
            <li><strong className="text-white">Pick&apos;em predictions:</strong> which team you picked to win a
              match, and whether the pick was right.</li>
            <li><strong className="text-white">Viewing activity:</strong> which live streams you opened and on which
              day. While a stream page is open, we also see that you are watching it right now; that is not saved.</li>
            <li><strong className="text-white">Consent:</strong> the date and time you agreed to this notice.</li>
            <li><strong className="text-white">Activity log:</strong> a record of important actions, with your name
              and the time, e.g. approving a registration, entering a match result, changing a role, withdrawing a
              registration or deleting your account. It never contains your email or student ID.</li>
            <li><strong className="text-white">Cookies:</strong> only the cookies needed to keep you logged in. We
              don&apos;t use advertising or tracking cookies.</li>
          </ul>
        </Section>

        <Section title="3. Why we use it">
          <ul className="list-disc pl-6 space-y-1">
            <li>To create and protect your account and let you log in.</li>
            <li>To run tournaments: team registration, approval, schedules, brackets and match results.</li>
            <li>To check that players in school tournaments are eligible students (student verification).</li>
            <li>To share announcements, schedules and live streams.</li>
            <li>To show you in-app notifications about your registrations, matches, teams, student verification and
              announcements.</li>
            <li>To understand feedback and improve future events.</li>
            <li>To prepare reports for the organizing committee, such as the number of participants, viewers and
              the overall sentiment of feedback. Reports show totals, not personal profiles.</li>
          </ul>
          <p>
            We process your data based on your consent, and because it is needed to provide the service you signed
            up for. We don&apos;t sell your data or use it for advertising.
          </p>
        </Section>

        <Section title="4. Who can see it">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-white">Anyone, even without an account:</strong> tournament details,
              brackets and match results, which include team names, and the percentage of pick&apos;em picks for
              each team (never who picked what). The public pages also show our officers&apos; and official
              players&apos; names, positions, in-game roles and photos.</li>
            <li><strong className="text-white">Pick&apos;em leaderboards (logged-in users):</strong> your first name
              and the first letter of your last name (e.g. &quot;Juan C.&quot;) with your number of correct picks, once
              you make a pick in that tournament. Nobody else sees your individual picks.</li>
            <li><strong className="text-white">Logged-in users:</strong> teams and their members (name, IGN and
              in-game role), player game profiles (IGN, in-game role, rank), team registrations, announcements,
              and who checked in for a match and when. Team captains can search players by name or IGN to add
              them to a team.</li>
            <li><strong className="text-white">Tournament staff and administrators:</strong> all accounts,
              including email addresses, student details and viewing activity, to manage the system, verify students
              and prepare reports.</li>
            <li>Other users never see your student ID, school or course/year; they only see a &quot;Verified&quot;
              badge next to your name on team rosters.</li>
            <li><strong className="text-white">Administrators only:</strong> feedback comments and their sentiment.
              Staff only see the number of feedback and the average rating.</li>
            <li>Your own feedback is visible to you and to administrators, not to other users.</li>
            <li>Result screenshots are visible only to the members of the two teams in that match and to tournament
              staff.</li>
            <li>Organizers may download files to run tournaments: registrations (which include each member&apos;s
              student ID, school and course/year), team rosters, schedules and results. Administrators can also
              download the full account list (names, email addresses, student details, consent date) and all
              feedback including comment text. Every download is recorded in the activity log.</li>
            <li>The activity log is visible to administrators only. It helps keep tournaments fair and lets us see
              who made a change.</li>
          </ul>
        </Section>

        <Section title="5. Services that process data for us">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-white">Supabase:</strong> stores the database and handles logins and
              emails (confirmation and password reset).</li>
            <li><strong className="text-white">Railway:</strong> hosts the website.</li>
            <li><strong className="text-white">Google Gemini:</strong> detects the sentiment and topics of feedback.
              Only the comment and rating are sent, without your name or email. Google may keep and review this
              content under its own terms, so please don&apos;t write personal information in feedback.</li>
            <li><strong className="text-white">Facebook:</strong> live streams play in Facebook&apos;s video
              player. When you watch, Facebook may collect data and set cookies under its own privacy policy.</li>
          </ul>
          <p>These services may store data on servers outside the Philippines.</p>
        </Section>

        <Section title="6. How long we keep it">
          <p>
            We keep your data for as long as your account exists. When you delete your account (or an administrator
            deletes it at your request):
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-white">Deleted:</strong> your account and profile (including your student
              details), player details, team
              memberships, teams you captain alone, registrations you made, your pick&apos;em picks and your viewing
              activity.</li>
            <li><strong className="text-white">Kept without your name:</strong> your feedback (rating, comment and
              sentiment), so event statistics stay correct. It is no longer linked to you. Saved reports may contain
              totals and short examples of feedback comments.</li>
            <li><strong className="text-white">Kept as event records:</strong> tournaments, brackets, match
              results, and the screenshots submitted as match proof — these stay part of the event&apos;s records
              even after an account is deleted, and may still show in-game names. Organizers can remove the
              image files manually from storage when they are no longer needed. Answered team invitations are
              also kept as history.</li>
          </ul>
          <p>
            <strong className="text-white">Activity log:</strong> entries are kept for one year, even after an account is
            deleted, so organizers stay accountable for their actions. They contain names only. After one year they
            are deleted.
          </p>
          <p>Copies in our service providers&apos; backups are removed when those backups expire.</p>
        </Section>

        <Section title="7. Your rights">
          <p>Under the Data Privacy Act you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong className="text-white">Be informed</strong> about how your data is used (this notice).</li>
            <li><strong className="text-white">Access</strong> your data and get a copy of it.</li>
            <li><strong className="text-white">Correct</strong> wrong data. You can change your name, player
              details and password on your <Link href="/profile" className="text-gold underline">Profile</Link>.</li>
            <li><strong className="text-white">Object or withdraw consent</strong> and have your data
              <strong className="text-white"> erased</strong>: delete your account on your Profile under
              &quot;Delete my account&quot;. A team captain with players must remove them or delete the team first.</li>
            <li><strong className="text-white">Data portability</strong> and to <strong className="text-white">claim
              damages</strong> if your data is misused.</li>
            <li><strong className="text-white">File a complaint</strong> with the National Privacy Commission
              (privacy.gov.ph).</li>
          </ul>
          <p>
            For anything you can&apos;t do yourself, email{' '}
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-gold underline">{PRIVACY_CONTACT_EMAIL}</a>.
            We will reply within 15 working days.
          </p>
        </Section>

        <Section title="8. How we protect it">
          <ul className="list-disc pl-6 space-y-1">
            <li>All connections are encrypted (HTTPS).</li>
            <li>Access rules in the database decide who can read or change each record, based on your role.</li>
            <li>Only organizers can open the management and report pages.</li>
            <li>Email links (confirmation and password reset) expire and work only once.</li>
          </ul>
        </Section>

        <Section title="9. Users under 18">
          <p>
            Students under 18 may create an account only with the consent of a parent or guardian, who should read
            this notice with them. A parent or guardian can contact us to access or delete their child&apos;s data.
          </p>
        </Section>

        <Section title="10. Changes to this notice">
          <p>
            If we change this notice in an important way, we will update the date above and ask you to agree again
            the next time you open your dashboard.
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
