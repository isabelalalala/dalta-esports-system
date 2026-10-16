// Activity log (see migration 202610171100_activity_log): row type, action groups for the
// filter, and the readable sentence for each entry.
import { roundLabel } from '@/utils/tournaments';

// details holds the names as they were when it happened. Which keys are present depends on the action.
export interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: {
    actor_name?: string;
    tournament_name?: string;
    export_format?: string;
    filter?: string | null;
    tournament_id?: string | null;
    game?: string;
    team_name?: string;
    old_status?: string | null;
    fields?: string[] | null;
    user_name?: string;
    old_role?: string;
    new_role?: string;
    role?: string;
    self?: boolean;
    note?: string | null;
    title?: string;
    status?: string;
    round?: number;
    round_count?: number;
    match_number?: number;
    team_a?: string | null;
    team_b?: string | null;
    score_a?: number | null;
    score_b?: number | null;
    winner?: string | null;
    forfeit?: boolean;
    rounds?: number;
    teams?: number;
    // Exports: how many rows the file had
    rows?: number;
  };
  created_at: string;
}

// Filter options: a group shows all of its actions
export const ACTION_GROUPS: { label: string; actions: { value: string; label: string }[] }[] = [
  {
    label: 'Tournaments',
    actions: [
      { value: 'tournament.created', label: 'Tournament created' },
      { value: 'tournament.edited', label: 'Tournament edited' },
      { value: 'tournament.cancelled', label: 'Tournament cancelled' },
      { value: 'tournament.deleted', label: 'Tournament deleted' },
    ],
  },
  {
    label: 'Registrations',
    actions: [
      { value: 'registration.approved', label: 'Registration approved' },
      { value: 'registration.rejected', label: 'Registration rejected' },
      { value: 'registration.cancelled', label: 'Registration cancelled' },
      { value: 'registration.pending', label: 'Registration back to pending' },
      { value: 'registration.removed', label: 'Registration removed' },
    ],
  },
  {
    label: 'Matches',
    actions: [
      { value: 'bracket.generated', label: 'Bracket generated' },
      { value: 'match.edited', label: 'Match edited' },
      { value: 'match.result', label: 'Match result' },
      { value: 'result.submitted', label: 'Result submitted' },
      { value: 'result.confirmed', label: 'Result confirmed' },
      { value: 'result.disputed', label: 'Result disputed' },
      { value: 'result.approved', label: 'Result approved' },
      { value: 'result.overridden', label: 'Result overridden' },
      { value: 'result.rejected', label: 'Result rejected' },
    ],
  },
  {
    label: 'Users',
    actions: [
      { value: 'user.role_changed', label: 'Role changed' },
      { value: 'user.deleted', label: 'Account deleted' },
    ],
  },
  {
    label: 'Students',
    actions: [
      { value: 'student.verified', label: 'Student verified' },
      { value: 'student.rejected', label: 'Student rejected' },
      { value: 'student.revoked', label: 'Verification revoked' },
    ],
  },
  {
    label: 'Announcements',
    actions: [
      { value: 'announcement.posted', label: 'Announcement posted' },
      { value: 'announcement.edited', label: 'Announcement edited' },
      { value: 'announcement.deleted', label: 'Announcement deleted' },
    ],
  },
  {
    label: 'Exports',
    actions: [
      { value: 'export.registrations', label: 'Registrations exported' },
      { value: 'export.rosters', label: 'Rosters exported' },
      { value: 'export.matches', label: 'Schedule & results exported' },
      { value: 'export.feedback', label: 'Feedback exported' },
      { value: 'export.users', label: 'User list exported' },
    ],
  },
  {
    label: 'Streams',
    actions: [
      { value: 'stream.added', label: 'Stream added' },
      { value: 'stream.edited', label: 'Stream edited' },
      { value: 'stream.removed', label: 'Stream removed' },
    ],
  },
];

// Readable names for the tournament fields listed in "edited" entries
const fieldLabels: Record<string, string> = {
  name: 'name',
  description: 'description',
  rules: 'rules',
  game_id: 'game',
  start_date: 'start date',
  end_date: 'end date',
  registration_deadline: 'registration deadline',
  max_participants: 'max teams',
  status: 'status',
  requires_verification: 'verification requirement',
  title: 'title',
  facebook_url: 'Facebook link',
  match_id: 'match',
  scheduled_at: 'time',
  tournament_id: 'tournament',
  round: 'round',
  match_number: 'match number',
};

const exportLabels: Record<string, string> = {
  registrations: 'registrations',
  rosters: 'team rosters',
  matches: 'the schedule and results',
  feedback: 'feedback',
  users: 'the user list',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  staff: 'Staff',
  player: 'Player',
  spectator: 'Spectator',
};

function listFields(fields: string[] | null | undefined) {
  const names = (fields ?? []).map((f) => fieldLabels[f] ?? f.replace(/_/g, ' '));
  return names.length ? ` (${names.join(', ')})` : '';
}

