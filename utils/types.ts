// Row types for the tables the pages read. Keep these in sync with the database schema.

export interface Profile {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  updated_at: string;
}

export interface Game {
  id: string;
  name: string;
  min_players: number;
  max_players: number;
}

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  game: string;
  game_id: string | null;
  start_date: string;
  end_date: string;
  max_participants: number;
  registration_deadline: string;
  // Only 'upcoming' or 'cancelled' is stored; use getTournamentStatus() for what to show
  status: 'upcoming' | 'cancelled';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Only present when selected with `tournament_registrations (count)`
  tournament_registrations?: { count: number }[];
}

export interface Team {
  id: string;
  name: string;
  game_id: string;
  captain_id: string;
  description: string | null;
  created_at: string;
  // Only present when selected with `games(...)`
  games?: Game;
  // Only present when selected with `team_members(count)`
  team_members?: { count: number }[];
  // Only present when selected with `captain:profiles(...)`; null for users who can't read profiles
  captain?: { full_name: string | null; email: string } | null;
}

export interface PlayerGameProfile {
  id: string;
  user_id: string;
  game_id: string;
  ign: string;
  in_game_role: string | null;
  rank: string | null;
  created_at: string;
}

// One row returned by the get_team_roster() database function.
// ign and in_game_role are empty if the member has no game profile for the team's game.
export interface RosterMember {
  user_id: string;
  full_name: string | null;
  ign: string | null;
  in_game_role: string | null;
  role: 'captain' | 'player';
  joined_at: string;
}

// One row returned by the search_players() database function
export interface PlayerSearchResult {
  user_id: string;
  full_name: string | null;
  ign: string;
  in_game_role: string | null;
  rank: string | null;
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Only these count towards a tournament's max_participants
export const ACTIVE_REGISTRATION_STATUSES: RegistrationStatus[] = ['pending', 'approved'];

export interface Registration {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id: string | null;
  // Older registrations only have a typed name and no team_id
  team_name: string | null;
  status: RegistrationStatus;
  registered_at: string;
  // Only present when selected with `teams(...)`
  teams?: Team | null;
}

export type MatchStatus = 'scheduled' | 'live' | 'completed';

export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  // null = not decided yet (TBD), or a bye in round 1
  team_a_id: string | null;
  team_b_id: string | null;
  scheduled_at: string | null;
  status: MatchStatus;
  score_a: number | null;
  score_b: number | null;
  winner_team_id: string | null;
  next_match_id: string | null;
  created_at: string;
  updated_at: string;
}
