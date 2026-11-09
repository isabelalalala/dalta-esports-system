// Role-based permissions: what each role may do, in one place.
//
// The UI uses can(role, action) to decide whether a button, link or form is rendered at all.
// This is only a convenience: every action is also enforced in the database (RLS policies,
// triggers, security definer functions) or in the API route. The full table of where each
// rule is enforced is in docs/permissions.md: keep both in sync.
//
// Rules about a relationship ("captain of THIS team", "member of THIS match") are not roles,
// so they stay next to the data on each page (e.g. isCaptain) and are enforced by RLS.

export type Role = 'admin' | 'staff' | 'player' | 'spectator';

export type Action =
  // Tournaments
  | 'tournament.create'
  | 'tournament.edit'
  | 'tournament.delete'
  | 'tournament.register'      // register one of your teams (captain)
  | 'registration.review'      // approve / reject / view all registrations
  | 'bracket.generate'
  // Teams
  | 'team.create'
  | 'team.join'                // ask to join, accept invites, "My teams"
  | 'team.toggleRecruiting'    // organizer override (the captain may always toggle their own team)
  | 'team.remove'
  | 'team.removeLogo'          // take down a team logo with a reason (remove_team_logo)
  | 'team.restore'
  | 'team.viewRemoved'
  // Matches
  | 'match.manage'             // schedule, edit, results review, forfeit, check-in override
  | 'match.checkIn'            // captains of the match
  | 'match.submitResult'       // captains of the match
  | 'prediction.pick'
  // Streams
  | 'stream.watch'
  | 'stream.configure'
  // Event info
  | 'announcement.post'
  // Feedback
  | 'feedback.submit'
  | 'feedback.viewAll'
  // Reports and admin pages
  | 'report.generate'
  | 'report.viewEngagement'
  | 'export.operations'        // registrations, rosters, matches
  | 'export.sensitive'         // feedback, users
  | 'user.manage'
  | 'verification.submit'
  | 'verification.review'
  | 'website.edit'
  | 'games.editProfiles'       // game profile fields and options (/admin/games)
  | 'activity.view'
  // Moderation (Phase 4)
  | 'comment.post'             // logged-in users; flagged/banned accounts are refused by the database
  | 'moderation.review'        // hidden comments queue: restore / remove
  | 'moderation.ban';          // warnings, bans, hidden feedback

const ORGANIZER: Action[] = [
  'tournament.create',
  'tournament.edit',
  'registration.review',
  'bracket.generate',
  'team.toggleRecruiting',
  'team.remove',
  'team.removeLogo',
  'team.viewRemoved',
  'match.manage',
  'stream.watch',
  'stream.configure',
  'feedback.submit',
  'report.viewEngagement',
  'export.operations',
  'verification.review',
  'comment.post',
  'moderation.review',
];

export const PERMISSIONS: Record<Role, readonly Action[]> = {
  admin: [
    ...ORGANIZER,
    'tournament.delete',
    'team.restore',
    'announcement.post',
    'feedback.viewAll',
    'report.generate',
    'export.sensitive',
    'user.manage',
    'website.edit',
    'games.editProfiles',
    'activity.view',
    'moderation.ban',
  ],
  staff: ORGANIZER,
  player: [
    'tournament.register',
    'team.create',
    'team.join',
    'match.checkIn',
    'match.submitResult',
    'prediction.pick',
    'stream.watch',
    'feedback.submit',
    'verification.submit',
    'comment.post',
  ],
  spectator: ['prediction.pick', 'stream.watch', 'feedback.submit', 'comment.post'],
};

// Turns whatever is stored in profiles.role (or nothing) into a Role.
// Logged-out visitors and unknown values are treated as spectators.
export function toRole(value: string | null | undefined): Role {
  return value === 'admin' || value === 'staff' || value === 'player' ? value : 'spectator';
}

// Pass the stored role, or null/undefined for a logged-out visitor.
// Logged-out visitors get no actions at all: everything in the list needs an account.
export function can(role: string | null | undefined, action: Action): boolean {
  if (!role) return false;
  return PERMISSIONS[toRole(role)].includes(action);
}

// Admin or tournament staff (the "organizers" in the documents)
export function isOrganizer(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'staff';
}
