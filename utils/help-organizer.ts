import 'server-only';
import type { HelpSection } from '@/utils/help';

// Staff and admin Help & FAQ. Server only (the import above makes the build fail if a client file
// imports it): app/(site)/help/OrganizerHelp.tsx renders these sections only after checking the
// logged-in user's role on the server, so visitors, players and spectators never receive them.
// Staff get the staff section; admins get both. Keep the answers in sync when a feature changes.

export const ORGANIZER_HELP_SECTIONS: HelpSection[] = [
  {
    id: 'staff',
    title: 'Tournament staff',
    intro: 'Running matches, streams, check-ins and the moderation queue.',
    items: [
      {
        q: 'How do I run a match?',
        a: [
          'Match Control lists every match. Open one to set the time, mark it live, enter scores and complete it; the winner advances automatically.',
          'The dashboard\'s "Needs attention" box lists teams that didn\'t check in and results waiting for you.',
          'A forfeit can be declared once the match time has passed.',
        ],
        link: { href: '/matches', label: 'Match Control' },
      },
      {
        q: 'How do I set up a stream? (checklist)',
        a: [
          '1. On Facebook, make sure the video or live is Public (not Friends or a private group).',
          '2. Copy the video link: a /videos/, /watch, /reel or share link all work. The app turns it into the full address.',
          '3. Open the tournament → Streams → Add Stream, paste the link and optionally pick the match. The link is checked as you paste it.',
          '4. If the form warns that Facebook can’t show the video here, the video isn’t Public, is on a personal profile, or has embedding turned off.',
          '5. Set the status to Live when it starts and Ended afterwards: viewers see the replay.',
        ],
        link: { href: '/live', label: 'Streams' },
      },
      {
        q: 'How do I review results and disputes?',
        a: [
          'Open the match from "Needs attention". Approve the submitted score, override it with the correct one, or reject it with a note the captains will see.',
        ],
      },
      {
        q: 'How does the moderation queue work?',
        a: [
          'Comments the AI hid wait in Moderation. Restore one (its warning is removed) or confirm the removal. Tick several to handle them at once.',
        ],
        link: { href: '/admin/moderation', label: 'Moderation' },
      },
      {
        q: 'How do I review reported comments?',
        a: [
          'Viewers can report comments the AI let through. They appear in Moderation → Reported, grouped per comment with the reasons. Remove (optionally with a warning) or Keep; both are recorded in the activity log.',
        ],
        link: { href: '/admin/moderation?tab=reported', label: 'Reported comments' },
      },
      {
        q: 'How do I protect my organizer account?',
        a: [
          'Turn on two-factor authentication on My Profile: scan the QR code with an authenticator app and enter one code. After that every login asks for a code, and without it your account has no organizer powers.',
          'Organizer accounts are also logged out after 30 minutes without activity (you get a warning a minute before).',
        ],
        link: { href: '/profile', label: 'My Profile' },
      },
      {
        q: 'How do I check student details?',
        a: [
          'Student Verification lists pending students. Approve, or reject with a reason the player will see.',
        ],
        link: { href: '/admin/verification', label: 'Student Verification' },
      },
    ],
  },
  {
    id: 'admin',
    title: 'Administrators',
    intro: 'Accounts, the public website, reports and bans.',
    items: [
      {
        q: 'How do I make someone staff or admin?',
        a: [
          'They register normally, then you change their role on Users. The last admin can\'t be demoted.',
        ],
        link: { href: '/admin/users', label: 'Users' },
      },
      {
        q: 'How do I generate a report?',
        a: [
          'Reports → choose the tournament, game, dates and data source → Generate report. It is saved with charts and a written interpretation under each chart.',
          'Open a saved report to export it as PDF or download the data as CSV.',
        ],
        link: { href: '/analytics', label: 'Reports' },
      },
      {
        q: 'What does the sentiment analysis show?',
        a: [
          'Feedback and comments are labelled positive, neutral or negative with up to 3 topics. "Common concerns" are the topics of negative feedback.',
          'If the AI was unavailable, items stay "pending analysis": use Retry pending analysis on Feedback & Sentiment.',
        ],
        link: { href: '/admin/feedback', label: 'Feedback & Sentiment' },
      },
      {
        q: 'How do bans work?',
        a: [
          'An account with 5 active warnings is flagged. On Moderation → Pending bans you ban it or dismiss the flag (both reset the warnings).',
          'Banned accounts can\'t log in or post. Every decision is written to the activity log.',
        ],
        link: { href: '/admin/moderation?tab=bans', label: 'Pending bans' },
      },
      {
        q: 'Can I schedule an announcement?',
        a: [
          'Yes. In the announcement form, fill in "Publish later" with a date and time. Until then only organizers see it (marked Scheduled); at that time it appears for everyone and the notification goes out (checked every 5 minutes).',
          'Tick "Draft" to save it without publishing: drafts are never shown to players or spectators and send no notification until you untick it.',
        ],
        link: { href: '/announcements', label: 'Announcements' },
      },
      {
        q: 'How do I make a good announcement post?',
        a: [
          'Pick a category (it sets the badge color), the game, and optionally a cover image (wide 16:9 works best; without one the card uses the game logo on the category colors). Use the toolbar for headings, lists, bold, links, images, and a Facebook video link on its own line.',
          'Link card: link the tournament, match, stream or event the post is about. Readers then see live details: the score and winner for a match, a countdown, Watch Live, View Bracket, or Register Now for players.',
          'Pin up to 3 posts to feature them on top. Urgent posts get a red style and a banner across the whole site; use it only for schedule changes, cancellations and similar. The card preview on the right shows how it will look.',
        ],
        link: { href: '/announcements', label: 'Announcements' },
      },
      {
        q: 'How do I edit the public website?',
        a: [
          'Website → Site text, carousel, campaigns, events, divisions, officers and official teams. Unpublished items are drafts only you can see.',
          'Social links and the contact email in Site text appear in the footer as soon as they are filled in.',
        ],
        link: { href: '/admin/website', label: 'Website' },
      },
    ],
  },
];
