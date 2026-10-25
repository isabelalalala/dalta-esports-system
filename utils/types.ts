// Row types for the tables the pages read. Keep these in sync with the database schema.

export interface Profile {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  updated_at: string;
  created_at: string;
  // When the user agreed to the Privacy Notice, and to which version (null = not yet)
  privacy_consent_at: string | null;
  privacy_consent_version: string | null;
  // Student verification (players). Only admin/staff change the status, through
  // review_student_verification(); is_verified is calculated from it.
  student_id: string | null;
  school: string | null;
  course_year: string | null;
  verification_status: VerificationStatus;
  is_verified: boolean;
  // Reason for a rejection or revoke, shown to the player
  verification_note: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export type VerificationStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';

export interface Game {
  id: string;
  name: string;
  min_players: number;
  max_players: number;
  // How many teams (players for solo games) a tournament may allow (202610251000)
  min_participants: number;
  max_participants: number;
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
  // Only teams whose members are all verified students can register
  requires_verification: boolean;
  // Check-in opens this many minutes before a match (0 = no check-in)
  checkin_window_minutes: number;
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
  // Only present when selected with `members:team_members(profiles(is_verified))`
  members?: { profiles: { is_verified: boolean } | null }[];
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
  is_verified: boolean;
}

// One row returned by the search_players() database function
export interface PlayerSearchResult {
  user_id: string;
  full_name: string | null;
  ign: string;
  in_game_role: string | null;
  rank: string | null;
  is_verified: boolean;
  // Already has an open invite from the captain's team
  invited: boolean;
}

// One row returned by get_my_team_invites(): an invite waiting for my answer
export interface MyTeamInvite {
  invite_id: string;
  team_id: string;
  team_name: string;
  game_name: string;
  captain_name: string | null;
  member_count: number;
  max_players: number;
  created_at: string;
}

// One row returned by get_team_invites(team): the captain's open invites
export interface PendingTeamInvite {
  invite_id: string;
  user_id: string;
  full_name: string | null;
  ign: string | null;
  created_at: string;
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
  // Won by forfeit (set only by declare_forfeit())
  is_forfeit: boolean;
  checkin_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

// A team as shown on the match page (name, and who can act for it)
export interface MatchTeam {
  id: string;
  name: string;
  captain_id: string;
}

export interface MatchCheckin {
  id: string;
  match_id: string;
  team_id: string;
  checked_in_by: string | null;
  checked_in_at: string;
}

export type ResultStatus = 'pending' | 'confirmed' | 'disputed' | 'approved' | 'overridden' | 'rejected';

// A captain's submitted score (see review_match_result() for what staff do with it)
export interface MatchResultSubmission {
  id: string;
  match_id: string;
  team_id: string;              // the submitting team
  submitted_by: string | null;
  score_a: number;
  score_b: number;
  proof_path: string;           // in the private "match-proofs" bucket
  status: ResultStatus;
  dispute_reason: string | null;
  responded_by: string | null;
  responded_at: string | null;
  review_note: string | null;
  final_score_a: number | null; // the score staff applied
  final_score_b: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// One row returned by get_needs_attention() (admin/staff)
export interface NeedsAttentionItem {
  kind: string;
  match_id: string;
  tournament_id: string;
  tournament_name: string;
  round: number;
  round_count: number;
  match_number: number;
  team_a: string | null;
  team_b: string | null;
  detail: string;
  since: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  // null = general announcement
  tournament_id: string | null;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Only present when selected with `tournaments(...)`
  tournaments?: { id: string; name: string } | null;
}

export type StreamStatus = 'scheduled' | 'live' | 'ended';

export interface Stream {
  id: string;
  tournament_id: string;
  // Optional: the one match this stream shows
  match_id: string | null;
  title: string;
  facebook_url: string;
  status: StreamStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Only present when selected with `tournaments(...)`
  tournaments?: { id: string; name: string; game: string } | null;
}

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Feedback {
  id: string;
  user_id: string | null;
  // null = general feedback
  tournament_id: string | null;
  // Set = feedback about one match (tournament_id is then that match's tournament)
  match_id: string | null;
  // The tournament or match was deleted (the feedback is kept for reports)
  target_removed: boolean;
  rating: number;
  comment: string;
  // Empty = "pending analysis" (classified when sent; admins retry the ones that failed)
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  topics: string[];
  classified_at: string | null;
  analysis_attempts: number;
  // Why the last classification try failed (Gemini down, limit reached, ...)
  analysis_error: string | null;
  analysis_attempted_at: string | null;
  created_at: string;
  // Only present when selected with `tournaments(...)`
  tournaments?: { id: string; name: string } | null;
  // Only present when selected with `matches(...)`
  matches?: { id: string; round: number; match_number: number } | null;
}
