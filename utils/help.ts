// Help & FAQ content for /help (Nielsen #10 "help and documentation"), one section per role.
// Plain data so the page stays simple; keep the answers in sync when a feature changes.
// Links are app paths.

export interface HelpItem {
  q: string;
  a: string[];
  link?: { href: string; label: string };
}

export interface HelpSection {
  id: 'everyone' | 'player' | 'staff' | 'admin';
  title: string;
  intro: string;
  items: HelpItem[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'everyone',
    title: 'Spectators & everyone',
    intro: 'Watching, predicting and telling us what you think. Most of it needs a free account.',
    items: [
      {
        q: 'Do I need an account?',
        a: [
          'No account is needed to browse the website, tournament pages, brackets and results.',
          'Sign up (as a Spectator or a Player) to watch streams, chat, make Pick\'em predictions, give feedback and get notifications.',
        ],
        link: { href: '/auth/register', label: 'Sign up' },
      },
      {
        q: 'How do I watch a live match?',
        a: [
          'Open Watch Live. Live streams are at the top; ended ones stay as replays.',
          'The video plays from Facebook. If it doesn\'t load, use the "Watch on Facebook" link under the player.',
          'Scores and the bracket update automatically while the page is open.',
        ],
        link: { href: '/live', label: 'Watch Live' },
      },
      {
        q: 'How does the live chat work, and what are warnings?',
        a: [
          'Comments are checked automatically by AI. Swearing stays visible but gives you a warning; bullying, harassment, hate speech, threats or sexual content are hidden and also give a warning.',
          'A moderator can restore a comment hidden by mistake, which removes its warning.',
          'With 5 active warnings your account is flagged and an administrator decides on a ban. You can see your warnings on your profile.',
          'You can delete your own visible comments (there is an Undo for a few seconds).',
        ],
        link: { href: '/profile#warnings', label: 'My warnings' },
      },
      {
        q: 'What is Pick\'em?',
        a: [
          'Predict the winner of upcoming matches under each bracket box or on the match page. Picks lock when the match starts.',
          'Correct picks earn a place on the tournament\'s Pick\'em leaderboard. Players can\'t pick their own team\'s matches.',
        ],
        link: { href: '/tournaments', label: 'Tournaments' },
      },
      {
        q: 'How do I give feedback?',
        a: [
          'Go to Give Feedback, choose General, a tournament or one match, pick 1 to 5 stars and write a short comment.',
          'You can send one feedback per tournament, per match and one general. It is analysed by AI ("Analyzing…") and summarized for the organizers.',
          'Changed your mind? Use Edit or Delete in My History (not while a moderator is reviewing it).',
        ],
        link: { href: '/feedback', label: 'Give Feedback' },
      },
      {
        q: 'How do I add matches to my calendar or share a tournament?',
        a: [
          'Tournament, match and team pages have "Add to calendar" (a file for any calendar app) and Subscribe, which keeps the times up to date when a match is rescheduled. Share copies the link or opens your phone’s share sheet.',
        ],
      },
    ],
  },
  {
    id: 'player',
    title: 'Players',
    intro: 'From your game profile to entering results. Captains do the team tasks.',
    items: [
      {
        q: 'How do I create a game profile?',
        a: [
          'Open My Profile → Game profiles → Add, choose the game and fill in its form: IGN, account ID (Riot ID, MLBB User and Zone ID, CODM UID or Tekken ID), rank, main role and more.',
          'The form checks the format before saving (for example a Riot ID must look like Name#TAG).',
          'Only you and the organizers see your account IDs. Other players see your IGN, rank and role.',
        ],
        link: { href: '/profile', label: 'My Profile' },
      },
      {
        q: 'Why do I need student verification?',
        a: [
          'Most tournaments are for students only. Add your student ID, school and course/year on My Profile; an organizer checks them.',
          'Every member of a team must be verified to register for such a tournament. If you are rejected, the reason is shown on your profile.',
        ],
        link: { href: '/profile', label: 'Student details' },
      },
      {
        q: 'How do I create a team and get players?',
        a: [
          'Go to My Team → Create Team. You need a game profile for that game and you become the captain.',
          'Invite players from the team page (search by name or IGN, filter by role and rank), or turn on Recruiting so players can ask to join.',
          'Players answer invites from My Team; captains accept or decline join requests (also all at once).',
        ],
        link: { href: '/teams?tab=mine', label: 'My Team' },
      },
      {
        q: 'How do I register my team for a tournament?',
        a: [
          'The captain opens the tournament and presses Register Team before the registration deadline. The team needs enough players for the game and, if the tournament requires it, every member verified.',
          'The registration is Pending until an organizer approves it; you get a notification either way.',
          'While registered, the roster is locked. You can withdraw from My Registrations while it is still pending.',
        ],
        link: { href: '/registrations', label: 'My Registrations' },
      },
      {
        q: 'What is check-in?',
        a: [
          'Shortly before a match (usually 30 minutes) the captains get a notification and press Check in on the match page.',
          'A team that doesn\'t check in may lose by forfeit.',
        ],
        link: { href: '/schedule', label: 'My Matches' },
      },
      {
        q: 'How do we report a match result?',
        a: [
          'After the match, either captain opens the match page, enters the score and uploads a screenshot (PNG, JPG or WebP, up to 5 MB).',
          'The other captain confirms or disputes it (a dispute needs a reason). Staff then approve, correct or reject it, and the winner moves on in the bracket.',
        ],
      },
      {
        q: 'How do I leave a team or hand over the captaincy?',
        a: [
          'Members leave from the team page. Captains can remove players or make someone else captain.',
          'Rosters can\'t change while the team is registered for a tournament that hasn\'t ended.',
        ],
      },
    ],
  },
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
