// Row types for the tables the pages read. Keep these in sync with the database schema.

export interface Profile {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  updated_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  game: string;
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
  game: string;
  // Only present when selected with `team_members(count)`
  team_members?: { count: number }[];
}
