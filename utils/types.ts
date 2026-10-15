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
  game: string;
  game_id: string | null;
  start_date: string;
  end_date: string;
  max_participants: number;
  registration_deadline: string;
  status: string;
  created_by: string;
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
  created_at: string;
  // Only present when selected with `games(...)`
  games?: Game;
  // Only present when selected with `team_members(count)`
  team_members?: { count: number }[];
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

// One row returned by the get_team_roster() database function
export interface RosterMember {
  user_id: string;
  full_name: string | null;
  email: string;
  role: 'captain' | 'player';
  joined_at: string;
}

export interface Registration {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id: string | null;
  // Older registrations only have a typed name and no team_id
  team_name: string | null;
  status: string;
  registered_at: string;
  // Only present when selected with `teams(...)`
  teams?: Team | null;
}
