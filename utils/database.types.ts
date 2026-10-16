
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_reports": {
                  Row: {
                    "data": NonNullable<Json>,"filters": NonNullable<Json>,"generated_at": string,"generated_by": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data": NonNullable<Json>,"filters"?: NonNullable<Json>,"generated_at"?: string,"generated_by"?: string | null,"id"?: string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"filters"?: NonNullable<Json>,"generated_at"?: string,"generated_by"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_reports_generated_by_fkey"
      columns: ["generated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"pinned": boolean,"title": string,"tournament_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"pinned"?: boolean,"title": string,"tournament_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"pinned"?: boolean,"title"?: string,"tournament_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "created_at": string,"description": string,"display_order": number,"event_date": string | null,"id": string,"image_path": string | null,"is_published": boolean,"link": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"display_order"?: number,"event_date"?: string | null,"id"?: string,"image_path"?: string | null,"is_published"?: boolean,"link"?: string | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"display_order"?: number,"event_date"?: string | null,"id"?: string,"image_path"?: string | null,"is_published"?: boolean,"link"?: string | null,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"description": string,"display_order": number,"event_date": string | null,"id": string,"image_path": string | null,"is_published": boolean,"link": string | null,"title": string,"tournament_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"display_order"?: number,"event_date"?: string | null,"id"?: string,"image_path"?: string | null,"is_published"?: boolean,"link"?: string | null,"title": string,"tournament_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"display_order"?: number,"event_date"?: string | null,"id"?: string,"image_path"?: string | null,"is_published"?: boolean,"link"?: string | null,"title"?: string,"tournament_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "analysis_attempted_at": string | null,"analysis_attempts": number,"analysis_error": string | null,"classified_at": string | null,"comment": string,"created_at": string,"id": string,"match_id": string | null,"rating": number,"sentiment": string | null,"sentiment_score": number | null,"target_removed": boolean,"topics": (string)[],"tournament_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "analysis_attempted_at"?: string | null,"analysis_attempts"?: number,"analysis_error"?: string | null,"classified_at"?: string | null,"comment": string,"created_at"?: string,"id"?: string,"match_id"?: string | null,"rating": number,"sentiment"?: string | null,"sentiment_score"?: number | null,"target_removed"?: boolean,"topics"?: (string)[],"tournament_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "analysis_attempted_at"?: string | null,"analysis_attempts"?: number,"analysis_error"?: string | null,"classified_at"?: string | null,"comment"?: string,"created_at"?: string,"id"?: string,"match_id"?: string | null,"rating"?: number,"sentiment"?: string | null,"sentiment_score"?: number | null,"target_removed"?: boolean,"topics"?: (string)[],"tournament_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"game_divisions": {
                  Row: {
                    "description": string,"display_order": number,"game_id": string,"image_path": string | null,"is_published": boolean,"tagline": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"display_order"?: number,"game_id": string,"image_path"?: string | null,"is_published"?: boolean,"tagline"?: string
                  }
                  Update: {
                    "description"?: string,"display_order"?: number,"game_id"?: string,"image_path"?: string | null,"is_published"?: boolean,"tagline"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_divisions_game_id_fkey"
      columns: ["game_id"]
isOneToOne: true
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "id": string,"max_players": number,"min_players": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"max_players": number,"min_players": number,"name": string
                  }
                  Update: {
                    "id"?: string,"max_players"?: number,"min_players"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gemini_calls": {
                  Row: {
                    "called_at": string,"id": number,"items": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "called_at"?: string,"id"?: never,"items"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "called_at"?: string,"id"?: never,"items"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gemini_calls_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hero_images": {
                  Row: {
                    "caption": string,"created_at": string,"display_order": number,"id": string,"image_path": string,"is_published": boolean,"link": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string,"created_at"?: string,"display_order"?: number,"id"?: string,"image_path": string,"is_published"?: boolean,"link"?: string | null
                  }
                  Update: {
                    "caption"?: string,"created_at"?: string,"display_order"?: number,"id"?: string,"image_path"?: string,"is_published"?: boolean,"link"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"match_checkins": {
                  Row: {
                    "checked_in_at": string,"checked_in_by": string | null,"id": string,"match_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_in_at"?: string,"checked_in_by"?: string | null,"id"?: string,"match_id": string,"team_id": string
                  }
                  Update: {
                    "checked_in_at"?: string,"checked_in_by"?: string | null,"id"?: string,"match_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_checkins_checked_in_by_fkey"
      columns: ["checked_in_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_checkins_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_checkins_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"match_result_submissions": {
                  Row: {
                    "created_at": string,"dispute_reason": string | null,"final_score_a": number | null,"final_score_b": number | null,"id": string,"match_id": string,"proof_path": string,"responded_at": string | null,"responded_by": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"score_a": number,"score_b": number,"status": string,"submitted_by": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dispute_reason"?: string | null,"final_score_a"?: number | null,"final_score_b"?: number | null,"id"?: string,"match_id": string,"proof_path": string,"responded_at"?: string | null,"responded_by"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"score_a": number,"score_b": number,"status"?: string,"submitted_by"?: string | null,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"dispute_reason"?: string | null,"final_score_a"?: number | null,"final_score_b"?: number | null,"id"?: string,"match_id"?: string,"proof_path"?: string,"responded_at"?: string | null,"responded_by"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"score_a"?: number,"score_b"?: number,"status"?: string,"submitted_by"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_result_submissions_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_result_submissions_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_result_submissions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_result_submissions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_result_submissions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "checkin_notified_at": string | null,"created_at": string,"id": string,"is_forfeit": boolean,"match_number": number,"next_match_id": string | null,"round": number,"scheduled_at": string | null,"score_a": number | null,"score_b": number | null,"status": string,"team_a_id": string | null,"team_b_id": string | null,"tournament_id": string,"updated_at": string,"winner_team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_notified_at"?: string | null,"created_at"?: string,"id"?: string,"is_forfeit"?: boolean,"match_number": number,"next_match_id"?: string | null,"round": number,"scheduled_at"?: string | null,"score_a"?: number | null,"score_b"?: number | null,"status"?: string,"team_a_id"?: string | null,"team_b_id"?: string | null,"tournament_id": string,"updated_at"?: string,"winner_team_id"?: string | null
                  }
                  Update: {
                    "checkin_notified_at"?: string | null,"created_at"?: string,"id"?: string,"is_forfeit"?: boolean,"match_number"?: number,"next_match_id"?: string | null,"round"?: number,"scheduled_at"?: string | null,"score_a"?: number | null,"score_b"?: number | null,"status"?: string,"team_a_id"?: string | null,"team_b_id"?: string | null,"tournament_id"?: string,"updated_at"?: string,"winner_team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_next_match_id_fkey"
      columns: ["next_match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team_a_id_fkey"
      columns: ["team_a_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team_b_id_fkey"
      columns: ["team_b_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_winner_team_id_fkey"
      columns: ["winner_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"is_read": boolean,"link": string | null,"message": string,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_read"?: boolean,"link"?: string | null,"message"?: string,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_read"?: boolean,"link"?: string | null,"message"?: string,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"officers": {
                  Row: {
                    "category": string,"created_at": string,"display_order": number,"game_id": string | null,"id": string,"is_published": boolean,"name": string,"photo_path": string | null,"position": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"display_order"?: number,"game_id"?: string | null,"id"?: string,"is_published"?: boolean,"name": string,"photo_path"?: string | null,"position"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"display_order"?: number,"game_id"?: string | null,"id"?: string,"is_published"?: boolean,"name"?: string,"photo_path"?: string | null,"position"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "officers_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"official_team_players": {
                  Row: {
                    "display_order": number,"id": string,"ign": string,"is_captain": boolean,"name": string,"photo_path": string | null,"role": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_order"?: number,"id"?: string,"ign": string,"is_captain"?: boolean,"name"?: string,"photo_path"?: string | null,"role"?: string,"team_id": string
                  }
                  Update: {
                    "display_order"?: number,"id"?: string,"ign"?: string,"is_captain"?: boolean,"name"?: string,"photo_path"?: string | null,"role"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "official_team_players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "official_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"official_teams": {
                  Row: {
                    "created_at": string,"description": string,"display_order": number,"game_id": string,"id": string,"is_published": boolean,"name": string,"photo_path": string | null,"subname": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"display_order"?: number,"game_id": string,"id"?: string,"is_published"?: boolean,"name": string,"photo_path"?: string | null,"subname"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"display_order"?: number,"game_id"?: string,"id"?: string,"is_published"?: boolean,"name"?: string,"photo_path"?: string | null,"subname"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "official_teams_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"player_game_profiles": {
                  Row: {
                    "created_at": string,"game_id": string,"id": string,"ign": string,"in_game_role": string | null,"rank": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"game_id": string,"id"?: string,"ign": string,"in_game_role"?: string | null,"rank"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"id"?: string,"ign"?: string,"in_game_role"?: string | null,"rank"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_game_profiles_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_game_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"predictions": {
                  Row: {
                    "created_at": string,"id": string,"is_correct": boolean | null,"match_id": string,"predicted_winner_team_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_correct"?: boolean | null,"match_id": string,"predicted_winner_team_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_correct"?: boolean | null,"match_id"?: string,"predicted_winner_team_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "predictions_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "predictions_predicted_winner_team_id_fkey"
      columns: ["predicted_winner_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "predictions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "course_year": string | null,"created_at": string,"email": string,"full_name": string | null,"id": string,"is_verified": boolean | null,"privacy_consent_at": string | null,"privacy_consent_version": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"role": string,"school": string | null,"student_id": string | null,"submitted_at": string | null,"updated_at": string,"verification_note": string | null,"verification_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_year"?: string | null,"created_at"?: string,"email": string,"full_name"?: string | null,"id": string,"is_verified"?: never,"privacy_consent_at"?: string | null,"privacy_consent_version"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"role"?: string,"school"?: string | null,"student_id"?: string | null,"submitted_at"?: string | null,"updated_at"?: string,"verification_note"?: string | null,"verification_status"?: string
                  }
                  Update: {
                    "course_year"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"is_verified"?: never,"privacy_consent_at"?: string | null,"privacy_consent_version"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"role"?: string,"school"?: string | null,"student_id"?: string | null,"submitted_at"?: string | null,"updated_at"?: string,"verification_note"?: string | null,"verification_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"site_content": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value"?: string
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_content_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stream_presence": {
                  Row: {
                    "last_seen": string,"stream_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_seen"?: string,"stream_id": string,"user_id": string
                  }
                  Update: {
                    "last_seen"?: string,"stream_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stream_presence_stream_id_fkey"
      columns: ["stream_id"]
isOneToOne: false
      referencedRelation: "streams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stream_presence_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stream_views": {
                  Row: {
                    "created_at": string,"id": string,"stream_id": string,"user_id": string,"viewed_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"stream_id": string,"user_id": string,"viewed_on"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"stream_id"?: string,"user_id"?: string,"viewed_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stream_views_stream_id_fkey"
      columns: ["stream_id"]
isOneToOne: false
      referencedRelation: "streams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stream_views_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"streams": {
                  Row: {
                    "created_at": string,"created_by": string | null,"facebook_url": string,"id": string,"match_id": string | null,"status": string,"title": string,"tournament_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"facebook_url": string,"id"?: string,"match_id"?: string | null,"status"?: string,"title": string,"tournament_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"facebook_url"?: string,"id"?: string,"match_id"?: string | null,"status"?: string,"title"?: string,"tournament_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "streams_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "streams_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "streams_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"team_invites": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string | null,"invited_user_id": string,"responded_at": string | null,"status": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"invited_user_id": string,"responded_at"?: string | null,"status"?: string,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"invited_user_id"?: string,"responded_at"?: string | null,"status"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_invited_user_id_fkey"
      columns: ["invited_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "id": string,"joined_at": string,"role": string,"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"joined_at"?: string,"role"?: string,"team_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"joined_at"?: string,"role"?: string,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "captain_id": string,"created_at": string,"description": string | null,"game_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "captain_id": string,"created_at"?: string,"description"?: string | null,"game_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "captain_id"?: string,"created_at"?: string,"description"?: string | null,"game_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_captain_id_fkey"
      columns: ["captain_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_registrations": {
                  Row: {
                    "id": string,"registered_at": string,"status": string,"team_id": string | null,"team_name": string | null,"tournament_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"registered_at"?: string,"status"?: string,"team_id"?: string | null,"team_name"?: string | null,"tournament_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"registered_at"?: string,"status"?: string,"team_id"?: string | null,"team_name"?: string | null,"tournament_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tournaments": {
                  Row: {
                    "checkin_window_minutes": number,"created_at": string,"created_by": string | null,"description": string | null,"end_date": string | null,"game": string | null,"game_id": string,"id": string,"max_participants": number | null,"name": string,"registration_deadline": string | null,"requires_verification": boolean,"rules": string | null,"start_date": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checkin_window_minutes"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"end_date"?: string | null,"game"?: string | null,"game_id": string,"id"?: string,"max_participants"?: number | null,"name": string,"registration_deadline"?: string | null,"requires_verification"?: boolean,"rules"?: string | null,"start_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "checkin_window_minutes"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"end_date"?: string | null,"game"?: string | null,"game_id"?: string,"id"?: string,"max_participants"?: number | null,"name"?: string,"registration_deadline"?: string | null,"requires_verification"?: boolean,"rules"?: string | null,"start_date"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournaments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournaments_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activity_log_actors":
{ Args: Record<PropertyKey, never>; Returns: {
              "actor_id": string,"actor_name": string
            }[]
                           },
"admin_delete_user":
{ Args: { "target": string }; Returns: undefined
                           },
"can_view_match_results":
{ Args: { "p_match_id": string }; Returns: boolean
                           },
"changed_columns":
{ Args: { "p_new": Json,"p_old": Json }; Returns: (string)[]
                           },
"check_in_match":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"checkin_window":
{ Args: { "p_match_id": string }; Returns: {
              "closes_at": string,"opens_at": string
            }[]
                           },
"claim_gemini_call":
{ Args: { "p_items"?: number,"p_key": string }; Returns: string
                           },
"cleanup_stream_presence":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"declare_forfeit":
{ Args: { "p_match_id": string,"p_winner_team_id": string }; Returns: undefined
                           },
"delete_own_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"feedback_server_key_ok":
{ Args: { "p_key": string }; Returns: boolean
                           },
"generate_bracket":
{ Args: { "p_tournament_id": string }; Returns: number
                           },
"get_live_viewer_counts":
{ Args: { "p_stream_ids": (string)[] }; Returns: {
              "stream_id": string,"viewers": number
            }[]
                           },
"get_my_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_my_team_invites":
{ Args: Record<PropertyKey, never>; Returns: {
              "captain_name": string,"created_at": string,"game_name": string,"invite_id": string,"max_players": number,"member_count": number,"team_id": string,"team_name": string
            }[]
                           },
"get_needs_attention":
{ Args: Record<PropertyKey, never>; Returns: {
              "detail": string,"kind": string,"match_id": string,"match_number": number,"round": number,"round_count": number,"since": string,"team_a": string,"team_b": string,"tournament_id": string,"tournament_name": string
            }[]
                           },
"get_prediction_leaderboard":
{ Args: { "p_tournament_id": string }; Returns: {
              "correct": number,"decided": number,"display_name": string,"is_me": boolean,"rank": number,"total": number
            }[]
                           },
"get_prediction_split":
{ Args: { "p_match_ids": (string)[] }; Returns: {
              "match_id": string,"picks": number,"team_id": string
            }[]
                           },
"get_public_calendar":
{ Args: { "p_match_id"?: string,"p_team_id"?: string,"p_tournament_id"?: string }; Returns: {
              "calendar_name": string,"game": string,"match_id": string,"match_number": number,"round": number,"round_count": number,"scheduled_at": string,"score_a": number,"score_b": number,"status": string,"team_a": string,"team_b": string,"tournament_id": string,"tournament_name": string,"updated_at": string
            }[]
                           },
"get_public_tournament":
{ Args: { "p_tournament_id": string }; Returns: Json
                           },
"get_team_invites":
{ Args: { "p_team_id": string }; Returns: {
              "created_at": string,"full_name": string,"ign": string,"invite_id": string,"user_id": string
            }[]
                           },
"get_team_roster":
{ Args: { "p_team_id": string }; Returns: {
              "full_name": string,"ign": string,"in_game_role": string,"is_verified": boolean,"joined_at": string,"role": string,"user_id": string
            }[]
                           },
"give_privacy_consent":
{ Args: { "p_version": string }; Returns: undefined
                           },
"is_match_captain":
{ Args: { "p_match_id": string }; Returns: boolean
                           },
"log_activity":
{ Args: { "p_action": string,"p_details"?: Json,"p_entity_id": string,"p_entity_type": string }; Returns: undefined
                           },
"log_export":
{ Args: { "p_details"?: Json,"p_type": string }; Returns: undefined
                           },
"log_name":
{ Args: { "p_user_id": string }; Returns: string
                           },
"mark_feedback_pending":
{ Args: { "p_feedback_ids": (string)[],"p_key": string,"p_reason": string }; Returns: undefined
                           },
"match_proof_folder_match":
{ Args: { "p_folder": string }; Returns: string
                           },
"match_result_label":
{ Args: { "p_match_id": string,"p_score_a": number,"p_score_b": number }; Returns: string
                           },
"notify_users":
{ Args: { "p_link": string,"p_message": string,"p_title": string,"p_type": string,"p_user_ids": (string)[] }; Returns: undefined
                           },
"purge_old_activity_logs":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_old_notifications":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"report_activity":
{ Args: { "p_from"?: string,"p_game_id"?: string,"p_to"?: string,"p_tournament_id"?: string }; Returns: Json
                           },
"report_engagement":
{ Args: { "p_from"?: string,"p_game_id"?: string,"p_to"?: string,"p_tournament_id"?: string }; Returns: Json
                           },
"report_sentiment":
{ Args: { "p_from"?: string,"p_game_id"?: string,"p_to"?: string,"p_tournament_id"?: string }; Returns: Json
                           },
"respond_to_match_result":
{ Args: { "p_confirm": boolean,"p_reason"?: string,"p_submission_id": string }; Returns: undefined
                           },
"respond_to_team_invite":
{ Args: { "p_accept": boolean,"p_invite_id": string }; Returns: undefined
                           },
"review_match_result":
{ Args: { "p_action": string,"p_note"?: string,"p_score_a"?: number,"p_score_b"?: number,"p_submission_id": string }; Returns: undefined
                           },
"review_student_verification":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_user_id": string }; Returns: undefined
                           },
"save_feedback_sentiment":
{ Args: { "p_feedback_id": string,"p_key": string,"p_score": number,"p_sentiment": string,"p_topics": (string)[] }; Returns: boolean
                           },
"search_players":
{ Args: { "p_game_id": string,"p_search": string }; Returns: {
              "full_name": string,"ign": string,"in_game_role": string,"invited": boolean,"is_verified": boolean,"rank": string,"user_id": string
            }[]
                           },
"send_checkin_open_notifications":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"staff_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"submit_match_result":
{ Args: { "p_match_id": string,"p_proof_path": string,"p_score_a": number,"p_score_b": number }; Returns: string
                           },
"team_member_ids":
{ Args: { "p_team_ids": (string)[] }; Returns: (string)[]
                           },
"transfer_team_captaincy":
{ Args: { "p_new_captain": string,"p_team_id": string }; Returns: undefined
                           },
"unverified_team_members":
{ Args: { "p_team_id": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