// The sentence shown for one entry, e.g. "Isabella approved Team Kellog for MLBB Championship"
export function describeActivity(log: ActivityLog): string {
  const d = log.details;
  const actor = d.actor_name || 'Someone';
  const tournament = d.tournament_name || 'a deleted tournament';
  const forTournament = d.tournament_name ? ` for ${d.tournament_name}` : '';

  switch (log.action) {
    case 'tournament.created':
      return `${actor} created ${tournament}${d.game ? ` (${d.game})` : ''}`;
    case 'tournament.edited':
      return `${actor} edited ${tournament}${listFields(d.fields)}`;
    case 'tournament.cancelled':
      return `${actor} cancelled ${tournament}`;
    case 'tournament.deleted':
      return `${actor} deleted ${tournament}`;

    case 'registration.approved':
      return `${actor} approved ${d.team_name} for ${tournament}`;
    case 'registration.rejected':
      return `${actor} rejected ${d.team_name} for ${tournament}`;
    case 'registration.cancelled':
      return `${actor} cancelled ${d.team_name}'s registration for ${tournament}`;
    case 'registration.pending':
      return `${actor} moved ${d.team_name}'s registration for ${tournament} back to pending`;
    case 'registration.removed':
      return `${actor} removed ${d.team_name}'s registration for ${tournament}`;

    case 'bracket.generated':
      return `${actor} generated the bracket for ${tournament} (${d.teams} teams, ${d.rounds} rounds)`;
    case 'match.result': {
      const match = d.round
        ? `${roundLabel(d.round, d.round_count ?? d.round)} match ${d.match_number}`
        : 'a match';
      if (d.forfeit && d.winner) {
        return `${actor} gave ${d.winner} a forfeit win in ${match} of ${tournament} (${d.team_a} vs ${d.team_b})`;
      }
      if (!d.winner && d.score_a == null && d.score_b == null) {
        return `${actor} cleared the result of ${match} in ${tournament}`;
      }
      const score = d.score_a != null && d.score_b != null ? ` ${d.score_a}–${d.score_b}` : '';
      const winner = d.winner ? `, ${d.winner} won` : '';
      return `${actor} entered the result of ${match} in ${tournament}: ${d.team_a ?? 'TBD'} vs ${d.team_b ?? 'TBD'}${score}${winner}`;
    }
    case 'match.edited': {
      const match = d.round
        ? `${roundLabel(d.round, d.round_count ?? d.round)} match ${d.match_number}`
        : 'a match';
      return `${actor} edited ${match} in ${tournament}${listFields(d.fields)}`;
    }
    case 'result.submitted': {
      const match = d.round
        ? `${roundLabel(d.round, d.round_count ?? d.round)} match ${d.match_number}`
        : 'a match';
      const score = d.score_a != null && d.score_b != null ? ` ${d.score_a}–${d.score_b}` : '';
      return `${actor} submitted a result for ${match} in ${tournament} (${d.team_a ?? 'TBD'} vs ${d.team_b ?? 'TBD'}${score})`;
    }
    case 'result.confirmed':
    case 'result.disputed':
    case 'result.approved':
    case 'result.overridden':
    case 'result.rejected': {
      const match = d.round
        ? `${roundLabel(d.round, d.round_count ?? d.round)} match ${d.match_number}`
        : 'a match';
      const verbs: Record<string, string> = {
        'result.confirmed': 'confirmed the submitted result of',
        'result.disputed': 'disputed the submitted result of',
        'result.approved': 'approved the result of',
        'result.overridden': 'overrode the result of',
        'result.rejected': 'rejected a result submission for',
      };
      const note = d.note ? `: "${d.note}"` : '';
      return `${actor} ${verbs[log.action]} ${match} in ${tournament}${note}`;
    }

    case 'user.role_changed':
      return `${actor} changed ${d.user_name}'s role from ${roleLabels[d.old_role ?? ''] ?? d.old_role} to ${roleLabels[d.new_role ?? ''] ?? d.new_role}`;
    case 'user.deleted':
      return d.self ? `${d.user_name} deleted their own account` : `${actor} deleted the account of ${d.user_name}`;

    case 'student.verified':
      return `${actor} verified ${d.user_name} as a student`;
    case 'student.rejected':
      return `${actor} rejected ${d.user_name}'s student details${d.note ? `: "${d.note}"` : ''}`;
    case 'student.revoked':
      return `${actor} revoked ${d.user_name}'s student verification${d.note ? `: "${d.note}"` : ''}`;

    case 'announcement.posted':
      return `${actor} posted the announcement "${d.title}"${forTournament}`;
    case 'announcement.edited':
      return `${actor} edited the announcement "${d.title}"${forTournament}`;
    case 'announcement.deleted':
      return `${actor} deleted the announcement "${d.title}"${forTournament}`;

    case 'stream.added':
      return `${actor} added the stream "${d.title}"${forTournament}`;
    case 'stream.edited':
      // A status change alone reads better as "set ... live" / "ended"
      if (d.fields?.length === 1 && d.fields[0] === 'status') {
        return d.status === 'live'
          ? `${actor} set the stream "${d.title}" live${forTournament}`
          : `${actor} set the stream "${d.title}" to ${d.status}${forTournament}`;
      }
      return `${actor} edited the stream "${d.title}"${forTournament}${listFields(d.fields)}`;
    case 'stream.removed':
      return `${actor} removed the stream "${d.title}"${forTournament}`;

    default:
      if (log.action.startsWith('export.')) {
        const what = exportLabels[log.action.slice('export.'.length)] ?? 'data';
        const scope = d.tournament_name ? ` of ${d.tournament_name}` : d.filter ? ` (${d.filter})` : '';
        const format = d.export_format === 'csv' ? 'CSV' : 'Excel';
        return `${actor} exported ${what}${scope} (${format}, ${d.rows ?? 0} rows)`;
      }
      return `${actor}: ${log.action}`;
  }
}
