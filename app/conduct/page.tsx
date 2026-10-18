import Link from 'next/link';
import { PRIVACY_CONTACT_EMAIL } from '@/utils/privacy';

// Code of Conduct. Public: no login needed. Part of the Terms of Service (/terms §4).
// DRAFT for organization/adviser review — confirm the text before public launch.
export const metadata = { title: 'Code of Conduct' };

const sections: { title: string; items: string[] }[] = [
  {
    title: 'Fair play',
    items: [
      'Play to win, honestly. No cheating, exploits, match-fixing or throwing games.',
      'Play on your own account. No account sharing, and no smurfing (a second account or a lower rank to get easier matches).',
      'Follow the tournament rules and the organizers\' schedule and format.',
      'Check in on time and show up for your matches. Repeated no-shows can lead to removal.',
    ],
  },
  {
    title: 'Respect',
    items: [
      'Treat players, teams, organizers and viewers with respect — in the app, in game and at events.',
      'No harassment, hate speech, discrimination, threats or personal attacks.',
      'No names, team names or content that are offensive or impersonate others.',
    ],
  },
  {
    title: 'Honest results',
    items: [
      'Submit real results with real proof screenshots. Falsified evidence is treated as cheating.',
      'If you disagree with a result, dispute it through the app with a reason — don\'t take it elsewhere.',
      'Organizers review disputes and their decision is final.',
    ],
  },
  {
    title: 'Enforcement',
    items: [
      'Breaking this code can mean a warning, a forfeit or removal from a match or tournament, losing verification, or suspension or deletion of your account.',
      'Serious or repeated violations may be reported to your school or organization.',
      'See something that breaks this code? Report it to the organizers.',
    ],
  },
];

export default function ConductPage() {
  return (
    <main id="main-content" className="min-h-screen bg-sitebg text-gray-300 px-4 py-10">
      <article className="max-w-3xl mx-auto space-y-8 leading-relaxed">
        <header>
          <Link href="/" className="inline-block text-gold hover:underline mb-6">← Home</Link>
          <h1 className="font-pixel text-xl sm:text-2xl leading-relaxed text-gold">Code of Conduct</h1>
          <p className="mt-4">
            DALTA Esports is a school community. Compete hard, respect everyone, keep it honest.
            This code is part of the <Link href="/terms" className="text-gold underline">Terms of Service</Link>;
            breaking it can cost your account.
          </p>
        </header>

        {sections.map((s) => (
          <section key={s.title} className="space-y-3">
            <h2 className="text-xl font-bold text-white">{s.title}</h2>
            <ul className="list-disc pl-6 space-y-1">
              {s.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">Report a problem</h2>
          <p>
            Contact the organizers at{' '}
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-gold underline">{PRIVACY_CONTACT_EMAIL}</a>{' '}
            or through the feedback page in the app.
          </p>
        </section>
      </article>
    </main>
  );
}
