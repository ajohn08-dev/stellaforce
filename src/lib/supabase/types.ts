export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_profile_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          application_id: string | null
          candidate_id: string | null
          client_id: string | null
          created_at: string
          dispatched_at: string | null
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id: string
          idempotency_key: string | null
          job_id: string | null
          payload: Json
          reverses_event_id: string | null
          severity: Database["public"]["Enums"]["event_severity"]
          sub_stage_id: string | null
          system_source: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          application_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          payload?: Json
          reverses_event_id?: string | null
          severity?: Database["public"]["Enums"]["event_severity"]
          sub_stage_id?: string | null
          system_source?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          application_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          event_type?: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          payload?: Json
          reverses_event_id?: string | null
          severity?: Database["public"]["Enums"]["event_severity"]
          sub_stage_id?: string | null
          system_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "activity_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "activity_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "activity_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "activity_events_reverses_event_id_fkey"
            columns: ["reverses_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avg_handle_time_minutes: number | null
          created_at: string
          description: string | null
          external_agent_id: string | null
          id: string
          name: string
          provider: string
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          avg_handle_time_minutes?: number | null
          created_at?: string
          description?: string | null
          external_agent_id?: string | null
          id?: string
          name: string
          provider: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          avg_handle_time_minutes?: number | null
          created_at?: string
          description?: string | null
          external_agent_id?: string | null
          id?: string
          name?: string
          provider?: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ai_interactions: {
        Row: {
          application_id: string | null
          candidate_id: string | null
          capability: string
          client_id: string | null
          confidence: number | null
          created_at: string
          id: string
          input_ref: Json
          latency_ms: number | null
          model: string | null
          output_ref: Json
          prompt_version: string | null
          sub_stage_id: string | null
          tokens: number | null
        }
        Insert: {
          application_id?: string | null
          candidate_id?: string | null
          capability: string
          client_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_ref?: Json
          latency_ms?: number | null
          model?: string | null
          output_ref?: Json
          prompt_version?: string | null
          sub_stage_id?: string | null
          tokens?: number | null
        }
        Update: {
          application_id?: string | null
          candidate_id?: string | null
          capability?: string
          client_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          input_ref?: Json
          latency_ms?: number | null
          model?: string | null
          output_ref?: Json
          prompt_version?: string | null
          sub_stage_id?: string | null
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "ai_interactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "ai_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ai_interactions_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      application_scorecard_categories: {
        Row: {
          application_id: string
          category_id: string
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          current_score: number | null
          id: string
          target_score: number | null
        }
        Insert: {
          application_id: string
          category_id: string
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          current_score?: number | null
          id?: string
          target_score?: number | null
        }
        Update: {
          application_id?: string
          category_id?: string
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          current_score?: number | null
          id?: string
          target_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "application_scorecard_categories_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_scorecard_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_scorecard_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      application_scorecard_competencies: {
        Row: {
          achieved_proficiency: Database["public"]["Enums"]["fit_proficiency_level"]
          competency_id: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          data_provenance: Database["public"]["Enums"]["data_provenance"]
          id: string
          scorecard_category_id: string
          summary: string | null
        }
        Insert: {
          achieved_proficiency: Database["public"]["Enums"]["fit_proficiency_level"]
          competency_id: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          data_provenance?: Database["public"]["Enums"]["data_provenance"]
          id?: string
          scorecard_category_id: string
          summary?: string | null
        }
        Update: {
          achieved_proficiency?: Database["public"]["Enums"]["fit_proficiency_level"]
          competency_id?: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          data_provenance?: Database["public"]["Enums"]["data_provenance"]
          id?: string
          scorecard_category_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_scorecard_competencies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "job_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_scorecard_competencies_scorecard_category_id_fkey"
            columns: ["scorecard_category_id"]
            isOneToOne: false
            referencedRelation: "application_scorecard_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      application_scorecard_evidence: {
        Row: {
          evaluation_id: string
          id: string
          note: string
          scorecard_competency_id: string
        }
        Insert: {
          evaluation_id: string
          id?: string
          note: string
          scorecard_competency_id: string
        }
        Update: {
          evaluation_id?: string
          id?: string
          note?: string
          scorecard_competency_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_scorecard_evidence_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "application_stage_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_scorecard_evidence_scorecard_competency_id_fkey"
            columns: ["scorecard_competency_id"]
            isOneToOne: false
            referencedRelation: "application_scorecard_competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      application_stage_evaluation_notes: {
        Row: {
          display_order: number
          evaluation_id: string
          id: string
          note: string
        }
        Insert: {
          display_order?: number
          evaluation_id: string
          id?: string
          note: string
        }
        Update: {
          display_order?: number
          evaluation_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_stage_evaluation_notes_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "application_stage_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_stage_evaluation_questions: {
        Row: {
          answer: string | null
          competency_id: string | null
          created_at: string
          display_order: number
          evaluation_id: string
          id: string
          question: string
        }
        Insert: {
          answer?: string | null
          competency_id?: string | null
          created_at?: string
          display_order?: number
          evaluation_id: string
          id?: string
          question: string
        }
        Update: {
          answer?: string | null
          competency_id?: string | null
          created_at?: string
          display_order?: number
          evaluation_id?: string
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_stage_evaluation_questions_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "job_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_evaluation_questions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "application_stage_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_stage_evaluations: {
        Row: {
          application_id: string
          created_at: string
          id: string
          interview_date: string | null
          interviewer_id: string | null
          mode: Database["public"]["Enums"]["stage_format"] | null
          rubric_score: number | null
          status: Database["public"]["Enums"]["eval_status"]
          sub_stage_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          interview_date?: string | null
          interviewer_id?: string | null
          mode?: Database["public"]["Enums"]["stage_format"] | null
          rubric_score?: number | null
          status?: Database["public"]["Enums"]["eval_status"]
          sub_stage_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          interview_date?: string | null
          interviewer_id?: string | null
          mode?: Database["public"]["Enums"]["stage_format"] | null
          rubric_score?: number | null
          status?: Database["public"]["Enums"]["eval_status"]
          sub_stage_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_stage_evaluations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_stage_evaluations_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "job_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_evaluations_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      application_stage_history: {
        Row: {
          application_id: string
          created_at: string
          decided_by: string | null
          entered_at: string
          exited_at: string | null
          id: string
          outcome: string | null
          sla_breached: boolean
          sub_stage_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          decided_by?: string | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          outcome?: string | null
          sla_breached?: boolean
          sub_stage_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          decided_by?: string | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          outcome?: string | null
          sla_breached?: boolean
          sub_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_stage_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_stage_history_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_history_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_id: string
          candidate_id: string
          client_id: string
          created_at: string
          current_stage_id: string | null
          date_applied: string
          date_updated: string
          human_review_flag: boolean
          job_fit_score: number | null
          job_id: string
          owner_profile_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string
          candidate_id: string
          client_id: string
          created_at?: string
          current_stage_id?: string | null
          date_applied?: string
          date_updated?: string
          human_review_flag?: boolean
          job_fit_score?: number | null
          job_id: string
          owner_profile_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          candidate_id?: string
          client_id?: string
          created_at?: string
          current_stage_id?: string | null
          date_applied?: string
          date_updated?: string
          human_review_flag?: boolean
          job_fit_score?: number | null
          job_id?: string
          owner_profile_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "applications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "applications_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "applications_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          client_id: string | null
          created_at: string
          diff: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          client_id?: string | null
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          client_id?: string | null
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          client_id: string | null
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id: string | null
          trigger_event_type: Database["public"]["Enums"]["activity_event_type"]
          updated_at: string
        }
        Insert: {
          actions?: Json
          client_id?: string | null
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          trigger_event_type: Database["public"]["Enums"]["activity_event_type"]
          updated_at?: string
        }
        Update: {
          actions?: Json
          client_id?: string | null
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          scope?: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          trigger_event_type?: Database["public"]["Enums"]["activity_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          agent_id: string | null
          application_id: string | null
          audio_status: string
          call_status: string | null
          call_successful: string | null
          campaign_id: string | null
          candidate_id: string | null
          client_id: string | null
          created_at: string
          duration_seconds: number | null
          elevenlabs_conversation_id: string | null
          evaluation_id: string | null
          file_size: number | null
          filename: string | null
          id: string
          interviewer_type: Database["public"]["Enums"]["interviewer_type"]
          is_test: boolean
          job_id: string | null
          mime_type: string | null
          raw_elevenlabs_payload: Json | null
          started_at: string | null
          storage_path: string | null
          sub_stage_id: string | null
          summary: string | null
          termination_reason: string | null
          title: string | null
          to_number: string | null
          transcript: Json | null
          transcript_status: string
          transcript_text: string | null
          updated_at: string
          video_duration_seconds: number | null
          video_file_size: number | null
          video_filename: string | null
          video_mime_type: string | null
          video_status: string | null
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          agent_id?: string | null
          application_id?: string | null
          audio_status?: string
          call_status?: string | null
          call_successful?: string | null
          campaign_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          evaluation_id?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          interviewer_type: Database["public"]["Enums"]["interviewer_type"]
          is_test?: boolean
          job_id?: string | null
          mime_type?: string | null
          raw_elevenlabs_payload?: Json | null
          started_at?: string | null
          storage_path?: string | null
          sub_stage_id?: string | null
          summary?: string | null
          termination_reason?: string | null
          title?: string | null
          to_number?: string | null
          transcript?: Json | null
          transcript_status?: string
          transcript_text?: string | null
          updated_at?: string
          video_duration_seconds?: number | null
          video_file_size?: number | null
          video_filename?: string | null
          video_mime_type?: string | null
          video_status?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          agent_id?: string | null
          application_id?: string | null
          audio_status?: string
          call_status?: string | null
          call_successful?: string | null
          campaign_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          evaluation_id?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          interviewer_type?: Database["public"]["Enums"]["interviewer_type"]
          is_test?: boolean
          job_id?: string | null
          mime_type?: string | null
          raw_elevenlabs_payload?: Json | null
          started_at?: string | null
          storage_path?: string | null
          sub_stage_id?: string | null
          summary?: string | null
          termination_reason?: string | null
          title?: string | null
          to_number?: string | null
          transcript?: Json | null
          transcript_status?: string
          transcript_text?: string | null
          updated_at?: string
          video_duration_seconds?: number | null
          video_file_size?: number | null
          video_filename?: string | null
          video_mime_type?: string | null
          video_status?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "call_recordings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "call_recordings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "call_recordings_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "application_stage_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "call_recordings_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_certifications: {
        Row: {
          candidate_id: string
          created_at: string
          credential_id: string | null
          credential_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string | null
          name: string
          source_resume_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          name: string
          source_resume_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          name?: string
          source_resume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_certifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_certifications_source_resume_id_fkey"
            columns: ["source_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_client_fit: {
        Row: {
          candidate_id: string
          client_id: string
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          created_at: string
          data_provenance: Database["public"]["Enums"]["data_provenance"]
          fit_score: number | null
          id: string
          last_evaluated_at: string | null
          rationale: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          client_id: string
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          data_provenance?: Database["public"]["Enums"]["data_provenance"]
          fit_score?: number | null
          id?: string
          last_evaluated_at?: string | null
          rationale?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          client_id?: string
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          data_provenance?: Database["public"]["Enums"]["data_provenance"]
          fit_score?: number | null
          id?: string
          last_evaluated_at?: string | null
          rationale?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_client_fit_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_client_fit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      candidate_client_fit_evidence: {
        Row: {
          fit_id: string
          id: string
          scorecard_competency_id: string
          weight: number | null
        }
        Insert: {
          fit_id: string
          id?: string
          scorecard_competency_id: string
          weight?: number | null
        }
        Update: {
          fit_id?: string
          id?: string
          scorecard_competency_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_client_fit_evidence_fit_id_fkey"
            columns: ["fit_id"]
            isOneToOne: false
            referencedRelation: "candidate_client_fit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_client_fit_evidence_scorecard_competency_id_fkey"
            columns: ["scorecard_competency_id"]
            isOneToOne: false
            referencedRelation: "application_scorecard_competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_education: {
        Row: {
          candidate_id: string
          created_at: string
          degree: string | null
          description: string | null
          end_date: string | null
          field_of_study: string | null
          gpa: number | null
          id: string
          institution_name: string
          is_current: boolean | null
          source_resume_id: string | null
          start_date: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          degree?: string | null
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          gpa?: number | null
          id?: string
          institution_name: string
          is_current?: boolean | null
          source_resume_id?: string | null
          start_date?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          degree?: string | null
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          gpa?: number | null
          id?: string
          institution_name?: string
          is_current?: boolean | null
          source_resume_id?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_education_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_education_source_resume_id_fkey"
            columns: ["source_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_links: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          label: string | null
          link_type: string | null
          url: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          label?: string | null
          link_type?: string | null
          url: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          label?: string | null
          link_type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_links_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
        ]
      }
      candidate_skills: {
        Row: {
          ai_literacy_signal: Json | null
          assessment_score: number | null
          candidate_id: string
          created_at: string
          id: string
          proficiency_level:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          scorecard: Json | null
          skill_id: string
          years_of_experience: number | null
        }
        Insert: {
          ai_literacy_signal?: Json | null
          assessment_score?: number | null
          candidate_id: string
          created_at?: string
          id?: string
          proficiency_level?:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          scorecard?: Json | null
          skill_id: string
          years_of_experience?: number | null
        }
        Update: {
          ai_literacy_signal?: Json | null
          assessment_score?: number | null
          candidate_id?: string
          created_at?: string
          id?: string
          proficiency_level?:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          scorecard?: Json | null
          skill_id?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_skills_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tools: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          proficiency_level:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          tool_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          proficiency_level?:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          tool_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          proficiency_level?:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tools_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_work_experiences: {
        Row: {
          candidate_id: string
          company_name: string
          created_at: string
          description: string | null
          display_order: number
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          end_date: string | null
          id: string
          is_current: boolean | null
          is_remote: boolean | null
          location: string | null
          source_resume_id: string | null
          start_date: string
          title: string
        }
        Insert: {
          candidate_id: string
          company_name: string
          created_at?: string
          description?: string | null
          display_order: number
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          is_remote?: boolean | null
          location?: string | null
          source_resume_id?: string | null
          start_date: string
          title: string
        }
        Update: {
          candidate_id?: string
          company_name?: string
          created_at?: string
          description?: string | null
          display_order?: number
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          is_remote?: boolean | null
          location?: string | null
          source_resume_id?: string | null
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_work_experiences_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "candidate_work_experiences_source_resume_id_fkey"
            columns: ["source_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          added_by: string | null
          avatar_url: string | null
          candidate_id: string
          candidate_tier: Database["public"]["Enums"]["candidate_tier"] | null
          created_at: string
          current_company: string | null
          current_title: string | null
          data_confidence_breakdown: Json | null
          data_confidence_score: number | null
          data_provenance: Database["public"]["Enums"]["data_provenance"]
          date_added: string
          email: string | null
          embedding_vector: string | null
          first_name: string
          freshness_score: number | null
          full_name: string | null
          github_url: string | null
          headline: string | null
          is_open_to_relocation: boolean | null
          is_open_to_remote: boolean | null
          languages: string[] | null
          last_name: string
          last_scored_at: string | null
          last_updated: string
          last_verified: string | null
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          location_raw: string | null
          location_state: string | null
          phone: string | null
          portfolio_url: string | null
          professional_summary: string | null
          resume_path: string | null
          source: string | null
          source_metadata: Json | null
          tier_rationale: string | null
          timezone: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          added_by?: string | null
          avatar_url?: string | null
          candidate_id?: string
          candidate_tier?: Database["public"]["Enums"]["candidate_tier"] | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          data_confidence_breakdown?: Json | null
          data_confidence_score?: number | null
          data_provenance?: Database["public"]["Enums"]["data_provenance"]
          date_added?: string
          email?: string | null
          embedding_vector?: string | null
          first_name: string
          freshness_score?: number | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          is_open_to_relocation?: boolean | null
          is_open_to_remote?: boolean | null
          languages?: string[] | null
          last_name: string
          last_scored_at?: string | null
          last_updated?: string
          last_verified?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          location_raw?: string | null
          location_state?: string | null
          phone?: string | null
          portfolio_url?: string | null
          professional_summary?: string | null
          resume_path?: string | null
          source?: string | null
          source_metadata?: Json | null
          tier_rationale?: string | null
          timezone?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          added_by?: string | null
          avatar_url?: string | null
          candidate_id?: string
          candidate_tier?: Database["public"]["Enums"]["candidate_tier"] | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          data_confidence_breakdown?: Json | null
          data_confidence_score?: number | null
          data_provenance?: Database["public"]["Enums"]["data_provenance"]
          date_added?: string
          email?: string | null
          embedding_vector?: string | null
          first_name?: string
          freshness_score?: number | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          is_open_to_relocation?: boolean | null
          is_open_to_remote?: boolean | null
          languages?: string[] | null
          last_name?: string
          last_scored_at?: string | null
          last_updated?: string
          last_verified?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          location_raw?: string | null
          location_state?: string | null
          phone?: string | null
          portfolio_url?: string | null
          professional_summary?: string | null
          resume_path?: string | null
          source?: string | null
          source_metadata?: Json | null
          tier_rationale?: string | null
          timezone?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          industry: string | null
          notes: string | null
          plan: Database["public"]["Enums"]["client_plan"]
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          client_id?: string
          client_name: string
          created_at?: string
          industry?: string | null
          notes?: string | null
          plan?: Database["public"]["Enums"]["client_plan"]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          industry?: string | null
          notes?: string | null
          plan?: Database["public"]["Enums"]["client_plan"]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      communication_templates: {
        Row: {
          body: string | null
          channel: string
          client_id: string | null
          created_at: string
          enabled: boolean
          id: string
          recipients: Json
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id: string | null
          subject: string | null
          trigger_event_type: Database["public"]["Enums"]["activity_event_type"]
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          recipients?: Json
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          subject?: string | null
          trigger_event_type: Database["public"]["Enums"]["activity_event_type"]
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          recipients?: Json
          scope?: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          subject?: string | null
          trigger_event_type?: Database["public"]["Enums"]["activity_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          connected_at: string
          created_at: string
          email: string
          google_account_email: string
          id: string
          profile_id: string | null
          refresh_token_encrypted: string
          revoked_at: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          connected_at?: string
          created_at?: string
          email: string
          google_account_email: string
          id?: string
          profile_id?: string | null
          refresh_token_encrypted: string
          revoked_at?: string | null
          scope: string
          updated_at?: string
        }
        Update: {
          connected_at?: string
          created_at?: string
          email?: string
          google_account_email?: string
          id?: string
          profile_id?: string | null
          refresh_token_encrypted?: string
          revoked_at?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          attempt_count: number
          candidate_id: string | null
          created_at: string
          error_message: string | null
          filename: string
          id: string
          needs_review_reasons: string[] | null
          raw_payload: Json
          resume_id: string | null
          stage: string | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string | null
          webhook_execution_mode: string | null
        }
        Insert: {
          attempt_count?: number
          candidate_id?: string | null
          created_at?: string
          error_message?: string | null
          filename: string
          id?: string
          needs_review_reasons?: string[] | null
          raw_payload: Json
          resume_id?: string | null
          stage?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id?: string | null
          webhook_execution_mode?: string | null
        }
        Update: {
          attempt_count?: number
          candidate_id?: string | null
          created_at?: string
          error_message?: string | null
          filename?: string
          id?: string
          needs_review_reasons?: string[] | null
          raw_payload?: Json
          resume_id?: string | null
          stage?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string | null
          webhook_execution_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "ingestion_jobs_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          body: string | null
          candidate_id: string
          communication_preferences: Json | null
          consent: boolean
          created_at: string
          interaction_at: string
          interaction_id: string
          nurture_status: Database["public"]["Enums"]["nurture_status"]
          relationship_strength: number | null
          type: Database["public"]["Enums"]["interaction_type"]
          updated_at: string
        }
        Insert: {
          body?: string | null
          candidate_id: string
          communication_preferences?: Json | null
          consent?: boolean
          created_at?: string
          interaction_at?: string
          interaction_id?: string
          nurture_status?: Database["public"]["Enums"]["nurture_status"]
          relationship_strength?: number | null
          type: Database["public"]["Enums"]["interaction_type"]
          updated_at?: string
        }
        Update: {
          body?: string | null
          candidate_id?: string
          communication_preferences?: Json | null
          consent?: boolean
          created_at?: string
          interaction_at?: string
          interaction_id?: string
          nurture_status?: Database["public"]["Enums"]["nurture_status"]
          relationship_strength?: number | null
          type?: Database["public"]["Enums"]["interaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
        ]
      }
      job_competencies: {
        Row: {
          created_at: string
          description: string
          id: string
          job_id: string
          recommended_level: Database["public"]["Enums"]["fit_proficiency_level"]
          skills: string[]
          tools: string[]
          type: Database["public"]["Enums"]["competency_type"]
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          job_id: string
          recommended_level: Database["public"]["Enums"]["fit_proficiency_level"]
          skills?: string[]
          tools?: string[]
          type: Database["public"]["Enums"]["competency_type"]
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          job_id?: string
          recommended_level?: Database["public"]["Enums"]["fit_proficiency_level"]
          skills?: string[]
          tools?: string[]
          type?: Database["public"]["Enums"]["competency_type"]
        }
        Relationships: [
          {
            foreignKeyName: "job_competencies_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_competency_level_descriptions: {
        Row: {
          competency_id: string
          description: string
          id: string
          level: Database["public"]["Enums"]["fit_proficiency_level"]
        }
        Insert: {
          competency_id: string
          description: string
          id?: string
          level: Database["public"]["Enums"]["fit_proficiency_level"]
        }
        Update: {
          competency_id?: string
          description?: string
          id?: string
          level?: Database["public"]["Enums"]["fit_proficiency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "job_competency_level_descriptions_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "job_competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          content: string | null
          created_at: string
          file_path: string | null
          id: string
          job_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          job_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_orders: {
        Row: {
          client_id: string
          company: string | null
          created_at: string
          description: string | null
          description_file_path: string | null
          education_required: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          experience_required: string | null
          industry: string | null
          job_function: string | null
          job_id: string
          location: string | null
          office_location: string | null
          requisition_file_path: string | null
          salary_currency: string | null
          salary_from: number | null
          salary_to: number | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          workflow_template_id: string | null
          workflow_template_version: number | null
          workplace_type: Database["public"]["Enums"]["workplace_type"] | null
        }
        Insert: {
          client_id: string
          company?: string | null
          created_at?: string
          description?: string | null
          description_file_path?: string | null
          education_required?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          experience_required?: string | null
          industry?: string | null
          job_function?: string | null
          job_id?: string
          location?: string | null
          office_location?: string | null
          requisition_file_path?: string | null
          salary_currency?: string | null
          salary_from?: number | null
          salary_to?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          workflow_template_id?: string | null
          workflow_template_version?: number | null
          workplace_type?: Database["public"]["Enums"]["workplace_type"] | null
        }
        Update: {
          client_id?: string
          company?: string | null
          created_at?: string
          description?: string | null
          description_file_path?: string | null
          education_required?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          experience_required?: string | null
          industry?: string | null
          job_function?: string | null
          job_id?: string
          location?: string | null
          office_location?: string | null
          requisition_file_path?: string | null
          salary_currency?: string | null
          salary_from?: number | null
          salary_to?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          workflow_template_id?: string | null
          workflow_template_version?: number | null
          workplace_type?: Database["public"]["Enums"]["workplace_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "job_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "job_orders_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_scorecard_categories: {
        Row: {
          id: string
          job_id: string
          name: string
          weight: number
        }
        Insert: {
          id?: string
          job_id: string
          name: string
          weight: number
        }
        Update: {
          id?: string
          job_id?: string
          name?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_scorecard_categories_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_scorecard_category_competencies: {
        Row: {
          category_id: string
          competency_id: string
        }
        Insert: {
          category_id: string
          competency_id: string
        }
        Update: {
          category_id?: string
          competency_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_scorecard_category_competencies_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_scorecard_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_scorecard_category_competencies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: true
            referencedRelation: "job_competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_target_companies: {
        Row: {
          created_at: string
          id: string
          job_id: string
          name: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          name: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_target_companies_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          job_id: string
          name: string
          profile_id: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          job_id: string
          name: string
          profile_id?: string | null
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          job_id?: string
          name?: string
          profile_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_team_members_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_workflow_sub_stage_competencies: {
        Row: {
          competency_id: string
          sub_stage_id: string
        }
        Insert: {
          competency_id: string
          sub_stage_id: string
        }
        Update: {
          competency_id?: string
          sub_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_workflow_sub_stage_competencies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "job_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_workflow_sub_stage_competencies_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      job_workflow_sub_stage_details: {
        Row: {
          content: string | null
          created_at: string
          detail_type: string
          display_order: number
          file_path: string | null
          id: string
          label: string | null
          metadata: Json
          sub_stage_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          detail_type: string
          display_order?: number
          file_path?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          sub_stage_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          detail_type?: string
          display_order?: number
          file_path?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          sub_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_workflow_sub_stage_details_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      job_workflow_sub_stage_reviewers: {
        Row: {
          member_id: string
          sub_stage_id: string
        }
        Insert: {
          member_id: string
          sub_stage_id: string
        }
        Update: {
          member_id?: string
          sub_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_workflow_sub_stage_reviewers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "job_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_workflow_sub_stage_reviewers_sub_stage_id_fkey"
            columns: ["sub_stage_id"]
            isOneToOne: false
            referencedRelation: "job_workflow_sub_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      job_workflow_sub_stages: {
        Row: {
          agent_id: string | null
          allowed_outcomes: string[]
          capture_feedback_form: boolean
          capture_transcript: boolean
          collaborator_role: string | null
          config: Json
          created_at: string
          decision_mode: Database["public"]["Enums"]["decision_mode"]
          decision_owner: string | null
          display_order: number
          duration_minutes: number | null
          entry_conditions: Database["public"]["Enums"]["stage_entry_condition"][]
          format: Database["public"]["Enums"]["stage_format"] | null
          hire_recommendation_enabled: boolean
          id: string
          interviewer_type: Database["public"]["Enums"]["interviewer_type"]
          job_id: string
          name: string
          needs_final_approval: boolean
          override_enabled: boolean
          override_roles: string | null
          owner_member_id: string | null
          owner_role: string | null
          pipeline_stage_id: string
          purpose: string | null
          question_source: Database["public"]["Enums"]["question_source"] | null
          questions: string | null
          rating_scale: Database["public"]["Enums"]["rating_scale"] | null
          required_questions: string | null
          visibility: Database["public"]["Enums"]["stage_visibility"]
        }
        Insert: {
          agent_id?: string | null
          allowed_outcomes?: string[]
          capture_feedback_form?: boolean
          capture_transcript?: boolean
          collaborator_role?: string | null
          config?: Json
          created_at?: string
          decision_mode?: Database["public"]["Enums"]["decision_mode"]
          decision_owner?: string | null
          display_order?: number
          duration_minutes?: number | null
          entry_conditions?: Database["public"]["Enums"]["stage_entry_condition"][]
          format?: Database["public"]["Enums"]["stage_format"] | null
          hire_recommendation_enabled?: boolean
          id?: string
          interviewer_type?: Database["public"]["Enums"]["interviewer_type"]
          job_id: string
          name: string
          needs_final_approval?: boolean
          override_enabled?: boolean
          override_roles?: string | null
          owner_member_id?: string | null
          owner_role?: string | null
          pipeline_stage_id: string
          purpose?: string | null
          question_source?:
            | Database["public"]["Enums"]["question_source"]
            | null
          questions?: string | null
          rating_scale?: Database["public"]["Enums"]["rating_scale"] | null
          required_questions?: string | null
          visibility?: Database["public"]["Enums"]["stage_visibility"]
        }
        Update: {
          agent_id?: string | null
          allowed_outcomes?: string[]
          capture_feedback_form?: boolean
          capture_transcript?: boolean
          collaborator_role?: string | null
          config?: Json
          created_at?: string
          decision_mode?: Database["public"]["Enums"]["decision_mode"]
          decision_owner?: string | null
          display_order?: number
          duration_minutes?: number | null
          entry_conditions?: Database["public"]["Enums"]["stage_entry_condition"][]
          format?: Database["public"]["Enums"]["stage_format"] | null
          hire_recommendation_enabled?: boolean
          id?: string
          interviewer_type?: Database["public"]["Enums"]["interviewer_type"]
          job_id?: string
          name?: string
          needs_final_approval?: boolean
          override_enabled?: boolean
          override_roles?: string | null
          owner_member_id?: string | null
          owner_role?: string | null
          pipeline_stage_id?: string
          purpose?: string | null
          question_source?:
            | Database["public"]["Enums"]["question_source"]
            | null
          questions?: string | null
          rating_scale?: Database["public"]["Enums"]["rating_scale"] | null
          required_questions?: string | null
          visibility?: Database["public"]["Enums"]["stage_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "job_workflow_sub_stages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_workflow_sub_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_workflow_sub_stages_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "job_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_workflow_sub_stages_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          key: Database["public"]["Enums"]["pipeline_stage"]
          name: string
          sla_target_days: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order: number
          id?: string
          key: Database["public"]["Enums"]["pipeline_stage"]
          name: string
          sla_target_days?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          key?: Database["public"]["Enums"]["pipeline_stage"]
          name?: string
          sla_target_days?: number | null
        }
        Relationships: []
      }
      placements: {
        Row: {
          candidate_id: string
          client_id: string
          created_at: string
          guarantee_period: string | null
          job_id: string
          placement_date: string | null
          placement_id: string
          role_placed: string | null
          salary: number | null
          status: Database["public"]["Enums"]["placement_status"]
          updated_at: string
        }
        Insert: {
          candidate_id: string
          client_id: string
          created_at?: string
          guarantee_period?: string | null
          job_id: string
          placement_date?: string | null
          placement_id?: string
          role_placed?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["placement_status"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          client_id?: string
          created_at?: string
          guarantee_period?: string | null
          job_id?: string
          placement_date?: string | null
          placement_id?: string
          role_placed?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["placement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["job_id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          client_role: Database["public"]["Enums"]["client_role"] | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          side: Database["public"]["Enums"]["profile_side"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_role?: Database["public"]["Enums"]["client_role"] | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"] | null
          side?: Database["public"]["Enums"]["profile_side"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_role?: Database["public"]["Enums"]["client_role"] | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          side?: Database["public"]["Enums"]["profile_side"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      resumes: {
        Row: {
          candidate_id: string
          created_at: string
          file_size: number | null
          filename: string
          id: string
          is_current: boolean
          mime_type: string | null
          parse_error: string | null
          parse_status: string
          parsed_data: Json | null
          storage_path: string
          superseded_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          file_size?: number | null
          filename: string
          id?: string
          is_current?: boolean
          mime_type?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_data?: Json | null
          storage_path: string
          superseded_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          file_size?: number | null
          filename?: string
          id?: string
          is_current?: boolean
          mime_type?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_data?: Json | null
          storage_path?: string
          superseded_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "resumes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          skill_type: Database["public"]["Enums"]["skill_type"]
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          skill_type: Database["public"]["Enums"]["skill_type"]
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          skill_type?: Database["public"]["Enums"]["skill_type"]
        }
        Relationships: []
      }
      sla_policies: {
        Row: {
          client_id: string | null
          config: Json
          created_at: string
          enabled: boolean
          id: string
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id: string | null
          sla_type: string
          threshold_hours: number | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          sla_type: string
          threshold_hours?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          scope?: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          sla_type?: string
          threshold_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      tools: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      workflow_settings: {
        Row: {
          category: string
          client_id: string | null
          config: Json
          created_at: string
          id: string
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          client_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          scope: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["settings_scope"]
          scope_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      workflow_template_sub_stages: {
        Row: {
          agent_id: string | null
          allowed_outcomes: string[]
          capture_feedback_form: boolean
          capture_transcript: boolean
          collaborator_role: string | null
          config: Json
          created_at: string
          decision_mode: Database["public"]["Enums"]["decision_mode"]
          decision_owner: string | null
          display_order: number
          duration_minutes: number | null
          entry_conditions: Database["public"]["Enums"]["stage_entry_condition"][]
          format: Database["public"]["Enums"]["stage_format"] | null
          hire_recommendation_enabled: boolean
          id: string
          interviewer_type: Database["public"]["Enums"]["interviewer_type"]
          name: string
          needs_final_approval: boolean
          override_enabled: boolean
          override_roles: string | null
          owner_role: string | null
          pipeline_stage_id: string
          purpose: string | null
          question_source: Database["public"]["Enums"]["question_source"] | null
          rating_scale: Database["public"]["Enums"]["rating_scale"] | null
          required_questions: string | null
          template_id: string
          visibility: Database["public"]["Enums"]["stage_visibility"]
        }
        Insert: {
          agent_id?: string | null
          allowed_outcomes?: string[]
          capture_feedback_form?: boolean
          capture_transcript?: boolean
          collaborator_role?: string | null
          config?: Json
          created_at?: string
          decision_mode?: Database["public"]["Enums"]["decision_mode"]
          decision_owner?: string | null
          display_order?: number
          duration_minutes?: number | null
          entry_conditions?: Database["public"]["Enums"]["stage_entry_condition"][]
          format?: Database["public"]["Enums"]["stage_format"] | null
          hire_recommendation_enabled?: boolean
          id?: string
          interviewer_type?: Database["public"]["Enums"]["interviewer_type"]
          name: string
          needs_final_approval?: boolean
          override_enabled?: boolean
          override_roles?: string | null
          owner_role?: string | null
          pipeline_stage_id: string
          purpose?: string | null
          question_source?:
            | Database["public"]["Enums"]["question_source"]
            | null
          rating_scale?: Database["public"]["Enums"]["rating_scale"] | null
          required_questions?: string | null
          template_id: string
          visibility?: Database["public"]["Enums"]["stage_visibility"]
        }
        Update: {
          agent_id?: string | null
          allowed_outcomes?: string[]
          capture_feedback_form?: boolean
          capture_transcript?: boolean
          collaborator_role?: string | null
          config?: Json
          created_at?: string
          decision_mode?: Database["public"]["Enums"]["decision_mode"]
          decision_owner?: string | null
          display_order?: number
          duration_minutes?: number | null
          entry_conditions?: Database["public"]["Enums"]["stage_entry_condition"][]
          format?: Database["public"]["Enums"]["stage_format"] | null
          hire_recommendation_enabled?: boolean
          id?: string
          interviewer_type?: Database["public"]["Enums"]["interviewer_type"]
          name?: string
          needs_final_approval?: boolean
          override_enabled?: boolean
          override_roles?: string | null
          owner_role?: string | null
          pipeline_stage_id?: string
          purpose?: string | null
          question_source?:
            | Database["public"]["Enums"]["question_source"]
            | null
          rating_scale?: Database["public"]["Enums"]["rating_scale"] | null
          required_questions?: string | null
          template_id?: string
          visibility?: Database["public"]["Enums"]["stage_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_template_sub_stages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_template_sub_stages_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_template_sub_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          client_id: string | null
          config: Json
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          hiring_type: Database["public"]["Enums"]["employment_type"] | null
          id: string
          name: string
          status: Database["public"]["Enums"]["workflow_template_status"]
          updated_at: string
          version: number
        }
        Insert: {
          client_id?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          hiring_type?: Database["public"]["Enums"]["employment_type"] | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["workflow_template_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          client_id?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          hiring_type?: Database["public"]["Enums"]["employment_type"] | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["workflow_template_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "workflow_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_client_id: { Args: never; Returns: string }
      current_profile_side: {
        Args: never
        Returns: Database["public"]["Enums"]["profile_side"]
      }
    }
    Enums: {
      activity_event_type:
        | "application_created"
        | "candidate_added_to_stage"
        | "candidate_data_updated"
        | "candidate_leaves_stage"
        | "candidate_withdraws"
        | "candidate_fast_tracked"
        | "candidate_reassigned"
        | "note_added"
        | "interview_scheduled"
        | "interview_rescheduled"
        | "interview_reminder_sent"
        | "interview_completed"
        | "scorecard_link_sent"
        | "transcript_submitted"
        | "interview_canceled"
        | "interview_no_show_candidate"
        | "interview_no_show_interviewer"
        | "interview_feedback_submitted"
        | "all_required_evaluations_completed"
        | "evaluation_overdue"
        | "stage_sla_breached"
        | "candidate_advanced"
        | "candidate_rejected"
        | "offer_decision"
        | "offer_created"
        | "offer_accepted"
        | "offer_declined"
        | "offer_expired"
        | "offer_rescinded"
        | "application_closed"
        | "application_reopened"
        | "candidate_created"
        | "resume_ingested"
        | "job_created"
        | "job_published"
        | "job_workflow_snapshotted"
        | "job_team_member_added"
        | "calendar_connected"
        | "calendar_connection_revoked"
      actor_type: "user" | "system" | "candidate"
      agent_status: "active" | "inactive"
      application_status:
        | "active"
        | "hired"
        | "rejected"
        | "withdrawn"
        | "on_hold"
      candidate_tier: "gold" | "silver" | "bronze"
      client_plan: "basic" | "standard" | "premium"
      client_role: "reviewer" | "admin" | "hiring_manager" | "recruiter"
      client_status: "active" | "paused" | "churned"
      competency_type: "technical" | "behavioral" | "hybrid" | "leadership"
      confidence_level: "low" | "medium" | "high"
      data_provenance: "ai_parsed" | "recruiter_confirmed" | "enriched"
      decision_mode: "single_rater" | "multi_rater"
      employment_type:
        | "full-time"
        | "part-time"
        | "contract"
        | "freelance"
        | "internship"
      eval_status: "pending" | "completed"
      event_severity: "info" | "action_needed" | "alert"
      fit_proficiency_level: "aware" | "proficient" | "expert"
      hire_recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire"
      interaction_type: "call" | "email" | "interview" | "note"
      interviewer_type: "human" | "ai" | "external"
      job_status: "draft" | "open" | "paused" | "filled" | "closed"
      nurture_status: "active" | "dormant" | "re_engaging"
      pipeline_stage: "source" | "screen" | "interview" | "offer" | "close"
      placement_status: "active" | "completed" | "fell_through"
      proficiency_level: "beginner" | "intermediate" | "advanced" | "expert"
      profile_side: "stellaforce" | "client"
      question_source: "manual" | "structured" | "ai_assisted"
      rating_scale: "star" | "ten-point" | "hundred-point"
      scheduling_policy:
        | "recruiter_led"
        | "candidate_self_scheduling"
        | "system_auto_schedule"
      settings_scope: "global" | "client" | "workflow" | "job"
      skill_type: "technical" | "functional" | "behavioral"
      stage_entry_condition: "manual" | "automatic"
      stage_format: "phone" | "video" | "onsite" | "async"
      stage_visibility: "internal" | "candidate_facing"
      user_role: "recruiter" | "manager" | "admin"
      workflow_template_status: "draft" | "published"
      workplace_type: "on-site" | "hybrid" | "remote"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_event_type: [
        "application_created",
        "candidate_added_to_stage",
        "candidate_data_updated",
        "candidate_leaves_stage",
        "candidate_withdraws",
        "candidate_fast_tracked",
        "candidate_reassigned",
        "note_added",
        "interview_scheduled",
        "interview_rescheduled",
        "interview_reminder_sent",
        "interview_completed",
        "scorecard_link_sent",
        "transcript_submitted",
        "interview_canceled",
        "interview_no_show_candidate",
        "interview_no_show_interviewer",
        "interview_feedback_submitted",
        "all_required_evaluations_completed",
        "evaluation_overdue",
        "stage_sla_breached",
        "candidate_advanced",
        "candidate_rejected",
        "offer_decision",
        "offer_created",
        "offer_accepted",
        "offer_declined",
        "offer_expired",
        "offer_rescinded",
        "application_closed",
        "application_reopened",
        "candidate_created",
        "resume_ingested",
        "job_created",
        "job_published",
        "job_workflow_snapshotted",
        "job_team_member_added",
        "calendar_connected",
        "calendar_connection_revoked",
      ],
      actor_type: ["user", "system", "candidate"],
      agent_status: ["active", "inactive"],
      application_status: [
        "active",
        "hired",
        "rejected",
        "withdrawn",
        "on_hold",
      ],
      candidate_tier: ["gold", "silver", "bronze"],
      client_plan: ["basic", "standard", "premium"],
      client_role: ["reviewer", "admin", "hiring_manager", "recruiter"],
      client_status: ["active", "paused", "churned"],
      competency_type: ["technical", "behavioral", "hybrid", "leadership"],
      confidence_level: ["low", "medium", "high"],
      data_provenance: ["ai_parsed", "recruiter_confirmed", "enriched"],
      decision_mode: ["single_rater", "multi_rater"],
      employment_type: [
        "full-time",
        "part-time",
        "contract",
        "freelance",
        "internship",
      ],
      eval_status: ["pending", "completed"],
      event_severity: ["info", "action_needed", "alert"],
      fit_proficiency_level: ["aware", "proficient", "expert"],
      hire_recommendation: ["strong_hire", "hire", "no_hire", "strong_no_hire"],
      interaction_type: ["call", "email", "interview", "note"],
      interviewer_type: ["human", "ai", "external"],
      job_status: ["draft", "open", "paused", "filled", "closed"],
      nurture_status: ["active", "dormant", "re_engaging"],
      pipeline_stage: ["source", "screen", "interview", "offer", "close"],
      placement_status: ["active", "completed", "fell_through"],
      proficiency_level: ["beginner", "intermediate", "advanced", "expert"],
      profile_side: ["stellaforce", "client"],
      question_source: ["manual", "structured", "ai_assisted"],
      rating_scale: ["star", "ten-point", "hundred-point"],
      scheduling_policy: [
        "recruiter_led",
        "candidate_self_scheduling",
        "system_auto_schedule",
      ],
      settings_scope: ["global", "client", "workflow", "job"],
      skill_type: ["technical", "functional", "behavioral"],
      stage_entry_condition: ["manual", "automatic"],
      stage_format: ["phone", "video", "onsite", "async"],
      stage_visibility: ["internal", "candidate_facing"],
      user_role: ["recruiter", "manager", "admin"],
      workflow_template_status: ["draft", "published"],
      workplace_type: ["on-site", "hybrid", "remote"],
    },
  },
} as const

type SchemaTables = Database["public"]["Tables"]
type SchemaEnums = Database["public"]["Enums"]

// ── Enums ────────────────────────────────────────────────────────────────────
export type CandidateTier = SchemaEnums["candidate_tier"]
export type DataProvenance = SchemaEnums["data_provenance"]
export type SkillType = SchemaEnums["skill_type"]
export type ProficiencyLevel = SchemaEnums["proficiency_level"]
export type FitProficiencyLevel = SchemaEnums["fit_proficiency_level"]
export type ConfidenceLevel = SchemaEnums["confidence_level"]
export type ClientStatus = SchemaEnums["client_status"]
export type ClientPlan = SchemaEnums["client_plan"]
export type JobStatus = SchemaEnums["job_status"]
export type CompetencyType = SchemaEnums["competency_type"]
export type PipelineStage = SchemaEnums["pipeline_stage"]
export type StageFormat = SchemaEnums["stage_format"]
export type RatingScale = SchemaEnums["rating_scale"]
export type EmploymentType = SchemaEnums["employment_type"]
export type WorkplaceType = SchemaEnums["workplace_type"]
export type ApplicationStatus = SchemaEnums["application_status"]
export type EvalStatus = SchemaEnums["eval_status"]
export type PlacementStatus = SchemaEnums["placement_status"]
export type InteractionType = SchemaEnums["interaction_type"]
export type NurtureStatus = SchemaEnums["nurture_status"]
export type UserRole = SchemaEnums["user_role"]
export type ProfileSide = SchemaEnums["profile_side"]
export type ClientRole = SchemaEnums["client_role"]

// ── Domain JSON shapes (advisory; columns are jsonb) ─────────────────────────
export type AiLiteracySignal = {
  tool_used?: string
  how_used?: string
  measurable_outcome?: string
}

// ── Candidate domain ─────────────────────────────────────────────────────────
export type CandidateRow = SchemaTables["candidates"]["Row"]
export type CandidateWorkExperienceRow = SchemaTables["candidate_work_experiences"]["Row"]
export type CandidateEducationRow = SchemaTables["candidate_education"]["Row"]
export type CandidateCertificationRow = SchemaTables["candidate_certifications"]["Row"]
export type CandidateLinkRow = SchemaTables["candidate_links"]["Row"]
export type SkillRow = SchemaTables["skills"]["Row"]
export type ToolRow = SchemaTables["tools"]["Row"]
export type CandidateSkillRow = SchemaTables["candidate_skills"]["Row"]
export type CandidateToolRow = SchemaTables["candidate_tools"]["Row"]
/** A candidate_skills row joined with its global skill definition — the shape `getCandidate` returns. */
export type CandidateSkillWithSkill = CandidateSkillRow & {
  skill: Pick<SkillRow, "name" | "skill_type" | "category"> | null
}
/** A candidate_tools row joined with its global tool definition — the shape `getCandidate` returns. */
export type CandidateToolWithTool = CandidateToolRow & {
  tool: Pick<ToolRow, "name"> | null
}

// ── Client & job domain ──────────────────────────────────────────────────────
export type ClientRow = SchemaTables["clients"]["Row"]
export type JobOrderRow = SchemaTables["job_orders"]["Row"]
export type JobNoteRow = SchemaTables["job_notes"]["Row"]
export type JobCompetencyRow = SchemaTables["job_competencies"]["Row"]
export type JobCompetencyLevelDescriptionRow = SchemaTables["job_competency_level_descriptions"]["Row"]
export type JobScorecardCategoryRow = SchemaTables["job_scorecard_categories"]["Row"]
export type JobTeamMemberRow = SchemaTables["job_team_members"]["Row"]
export type PipelineStageRow = SchemaTables["pipeline_stages"]["Row"]
export type JobWorkflowSubStageRow = SchemaTables["job_workflow_sub_stages"]["Row"]
export type JobWorkflowSubStageDetailRow = SchemaTables["job_workflow_sub_stage_details"]["Row"]

// ── Pipeline & evaluation ────────────────────────────────────────────────────
export type ApplicationRow = SchemaTables["applications"]["Row"]
export type ApplicationStageEvaluationRow = SchemaTables["application_stage_evaluations"]["Row"]
export type ApplicationStageEvaluationNoteRow = SchemaTables["application_stage_evaluation_notes"]["Row"]
export type ApplicationStageEvaluationQuestionRow =
  SchemaTables["application_stage_evaluation_questions"]["Row"]
export type ApplicationScorecardCategoryRow = SchemaTables["application_scorecard_categories"]["Row"]
export type ApplicationScorecardCompetencyRow = SchemaTables["application_scorecard_competencies"]["Row"]
export type ApplicationScorecardEvidenceRow = SchemaTables["application_scorecard_evidence"]["Row"]
export type PlacementRow = SchemaTables["placements"]["Row"]
export type InteractionRow = SchemaTables["interactions"]["Row"]
export type CandidateClientFitRow = SchemaTables["candidate_client_fit"]["Row"]
export type CandidateClientFitEvidenceRow = SchemaTables["candidate_client_fit_evidence"]["Row"]

// ── Auth ─────────────────────────────────────────────────────────────────────
export type ProfileRow = SchemaTables["profiles"]["Row"]

// ── Resume ingestion ─────────────────────────────────────────────────────────
export type ResumeRow = SchemaTables["resumes"]["Row"]
export type ResumeInsert = SchemaTables["resumes"]["Insert"]
export type IngestionJobRow = SchemaTables["ingestion_jobs"]["Row"]
export type IngestionJobInsert = SchemaTables["ingestion_jobs"]["Insert"]
export type IngestionJobStatus = "received" | "processing" | "completed" | "failed" | "needs_review"
export type ResumeParseStatus = "pending" | "parsed" | "failed" | "needs_review"

// ── Workflow templates / settings / activity (workflow-templates feature) ────
export type StageVisibility = SchemaEnums["stage_visibility"]
export type StageEntryCondition = SchemaEnums["stage_entry_condition"]
export type InterviewerType = SchemaEnums["interviewer_type"]
export type QuestionSource = SchemaEnums["question_source"]
export type DecisionMode = SchemaEnums["decision_mode"]
export type HireRecommendation = SchemaEnums["hire_recommendation"]
export type SchedulingPolicy = SchemaEnums["scheduling_policy"]
export type WorkflowTemplateStatus = SchemaEnums["workflow_template_status"]
export type SettingsScope = SchemaEnums["settings_scope"]
export type ActorType = SchemaEnums["actor_type"]
export type EventSeverity = SchemaEnums["event_severity"]
export type ActivityEventType = SchemaEnums["activity_event_type"]

export type WorkflowTemplateRow = SchemaTables["workflow_templates"]["Row"]
export type WorkflowTemplateInsert = SchemaTables["workflow_templates"]["Insert"]
export type WorkflowTemplateSubStageRow = SchemaTables["workflow_template_sub_stages"]["Row"]
export type WorkflowTemplateSubStageInsert = SchemaTables["workflow_template_sub_stages"]["Insert"]
export type WorkflowSettingRow = SchemaTables["workflow_settings"]["Row"]
export type SlaPolicyRow = SchemaTables["sla_policies"]["Row"]
export type AutomationRuleRow = SchemaTables["automation_rules"]["Row"]
export type CommunicationTemplateRow = SchemaTables["communication_templates"]["Row"]
export type ActivityEventRow = SchemaTables["activity_events"]["Row"]
export type ActivityEventInsert = SchemaTables["activity_events"]["Insert"]
export type ApplicationStageHistoryRow = SchemaTables["application_stage_history"]["Row"]
export type AuditLogRow = SchemaTables["audit_log"]["Row"]
export type AiInteractionRow = SchemaTables["ai_interactions"]["Row"]
export type JobTargetCompanyRow = SchemaTables["job_target_companies"]["Row"]
export type GoogleCalendarConnectionRow = SchemaTables["google_calendar_connections"]["Row"]
export type GoogleCalendarConnectionInsert = SchemaTables["google_calendar_connections"]["Insert"]

// ── Agents / call recordings (screening-agent registry + interview/call log) ─
export type AgentRow = SchemaTables["agents"]["Row"]
export type AgentInsert = SchemaTables["agents"]["Insert"]
export type AgentStatus = SchemaEnums["agent_status"]
export type CallRecordingRow = SchemaTables["call_recordings"]["Row"]
export type CallRecordingInsert = SchemaTables["call_recordings"]["Insert"]
