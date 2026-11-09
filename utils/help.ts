// Public Help & FAQ content for /help (Nielsen #10 "help and documentation"): spectators and
// players only. The staff and admin questions are in utils/help-organizer.ts (server only), so they
// never reach the public page or the browser bundle. Keep the answers in sync when a feature
// changes. Links are app paths.

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
        q: 'How do I add a team logo or say what my team is looking for?',
        a: [
          'On your team page, the captain can add a square logo (JPG, PNG or WebP). Without one, the team’s initials are shown.',
          'Under "Looking for", tick up to 3 roles and a minimum rank. While your team is recruiting this shows on its card, and players can find it with the role and rank filters in All teams.',
        ],
        link: { href: '/teams?tab=mine', label: 'My Team' },
      },
      {
        q: 'How do I register my team for a tournament?',
        a: [
          'The captain opens the tournament and presses Register Team before the registration deadline. The team needs enough players for the game and, if the tournament requires it, every member verified.',
          'The registration is Pending until an organizer approves it; you get a notification either way. If it is rejected, the reason (when given) is shown on My Registrations.',
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
];
