// The first-login quick tour (components/QuickTour.tsx): 4 short steps per role.

export interface TourStep {
  title: string;
  text: string;
}

const MENU: TourStep = {
  title: 'Find your way around',
  text: 'Your menu is on the left on a computer, and in the bar at the bottom on a phone ("More" shows everything). ' +
    'Hover over a menu item, or press and hold it on a phone, to see what it is for.',
};

const EXTRAS: TourStep = {
  title: 'Notifications, picture and theme',
  text: 'The bell shows news about your teams and matches. Click your picture to open your profile and add a photo. ' +
    'The sun/moon button switches between light and dark.',
};

const ROLE_STEPS: Record<string, TourStep[]> = {
  player: [
    { title: 'Welcome, player!', text: 'Here you can build a team, register for tournaments, check in for matches and report results.' },
    MENU,
    {
      title: 'Join or create a team',
      text: 'Add your IGN for a game on My Profile first. Then create a team under My Team, or open Recruiting to ask a team to let you join.',
    },
    EXTRAS,
  ],
  spectator: [
    { title: 'Welcome to DALTA Esports!', text: 'Follow tournaments, watch matches live and tell us how the events went.' },
    MENU,
    {
      title: 'Watch and predict',
      text: "Open Watch Live for streams with live scores. On a tournament's bracket you can pick who will win each match (Pick'em).",
    },
    EXTRAS,
  ],
  staff: [
    { title: 'Welcome, tournament staff!', text: 'You run matches, streams and brackets, and check student details.' },
    MENU,
    {
      title: 'Start from the dashboard',
      text: '"Needs attention" lists matches waiting for you: missing check-ins and results to review. Match Control has every match.',
    },
    EXTRAS,
  ],
  admin: [
    { title: 'Welcome, administrator!', text: 'You manage tournaments, teams, users, announcements, feedback analysis and reports.' },
    MENU,
    {
      title: 'Your main tools',
      text: 'Teams lets you remove a team that breaks the rules, Users manages roles, and Reports builds the report for the committee.',
    },
    EXTRAS,
  ],
};

export function tourSteps(role: string | null | undefined): TourStep[] {
  return ROLE_STEPS[role ?? ''] ?? ROLE_STEPS.spectator;
}
