// Role-based navigation (sidebar, phone bottom bar, breadcrumbs). Pure data + functions; the icons
// are mapped in components/site/SiteNavLayout.tsx. What a role can DO is still decided by
// utils/permissions.ts and enforced by the database: hiding a link is only convenience.
//
// Logged-out visitors get the spectator menu without the pages that need an account.

export type NavIcon =
  | 'home' | 'dashboard' | 'events' | 'tournaments' | 'live' | 'teams' | 'feedback' | 'profile' | 'myteam'
  | 'schedule' | 'recruiting' | 'matches' | 'brackets' | 'users' | 'announcements' | 'sentiment' | 'reports'
  | 'verification' | 'website' | 'activity' | 'about' | 'campaigns' | 'divisions' | 'community' | 'stats'
  | 'registrations' | 'moderation';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  // Tooltip text (hover / long press)
  hint: string;
  // Also highlight this item on these paths (e.g. Dashboard while on /admin/...)
  alsoActive?: string[];
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export interface RoleNav {
  groups: NavGroup[];
  // Phone bottom bar: up to 4 items; "More" opens the full menu
  bottom: NavItem[];
}

const I = {
  home: { href: '/', label: 'Home', icon: 'home', hint: 'The DALTA Esports home page' },
  dashboard: { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', hint: 'Your shortcuts and what needs your attention' },
  events: { href: '/events', label: 'Events', icon: 'events', hint: 'Upcoming DALTA events' },
  tournaments: { href: '/tournaments', label: 'Tournaments', icon: 'tournaments', hint: 'All tournaments, brackets and registration' },
  live: { href: '/live', label: 'Watch Live', icon: 'live', hint: 'Live streams and replays of matches' },
  teams: { href: '/teams?tab=all', label: 'Teams', icon: 'teams', hint: 'Browse every team and its roster' },
  feedback: { href: '/feedback', label: 'Give Feedback', icon: 'feedback', hint: 'Rate a tournament or match and tell us what to improve' },
  profile: { href: '/profile', label: 'My Profile', icon: 'profile', hint: 'Your name, picture, game profiles and student details' },
  myTeam: { href: '/teams?tab=mine', label: 'My Team', icon: 'myteam', hint: 'Your teams, invites and join requests' },
  schedule: { href: '/schedule', label: 'My Matches & Schedule', icon: 'schedule', hint: 'Upcoming matches and latest results' },
  recruiting: { href: '/teams?tab=all&recruiting=1', label: 'Recruiting', icon: 'recruiting', hint: 'Teams looking for players: ask to join one' },
  registrations: { href: '/registrations', label: 'My Registrations', icon: 'registrations', hint: 'Your tournament registrations and their status' },
  matchControl: { href: '/matches', label: 'Match Control', icon: 'matches', hint: 'Schedule matches, check-ins, results and forfeits' },
  streams: { href: '/live', label: 'Streams', icon: 'live', hint: 'Watch streams; set them up from each tournament' },
  brackets: { href: '/tournaments', label: 'Brackets', icon: 'brackets', hint: 'Open a tournament to generate or follow its bracket' },
  manageTeams: { href: '/admin/teams', label: 'Teams', icon: 'teams', hint: 'Every team; remove teams that break the rules' },
  users: { href: '/admin/users', label: 'Users', icon: 'users', hint: 'Roles, names and accounts' },
  announcements: { href: '/announcements', label: 'Announcements', icon: 'announcements', hint: 'News and updates for players and audience' },
  sentiment: { href: '/admin/feedback', label: 'Feedback & Sentiment', icon: 'sentiment', hint: 'What people say, analysed by AI' },
  reports: { href: '/analytics', label: 'Reports', icon: 'reports', hint: 'Generate and save administrative reports' },
  stats: { href: '/analytics/engagement', label: 'Engagement Stats', icon: 'stats', hint: 'Viewers, watching now and audience activity' },
  verification: { href: '/admin/verification', label: 'Student Verification', icon: 'verification', hint: "Check players' student details" },
  website: { href: '/admin/website', label: 'Website', icon: 'website', hint: 'Edit the public pages, photos and teams' },
  activity: { href: '/admin/activity', label: 'Activity Log', icon: 'activity', hint: 'Who did what, and when' },
  moderation: { href: '/admin/moderation', label: 'Moderation', icon: 'moderation', hint: 'Hidden comments, warnings and bans' },
  moderationQueue: { href: '/admin/moderation', label: 'Moderation Queue', icon: 'moderation', hint: 'Comments the AI hid: restore or remove them' },
  about: { href: '/about', label: 'About Us', icon: 'about', hint: 'Who we are' },
  campaigns: { href: '/campaigns', label: 'Campaigns', icon: 'campaigns', hint: 'Our campaigns and programs' },
  divisions: { href: '/divisions', label: 'Game Divisions', icon: 'divisions', hint: 'Our official teams per game' },
  community: { href: '/community', label: 'Community', icon: 'community', hint: 'Join the DALTA community' },
} satisfies Record<string, NavItem>;

const EXPLORE: NavGroup = { label: 'Explore', items: [I.about, I.campaigns, I.divisions, I.community] };

export function navFor(role: string | null | undefined, loggedIn: boolean): RoleNav {
  if (role === 'admin') {
    const dashboard = { ...I.dashboard, alsoActive: ['/admin'] };
    return {
      groups: [
        { label: null, items: [dashboard, I.tournaments, I.manageTeams, I.users, I.announcements, I.moderation, I.sentiment, I.reports] },
        { label: 'Tools', items: [I.matchControl, I.streams, I.verification, I.website, I.activity] },
        { label: 'Explore', items: [I.home, ...EXPLORE.items] },
      ],
      bottom: [dashboard, I.tournaments, I.manageTeams, I.reports],
    };
  }
  if (role === 'staff') {
    return {
      groups: [
        { label: null, items: [I.dashboard, I.matchControl, I.streams, I.brackets, I.manageTeams, I.moderationQueue] },
        { label: 'Tools', items: [I.verification, I.announcements, I.stats, I.schedule] },
        { label: 'Explore', items: [I.home, ...EXPLORE.items] },
      ],
      bottom: [I.dashboard, I.matchControl, I.streams, I.manageTeams],
    };
  }
  const spectator: NavItem[] = [I.home, ...(loggedIn ? [I.dashboard] : []), I.events, I.tournaments, I.live, I.teams, I.feedback];
  if (role === 'player') {
    return {
      groups: [
        { label: null, items: spectator },
        { label: 'My stuff', items: [I.profile, I.myTeam, I.schedule, I.recruiting, I.registrations] },
        EXPLORE,
      ],
      bottom: [I.dashboard, I.tournaments, I.myTeam, I.live],
    };
  }
  return {
    groups: [{ label: null, items: spectator }, EXPLORE],
    bottom: loggedIn ? [I.dashboard, I.live, I.tournaments, I.feedback] : [],
  };
}

// Is this item the current page? Paths match by prefix ("/tournaments" covers /tournaments/123);
// items with a query (?tab=mine) also need those query values, so My Team and Teams don't both light up.
export function isNavActive(pathname: string, search: URLSearchParams, item: NavItem): boolean {
  const [path, query] = item.href.split('?');
  const pathMatch = path === '/'
    ? pathname === '/'
    : pathname === path || pathname.startsWith(`${path}/`) ||
      (item.alsoActive ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!pathMatch) return false;
  if (!query) return true;
  const wanted = new URLSearchParams(query);
  for (const [key, value] of wanted) {
    if ((search.get(key) ?? defaultQuery(path, key)) !== value) return false;
  }
  // "Teams" (?tab=all) shouldn't also light up on the Recruiting filter
  if (!wanted.has('recruiting') && search.get('recruiting')) return false;
  return true;
}

// What a page shows without the query: /teams opens on "mine" (the page decides the default for
// non-players, but players are the only ones with both links)
function defaultQuery(path: string, key: string) {
  return path === '/teams' && key === 'tab' ? 'mine' : null;
}

// The single most specific active item, so only one link is highlighted
export function activeItem(pathname: string, search: URLSearchParams, items: NavItem[]): NavItem | null {
  const matches = items.filter((i) => isNavActive(pathname, search, i));
  if (matches.length === 0) return null;
  return matches.reduce((best, i) => (i.href.length > best.href.length ? i : best));
}

// ---------------------------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------------------------

export interface Crumb {
  href: string | null; // null = not a page of its own (e.g. /admin)
  label: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', tournaments: 'Tournaments', teams: 'Teams', matches: 'Matches', live: 'Watch Live',
  schedule: 'Schedule', profile: 'My Profile', registrations: 'Registrations', announcements: 'Announcements',
  feedback: 'Feedback', notifications: 'Notifications', analytics: 'Reports', reports: 'Saved report',
  engagement: 'Engagement', users: 'Users', verification: 'Student Verification', website: 'Website',
  activity: 'Activity Log', edit: 'Edit', create: 'Create', streams: 'Streams', predictions: "Pick'em",
  events: 'Events', campaigns: 'Campaigns', divisions: 'Game Divisions', about: 'About Us', community: 'Community',
  match: 'Match', search: 'Search', privacy: 'Privacy', terms: 'Terms', consent: 'Consent', accept: 'Accept',
  moderation: 'Moderation', banned: 'Account banned',
};

// Labels for an id segment, by the segment before it
const ID_LABELS: Record<string, string> = {
  tournaments: 'Tournament', teams: 'Team', matches: 'Match', live: 'Stream', reports: 'Report',
  events: 'Event', campaigns: 'Campaign', t: 'Tournament', match: 'Match',
};

// Segments left out of the trail (/admin/users -> Home > Users; /t/<id> -> Home > Tournament)
const SKIPPED = new Set(['admin', 't']);
// Crumbs that aren't pages of their own (shown without a link)
const NOT_A_PAGE = [/^\/analytics\/reports$/, /^\/t\/[^/]+\/match$/];

// "Home > Tournaments > Tournament > Edit" for /tournaments/<id>/edit. `names` maps a path to a
// better label (a team or tournament name) that the page supplies once it has loaded.
export function breadcrumbsFor(pathname: string, names: Record<string, string> = {}): Crumb[] {
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ href: '/', label: 'Home' }];
  let path = '';
  parts.forEach((part, i) => {
    path += `/${part}`;
    if (i === 0 && SKIPPED.has(part)) return;
    const label = names[path]
      ?? SEGMENT_LABELS[part]
      ?? ID_LABELS[parts[i - 1] ?? '']
      ?? decodeURIComponent(part).replace(/-/g, ' ');
    crumbs.push({ href: NOT_A_PAGE.some((re) => re.test(path)) ? null : path, label });
  });
  return crumbs;
}

// Inner pages (two or more levels deep, e.g. /teams/<id>) get breadcrumbs and a back button
export function isInnerPage(pathname: string): boolean {
  return pathname.split('/').filter(Boolean).length >= 2;
}
