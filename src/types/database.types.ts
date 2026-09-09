export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          name: string
          slug: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          color?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          department: string
          enrollment_no: string | null
          team_id: string
          sprint_track: 'code' | 'open_source' | 'build' | 'pitch' | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          department: string
          enrollment_no?: string | null
          team_id: string
          sprint_track?: 'code' | 'open_source' | 'build' | 'pitch' | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          department?: string
          enrollment_no?: string | null
          team_id?: string
          sprint_track?: 'code' | 'open_source' | 'build' | 'pitch' | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          user_id: string
          role: 'member' | 'core' | 'lead'
          granted_by: string | null
          granted_at: string
        }
        Insert: {
          user_id: string
          role: 'member' | 'core' | 'lead'
          granted_by?: string | null
          granted_at?: string
        }
        Update: {
          user_id?: string
          role?: 'member' | 'core' | 'lead'
          granted_by?: string | null
          granted_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: number
          role: 'member' | 'core' | 'lead'
          permission: 'submissions.verify' | 'submissions.revoke' | 'submissions.override_points' | 'rules.edit' | 'roles.manage' | 'export.run' | 'members.manage' | 'meetups.manage'
        }
        Insert: {
          id?: number
          role: 'member' | 'core' | 'lead'
          permission: 'submissions.verify' | 'submissions.revoke' | 'submissions.override_points' | 'rules.edit' | 'roles.manage' | 'export.run' | 'members.manage' | 'meetups.manage'
        }
        Update: {
          id?: number
          role?: 'member' | 'core' | 'lead'
          permission?: 'submissions.verify' | 'submissions.revoke' | 'submissions.override_points' | 'rules.edit' | 'roles.manage' | 'export.run' | 'members.manage' | 'meetups.manage'
        }
        Relationships: []
      }
      activity_catalog: {
        Row: {
          id: string
          code: string
          category: 'team_activity' | 'individual' | 'sprint_track' | 'bonus'
          scope: 'team' | 'individual'
          label: string
          level: string | null
          points: number | null
          is_variable: boolean
          requires_proof: boolean
          proof_hint: string | null
          is_active: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          code: string
          category: 'team_activity' | 'individual' | 'sprint_track' | 'bonus'
          scope: 'team' | 'individual'
          label: string
          level?: string | null
          points?: number | null
          is_variable: boolean
          requires_proof: boolean
          proof_hint?: string | null
          is_active: boolean
          sort_order: number
        }
        Update: {
          id?: string
          code?: string
          category?: 'team_activity' | 'individual' | 'sprint_track' | 'bonus'
          scope?: 'team' | 'individual'
          label?: string
          level?: string | null
          points?: number | null
          is_variable?: boolean
          requires_proof?: boolean
          proof_hint?: string | null
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      submissions: {
        Row: {
          id: string
          member_id: string
          team_id: string
          activity_id: string
          occurred_on: string
          title: string
          details: string | null
          external_url: string | null
          status: 'pending' | 'needs_info' | 'verified' | 'rejected' | 'revoked'
          submitted_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          awarded_points: number | null
          override_reason: string | null
          penalty_points: number
          net_points: number | null
          meetup_id: string | null
        }
        Insert: {
          id?: string
          member_id: string
          team_id: string
          activity_id: string
          occurred_on: string
          title: string
          details?: string | null
          external_url?: string | null
          status?: 'pending' | 'needs_info' | 'verified' | 'rejected' | 'revoked'
          submitted_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          awarded_points?: number | null
          override_reason?: string | null
          penalty_points?: number
          net_points?: number | null
          meetup_id?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          team_id?: string
          activity_id?: string
          occurred_on?: string
          title?: string
          details?: string | null
          external_url?: string | null
          status?: 'pending' | 'needs_info' | 'verified' | 'rejected' | 'revoked'
          submitted_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          awarded_points?: number | null
          override_reason?: string | null
          penalty_points?: number
          net_points?: number | null
          meetup_id?: string | null
        }
        Relationships: []
      }
      submission_proofs: {
        Row: {
          id: string
          submission_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          uploaded_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          uploaded_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          storage_path?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          uploaded_at?: string
        }
        Relationships: []
      }
      meetups: {
        Row: {
          id: string
          held_on: string
          title: string
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          held_on: string
          title: string
          recorded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          held_on?: string
          title?: string
          recorded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: number
          actor_id: string | null
          action: string
          entity: string
          entity_id: string | null
          before: Json | null
          after: Json | null
          at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          action: string
          entity: string
          entity_id?: string | null
          before?: Json | null
          after?: Json | null
          at?: string
        }
        Update: {
          id?: number
          actor_id?: string | null
          action?: string
          entity?: string
          entity_id?: string | null
          before?: Json | null
          after?: Json | null
          at?: string
        }
        Relationships: []
      }
      sprint_config: {
        Row: {
          id: boolean
          sprint_start: string
          total_days: number
        }
        Insert: {
          id?: boolean
          sprint_start: string
          total_days: number
        }
        Update: {
          id?: boolean
          sprint_start?: string
          total_days?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_board_feed: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          member_name: string
          activity_label: string
          activity_level: string | null
          occurred_on: string
          posted_at: string
        }[]
      }
      get_my_submissions: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          activity_label: string
          activity_level: string | null
          title: string
          occurred_on: string
          status: 'pending' | 'needs_info' | 'verified' | 'rejected' | 'revoked'
          submitted_at: string
          decided_at: string | null
          decision_note: string | null
        }[]
      }
      get_review_queue: {
        Args: Record<PropertyKey, never>
        Returns: Json[]
      }
      get_team_total: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_my_submission: {
        Args: { p_id: string }
        Returns: {
          id: string
          activity_id: string
          activity_label: string
          activity_level: string | null
          title: string
          occurred_on: string
          details: string | null
          external_url: string | null
          status: 'pending' | 'needs_info' | 'verified' | 'rejected' | 'revoked'
          decision_note: string | null
        }[]
      }
      resubmit_submission: {
        Args: {
          p_id: string
          p_activity_id: string
          p_title: string
          p_occurred_on: string
          p_details?: string | null
          p_external_url?: string | null
          p_add_proofs?: Json
          p_remove_proof_ids?: string[]
        }
        Returns: undefined
      }
      get_submission_proofs: {
        Args: { p_submission_id: string }
        Returns: {
          id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
        }[]
      }
      submit_achievement: {
        Args: {
          p_id: string
          p_activity_id: string
          p_title: string
          p_occurred_on: string
          p_details?: string | null
          p_external_url?: string | null
          p_proofs?: Json
        }
        Returns: string
      }
      decide_submission: {
        Args: {
          p_submission_id: string
          p_decision: 'verified' | 'rejected' | 'needs_info'
          p_note?: string | null
          p_override_points?: number | null
          p_override_reason?: string | null
        }
        Returns: undefined
      }
      revoke_submission: {
        Args: { p_submission_id: string; p_reason: string }
        Returns: undefined
      }
      get_members_with_roles: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          full_name: string
          department: string
          enrollment_no: string | null
          sprint_track: string | null
          is_active: boolean
          role: 'member' | 'core' | 'lead'
          posted_count: number
          posted_points: number
        }[]
      }
      get_audit_log: {
        Args: { p_limit?: number }
        Returns: {
          id: number
          actor_name: string | null
          action: string
          entity: string
          at: string
        }[]
      }
      set_user_role: {
        Args: { p_user_id: string; p_role: 'member' | 'core' | 'lead' }
        Returns: undefined
      }
      set_member_active: {
        Args: { p_member_id: string; p_is_active: boolean }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          p_full_name: string
          p_department: string
          p_enrollment_no?: string | null
          p_sprint_track?: 'code' | 'open_source' | 'build' | 'pitch' | null
        }
        Returns: {
          id: string
          full_name: string
          department: string
          enrollment_no: string | null
          team_id: string
          sprint_track: 'code' | 'open_source' | 'build' | 'pitch' | null
          is_active: boolean
          created_at: string
        }
      }
      set_sprint_config: {
        Args: { p_sprint_start: string; p_total_days: number }
        Returns: undefined
      }
      get_meetup_roster: {
        Args: { p_meetup_id?: string | null }
        Returns: {
          id: string
          full_name: string
          department: string
          present: boolean
        }[]
      }
      get_meetups: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          held_on: string
          title: string
          present_count: number
          points_posted: number
        }[]
      }
      get_posted_submissions: {
        Args: { p_limit?: number }
        Returns: Json[]
      }
      record_meetup_attendance: {
        Args: { p_meetup_id: string; p_member_ids: string[] }
        Returns: number
      }
    }
    Enums: {
      app_role: 'member' | 'core' | 'lead'
      submission_status: 'pending' | 'needs_info' | 'verified' | 'rejected' | 'revoked'
      activity_category: 'team_activity' | 'individual' | 'sprint_track' | 'bonus'
      activity_scope: 'team' | 'individual'
      sprint_track: 'code' | 'open_source' | 'build' | 'pitch'
      app_permission: 'submissions.verify' | 'submissions.revoke' | 'submissions.override_points' | 'rules.edit' | 'roles.manage' | 'export.run' | 'members.manage' | 'meetups.manage'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
