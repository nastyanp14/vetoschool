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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_access_overrides: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          new_access_status: string | null
          new_payment_status: string | null
          previous_access_status: string | null
          previous_payment_status: string | null
          reason: string
          user_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          new_access_status?: string | null
          new_payment_status?: string | null
          previous_access_status?: string | null
          previous_payment_status?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          new_access_status?: string | null
          new_payment_status?: string | null
          previous_access_status?: string | null
          previous_payment_status?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_overrides_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_lesson_adjustments: {
        Row: {
          admin_user_id: string
          created_at: string
          delta: number
          id: string
          idempotency_key: string
          new_lessons_remaining: number
          previous_lessons_remaining: number
          reason: string
          user_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          delta: number
          id?: string
          idempotency_key: string
          new_lessons_remaining: number
          previous_lessons_remaining: number
          reason: string
          user_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          delta?: number
          id?: string
          idempotency_key?: string
          new_lessons_remaining?: number
          previous_lessons_remaining?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_lesson_adjustments_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_lesson_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_purchases: {
        Row: {
          avatar_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          avatar_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          avatar_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          checked_at: string | null
          created_at: string
          due_date: string | null
          emoji: string
          errors_count: number | null
          external_link: string | null
          file_name: string | null
          file_url: string | null
          homework_status: string
          id: string
          interactive_attempts: number
          interactive_completed_at: string | null
          interactive_lesson_id: string | null
          interactive_score_percent: number | null
          material_mode: string
          module_id: string
          result_percent: number | null
          review_comment: string | null
          reviewed_by_teacher_id: string | null
          rewarded_stars: number
          scheduled_date: string | null
          scheduled_time: string | null
          star_rating: number | null
          student_result: string | null
          submitted_at: string | null
          submitted_attachment_name: string | null
          submitted_attachment_url: string | null
          teacher_comment: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          unlocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          due_date?: string | null
          emoji?: string
          errors_count?: number | null
          external_link?: string | null
          file_name?: string | null
          file_url?: string | null
          homework_status?: string
          id?: string
          interactive_attempts?: number
          interactive_completed_at?: string | null
          interactive_lesson_id?: string | null
          interactive_score_percent?: number | null
          material_mode?: string
          module_id: string
          result_percent?: number | null
          review_comment?: string | null
          reviewed_by_teacher_id?: string | null
          rewarded_stars?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          star_rating?: number | null
          student_result?: string | null
          submitted_at?: string | null
          submitted_attachment_name?: string | null
          submitted_attachment_url?: string | null
          teacher_comment?: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          unlocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          due_date?: string | null
          emoji?: string
          errors_count?: number | null
          external_link?: string | null
          file_name?: string | null
          file_url?: string | null
          homework_status?: string
          id?: string
          interactive_attempts?: number
          interactive_completed_at?: string | null
          interactive_lesson_id?: string | null
          interactive_score_percent?: number | null
          material_mode?: string
          module_id?: string
          result_percent?: number | null
          review_comment?: string | null
          reviewed_by_teacher_id?: string | null
          rewarded_stars?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          star_rating?: number | null
          student_result?: string | null
          submitted_at?: string | null
          submitted_attachment_name?: string | null
          submitted_attachment_url?: string | null
          teacher_comment?: string | null
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          unlocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_interactive_lesson_id_fkey"
            columns: ["interactive_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_reviewed_by_teacher_id_fkey"
            columns: ["reviewed_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      dictionary_words: {
        Row: {
          audio_url: string | null
          category: string
          created_at: string
          emoji: string
          id: string
          image_url: string | null
          lesson: string
          translation: string
          user_id: string
          word: string
        }
        Insert: {
          audio_url?: string | null
          category?: string
          created_at?: string
          emoji?: string
          id?: string
          image_url?: string | null
          lesson?: string
          translation: string
          user_id: string
          word: string
        }
        Update: {
          audio_url?: string | null
          category?: string
          created_at?: string
          emoji?: string
          id?: string
          image_url?: string | null
          lesson?: string
          translation?: string
          user_id?: string
          word?: string
        }
        Relationships: []
      }
      email_notifications: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          notification_key: string
          notification_type: string
          payload: Json
          provider: string
          provider_message_id: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          stripe_event_id: string | null
          stripe_payment_id: string | null
          stripe_refund_id: string | null
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_key: string
          notification_type: string
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          stripe_event_id?: string | null
          stripe_payment_id?: string | null
          stripe_refund_id?: string | null
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_key?: string
          notification_type?: string
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          stripe_event_id?: string | null
          stripe_payment_id?: string | null
          stripe_refund_id?: string | null
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_stripe_payment_id_fkey"
            columns: ["stripe_payment_id"]
            isOneToOne: false
            referencedRelation: "stripe_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_stripe_refund_id_fkey"
            columns: ["stripe_refund_id"]
            isOneToOne: false
            referencedRelation: "stripe_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error: string | null
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          notification_log_id: string | null
          provider: string | null
          recipient_email: string
          request: Json | null
          response: Json | null
          status: string
          template_name: string
          transactional_email_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          notification_log_id?: string | null
          provider?: string | null
          recipient_email: string
          request?: Json | null
          response?: Json | null
          status: string
          template_name: string
          transactional_email_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          notification_log_id?: string | null
          provider?: string | null
          recipient_email?: string
          request?: Json | null
          response?: Json | null
          status?: string
          template_name?: string
          transactional_email_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_notification_log_id_fkey"
            columns: ["notification_log_id"]
            isOneToOne: false
            referencedRelation: "notification_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_transactional_email_id_fkey"
            columns: ["transactional_email_id"]
            isOneToOne: false
            referencedRelation: "transactional_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      grades: {
        Row: {
          category: string
          comment: string | null
          content_id: string | null
          created_at: string
          feedback: string | null
          grade_type: string
          group_id: string | null
          id: string
          improvements: string | null
          lesson_id: string | null
          max_score: number
          numeric_score: number | null
          score: number | null
          star_rating: number | null
          strengths: string | null
          teacher_id: string | null
          updated_at: string
          user_id: string
          visible_to_parent: boolean
        }
        Insert: {
          category: string
          comment?: string | null
          content_id?: string | null
          created_at?: string
          feedback?: string | null
          grade_type?: string
          group_id?: string | null
          id?: string
          improvements?: string | null
          lesson_id?: string | null
          max_score?: number
          numeric_score?: number | null
          score?: number | null
          star_rating?: number | null
          strengths?: string | null
          teacher_id?: string | null
          updated_at?: string
          user_id: string
          visible_to_parent?: boolean
        }
        Update: {
          category?: string
          comment?: string | null
          content_id?: string | null
          created_at?: string
          feedback?: string | null
          grade_type?: string
          group_id?: string | null
          id?: string
          improvements?: string | null
          lesson_id?: string | null
          max_score?: number
          numeric_score?: number | null
          score?: number | null
          star_rating?: number | null
          strengths?: string | null
          teacher_id?: string | null
          updated_at?: string
          user_id?: string
          visible_to_parent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "grades_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      interactive_tasks: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          mechanic_type: string
          order: number
          payload_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          mechanic_type: string
          order?: number
          payload_json?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          mechanic_type?: string
          order?: number
          payload_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactive_tasks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_assignments: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_attendance: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          note: string | null
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          note?: string | null
          status: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          note?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attendance_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_change_requests: {
        Row: {
          admin_comment: string | null
          change_type: string
          comment: string
          created_at: string
          desired_date: string | null
          desired_time: string | null
          id: string
          lesson_id: string
          new_start_at: string | null
          old_start_at: string | null
          reason: string | null
          request_type: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          change_type: string
          comment?: string
          created_at?: string
          desired_date?: string | null
          desired_time?: string | null
          id?: string
          lesson_id: string
          new_start_at?: string | null
          old_start_at?: string | null
          reason?: string | null
          request_type?: string
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          change_type?: string
          comment?: string
          created_at?: string
          desired_date?: string | null
          desired_time?: string | null
          id?: string
          lesson_id?: string
          new_start_at?: string | null
          old_start_at?: string | null
          reason?: string | null
          request_type?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_change_requests_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_change_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_change_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_live_events: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          lesson_id: string
          payload_json: Json
          session_id: string
          student_id: string
          task_id: string | null
        }
        Insert: {
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          lesson_id: string
          payload_json?: Json
          session_id: string
          student_id: string
          task_id?: string | null
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          lesson_id?: string
          payload_json?: Json
          session_id?: string
          student_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_live_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_live_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_live_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lesson_live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_live_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_live_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "interactive_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_live_sessions: {
        Row: {
          completed_at: string | null
          current_task_id: string | null
          current_task_index: number
          id: string
          last_seen_at: string
          lesson_id: string
          started_at: string
          status: string
          student_id: string
        }
        Insert: {
          completed_at?: string | null
          current_task_id?: string | null
          current_task_index?: number
          id?: string
          last_seen_at?: string
          lesson_id: string
          started_at?: string
          status?: string
          student_id: string
        }
        Update: {
          completed_at?: string | null
          current_task_id?: string | null
          current_task_index?: number
          id?: string
          last_seen_at?: string
          lesson_id?: string
          started_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_live_sessions_current_task_id_fkey"
            columns: ["current_task_id"]
            isOneToOne: false
            referencedRelation: "interactive_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_live_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_live_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_materials: {
        Row: {
          category: string | null
          course: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          external_url: string | null
          file_url: string | null
          id: string
          is_published: boolean
          lesson_id: string | null
          level: string | null
          material_type: string
          tags: string[]
          thumbnail_url: string | null
          title: string
          unit_title: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          course?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          level?: string | null
          material_type: string
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          unit_title?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          course?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          level?: string | null
          material_type?: string
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          unit_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plan_blocks: {
        Row: {
          admin_note: string
          block_kind: string
          created_at: string
          id: string
          material_mode: string
          material_title: string
          material_url: string | null
          position: number
          schedule_id: string
          source_lesson_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string
          block_kind: string
          created_at?: string
          id?: string
          material_mode?: string
          material_title?: string
          material_url?: string | null
          position?: number
          schedule_id: string
          source_lesson_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string
          block_kind?: string
          created_at?: string
          id?: string
          material_mode?: string
          material_title?: string
          material_url?: string | null
          position?: number
          schedule_id?: string
          source_lesson_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plan_blocks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plan_blocks_source_lesson_id_fkey"
            columns: ["source_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          stars_awarded: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          stars_awarded?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          stars_awarded?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_results: {
        Row: {
          admin_note: string
          carry_over_to_next_lesson: string
          created_at: string
          homework_brief: string
          id: string
          lesson_id: string
          payload: Json
          summary: string
          teacher_comment: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          admin_note?: string
          carry_over_to_next_lesson?: string
          created_at?: string
          homework_brief?: string
          id?: string
          lesson_id: string
          payload?: Json
          summary?: string
          teacher_comment?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          admin_note?: string
          carry_over_to_next_lesson?: string
          created_at?: string
          homework_brief?: string
          id?: string
          lesson_id?: string
          payload?: Json
          summary?: string
          teacher_comment?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_results_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_results_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          id: string
          is_global: boolean
          lesson_number: number
          order: number
          stars_reward: number
          title: string
          type: Database["public"]["Enums"]["lesson_kind"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_global?: boolean
          lesson_number?: number
          order?: number
          stars_reward?: number
          title: string
          type?: Database["public"]["Enums"]["lesson_kind"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_global?: boolean
          lesson_number?: number
          order?: number
          stars_reward?: number
          title?: string
          type?: Database["public"]["Enums"]["lesson_kind"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_access_overrides: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          reason: string
          student_id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason: string
          student_id: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_access_overrides_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_access_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          attempts: number
          body_preview: string | null
          channel: string
          created_at: string
          entity_id: string
          entity_type: string
          error: string | null
          error_message: string | null
          event_key: string | null
          event_type: string
          event_version: number
          failed_at: string | null
          id: string
          idempotency_key: string
          language: string
          payload: Json
          provider: string | null
          provider_message_id: string | null
          provider_response: Json | null
          queued_at: string | null
          recipient: string | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_role: string
          sent_at: string | null
          status: string
          student_id: string | null
          subject: string | null
          telegram_chat_id: string | null
          template_variables: Json | null
          trial_request_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          body_preview?: string | null
          channel: string
          created_at?: string
          entity_id: string
          entity_type: string
          error?: string | null
          error_message?: string | null
          event_key?: string | null
          event_type: string
          event_version?: number
          failed_at?: string | null
          id?: string
          idempotency_key: string
          language?: string
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          queued_at?: string | null
          recipient?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_role?: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          subject?: string | null
          telegram_chat_id?: string | null
          template_variables?: Json | null
          trial_request_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          body_preview?: string | null
          channel?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          error_message?: string | null
          event_key?: string | null
          event_type?: string
          event_version?: number
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          language?: string
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          queued_at?: string | null
          recipient?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_role?: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          subject?: string | null
          telegram_chat_id?: string | null
          template_variables?: Json | null
          trial_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_trial_request_id_fkey"
            columns: ["trial_request_id"]
            isOneToOne: false
            referencedRelation: "trial_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_registry: {
        Row: {
          body: string | null
          button_label: string | null
          button_url_template: string | null
          channel: string | null
          created_at: string | null
          enabled: boolean | null
          event_type: string | null
          event_version: number | null
          id: string
          language: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          button_label?: string | null
          button_url_template?: string | null
          channel?: string | null
          created_at?: string | null
          enabled?: boolean | null
          event_type?: string | null
          event_version?: number | null
          id?: string
          language?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          button_label?: string | null
          button_url_template?: string | null
          channel?: string | null
          created_at?: string | null
          enabled?: boolean | null
          event_type?: string | null
          event_version?: number | null
          id?: string
          language?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_status: Database["public"]["Enums"]["access_status"]
          avatar_id: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          email: string
          has_access: boolean
          id: string
          lang: string
          lesson_format: string | null
          lessons_remaining: number
          lessons_total: number
          manual_access_override: boolean
          manual_access_override_at: string | null
          manual_access_override_by: string | null
          manual_access_override_reason: string | null
          name: string
          next_payment_date: string | null
          payment_failed_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pending_celebration: number
          plan_id: string | null
          star_balance: number
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          total_stars_earned: number
          updated_at: string
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["access_status"]
          avatar_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          email: string
          has_access?: boolean
          id: string
          lang?: string
          lesson_format?: string | null
          lessons_remaining?: number
          lessons_total?: number
          manual_access_override?: boolean
          manual_access_override_at?: string | null
          manual_access_override_by?: string | null
          manual_access_override_reason?: string | null
          name?: string
          next_payment_date?: string | null
          payment_failed_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pending_celebration?: number
          plan_id?: string | null
          star_balance?: number
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          total_stars_earned?: number
          updated_at?: string
        }
        Update: {
          access_status?: Database["public"]["Enums"]["access_status"]
          avatar_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          email?: string
          has_access?: boolean
          id?: string
          lang?: string
          lesson_format?: string | null
          lessons_remaining?: number
          lessons_total?: number
          manual_access_override?: boolean
          manual_access_override_at?: string | null
          manual_access_override_by?: string | null
          manual_access_override_reason?: string | null
          name?: string
          next_payment_date?: string | null
          payment_failed_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pending_celebration?: number
          plan_id?: string | null
          star_balance?: number
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          total_stars_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manual_access_override_by_fkey"
            columns: ["manual_access_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          carry_over_to_next_lesson: string | null
          comment: string | null
          completed_at: string | null
          completed_by_teacher_id: string | null
          created_at: string
          day: string
          duration_minutes: number | null
          group_id: string | null
          homework_brief: string | null
          id: string
          is_conducted: boolean
          lesson_status: string
          lesson_type: string
          online_url: string | null
          position: number
          rescheduled_from: string | null
          room: string | null
          scheduled_date: string | null
          source_lesson_id: string | null
          started_at: string | null
          teacher_id: string | null
          time: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carry_over_to_next_lesson?: string | null
          comment?: string | null
          completed_at?: string | null
          completed_by_teacher_id?: string | null
          created_at?: string
          day: string
          duration_minutes?: number | null
          group_id?: string | null
          homework_brief?: string | null
          id?: string
          is_conducted?: boolean
          lesson_status?: string
          lesson_type?: string
          online_url?: string | null
          position?: number
          rescheduled_from?: string | null
          room?: string | null
          scheduled_date?: string | null
          source_lesson_id?: string | null
          started_at?: string | null
          teacher_id?: string | null
          time: string
          topic?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carry_over_to_next_lesson?: string | null
          comment?: string | null
          completed_at?: string | null
          completed_by_teacher_id?: string | null
          created_at?: string
          day?: string
          duration_minutes?: number | null
          group_id?: string | null
          homework_brief?: string | null
          id?: string
          is_conducted?: boolean
          lesson_status?: string
          lesson_type?: string
          online_url?: string | null
          position?: number
          rescheduled_from?: string | null
          room?: string | null
          scheduled_date?: string | null
          source_lesson_id?: string | null
          started_at?: string | null
          teacher_id?: string | null
          time?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_completed_by_teacher_id_fkey"
            columns: ["completed_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_source_lesson_id_fkey"
            columns: ["source_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payment_failures: {
        Row: {
          amount_due: number | null
          created_at: string
          currency: string | null
          failure_reason: string | null
          id: string
          status: string
          stripe_customer_id: string
          stripe_event_id: string
          stripe_invoice_id: string
          stripe_subscription_id: string
          user_id: string
        }
        Insert: {
          amount_due?: number | null
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          status?: string
          stripe_customer_id: string
          stripe_event_id: string
          stripe_invoice_id: string
          stripe_subscription_id: string
          user_id: string
        }
        Update: {
          amount_due?: number | null
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_event_id?: string
          stripe_invoice_id?: string
          stripe_subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payment_failures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payments: {
        Row: {
          amount_total: number | null
          checkout_session_id: string | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          customer_email: string | null
          event_type: string
          id: string
          lesson_format: string
          lessons_total: number
          next_payment_date: string | null
          paid_at: string
          plan_id: string
          stripe_charge_id: string | null
          stripe_customer_id: string
          stripe_event_id: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_price_id: string
          stripe_subscription_id: string
          subscription_status: string
          user_id: string
        }
        Insert: {
          amount_total?: number | null
          checkout_session_id?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          event_type?: string
          id?: string
          lesson_format: string
          lessons_total: number
          next_payment_date?: string | null
          paid_at?: string
          plan_id: string
          stripe_charge_id?: string | null
          stripe_customer_id: string
          stripe_event_id: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_price_id: string
          stripe_subscription_id: string
          subscription_status: string
          user_id: string
        }
        Update: {
          amount_total?: number | null
          checkout_session_id?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          event_type?: string
          id?: string
          lesson_format?: string
          lessons_total?: number
          next_payment_date?: string | null
          paid_at?: string
          plan_id?: string
          stripe_charge_id?: string | null
          stripe_customer_id?: string
          stripe_event_id?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_price_id?: string
          stripe_subscription_id?: string
          subscription_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_refunds: {
        Row: {
          amount: number
          created_at: string
          created_by_admin_id: string
          currency: string
          id: string
          idempotency_key: string
          reason: string
          refund_type: string
          status: string
          stripe_charge_id: string | null
          stripe_payment_id: string
          stripe_payment_intent_id: string | null
          stripe_refund_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by_admin_id: string
          currency: string
          id?: string
          idempotency_key: string
          reason: string
          refund_type: string
          status: string
          stripe_charge_id?: string | null
          stripe_payment_id: string
          stripe_payment_intent_id?: string | null
          stripe_refund_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by_admin_id?: string
          currency?: string
          id?: string
          idempotency_key?: string
          reason?: string
          refund_type?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_id?: string
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_refunds_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_refunds_stripe_payment_id_fkey"
            columns: ["stripe_payment_id"]
            isOneToOne: false
            referencedRelation: "stripe_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_refunds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at_stripe: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          livemode: boolean
          processed_at: string | null
          processing_status: string
          received_at: string
          status: string
          stripe_created_at: string
          updated_at: string
        }
        Insert: {
          created_at_stripe: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          livemode?: boolean
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          status?: string
          stripe_created_at: string
          updated_at?: string
        }
        Update: {
          created_at_stripe?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          livemode?: boolean
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          status?: string
          stripe_created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_groups: {
        Row: {
          course: string | null
          created_at: string
          current_lesson: string | null
          current_unit: string | null
          description: string | null
          id: string
          lesson_duration_minutes: number | null
          lesson_url: string | null
          level: string | null
          name: string
          progress: number
          start_date: string | null
          status: string
          teacher_id: string | null
          updated_at: string
          weekly_frequency: number | null
        }
        Insert: {
          course?: string | null
          created_at?: string
          current_lesson?: string | null
          current_unit?: string | null
          description?: string | null
          id?: string
          lesson_duration_minutes?: number | null
          lesson_url?: string | null
          level?: string | null
          name: string
          progress?: number
          start_date?: string | null
          status?: string
          teacher_id?: string | null
          updated_at?: string
          weekly_frequency?: number | null
        }
        Update: {
          course?: string | null
          created_at?: string
          current_lesson?: string | null
          current_unit?: string | null
          description?: string | null
          id?: string
          lesson_duration_minutes?: number | null
          lesson_url?: string | null
          level?: string | null
          name?: string
          progress?: number
          start_date?: string | null
          status?: string
          teacher_id?: string | null
          updated_at?: string
          weekly_frequency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parent_links: {
        Row: {
          active: boolean
          created_at: string
          disconnected_at: string | null
          id: string
          linked_at: string
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          disconnected_at?: string | null
          id?: string
          linked_at?: string
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          disconnected_at?: string | null
          id?: string
          linked_at?: string
          parent_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "telegram_parent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      teacher_material_favorites: {
        Row: {
          created_at: string
          id: string
          material_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_material_favorites_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lesson_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_material_favorites_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_material_recents: {
        Row: {
          id: string
          material_id: string
          teacher_id: string
          view_count: number
          viewed_at: string
        }
        Insert: {
          id?: string
          material_id: string
          teacher_id: string
          view_count?: number
          viewed_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          teacher_id?: string
          view_count?: number
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_material_recents_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "lesson_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_material_recents_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_message_threads: {
        Row: {
          admin_unread_count: number
          created_at: string
          group_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          participant_role: string
          participant_user_id: string | null
          status: string
          student_id: string | null
          subject: string | null
          teacher_id: string
          teacher_unread_count: number
          updated_at: string
        }
        Insert: {
          admin_unread_count?: number
          created_at?: string
          group_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_role: string
          participant_user_id?: string | null
          status?: string
          student_id?: string | null
          subject?: string | null
          teacher_id: string
          teacher_unread_count?: number
          updated_at?: string
        }
        Update: {
          admin_unread_count?: number
          created_at?: string
          group_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_role?: string
          participant_user_id?: string | null
          status?: string
          student_id?: string | null
          subject?: string | null
          teacher_id?: string
          teacher_unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_message_threads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_message_threads_participant_user_id_fkey"
            columns: ["participant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_message_threads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_message_threads_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_role: string
          sender_user_id: string
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_role: string
          sender_user_id: string
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_role?: string
          sender_user_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "teacher_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_notes: {
        Row: {
          attachment_label: string | null
          attachment_url: string | null
          author_id: string
          created_at: string
          group_id: string | null
          id: string
          lesson_id: string | null
          note_type: string
          pinned: boolean
          student_id: string | null
          teacher_id: string
          text: string
          title: string | null
          updated_at: string
        }
        Insert: {
          attachment_label?: string | null
          attachment_url?: string | null
          author_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          lesson_id?: string | null
          note_type?: string
          pinned?: boolean
          student_id?: string | null
          teacher_id: string
          text: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          attachment_label?: string | null
          attachment_url?: string | null
          author_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          lesson_id?: string | null
          note_type?: string
          pinned?: boolean
          student_id?: string | null
          teacher_id?: string
          text?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          group_id: string | null
          homework_id: string | null
          id: string
          lesson_id: string | null
          opened_at: string | null
          payload: Json
          read_at: string | null
          student_id: string | null
          teacher_id: string
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          group_id?: string | null
          homework_id?: string | null
          id?: string
          lesson_id?: string | null
          opened_at?: string | null
          payload?: Json
          read_at?: string | null
          student_id?: string | null
          teacher_id: string
          title: string
          type: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          group_id?: string | null
          homework_id?: string | null
          id?: string
          lesson_id?: string | null
          opened_at?: string | null
          payload?: Json
          read_at?: string | null
          student_id?: string | null
          teacher_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notifications_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notifications_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_preferences: {
        Row: {
          app_language: string
          appearance: string
          calendar_preferences: Json
          created_at: string
          dashboard_preferences: Json
          id: string
          notification_preferences: Json
          teacher_id: string
          updated_at: string
        }
        Insert: {
          app_language?: string
          appearance?: string
          calendar_preferences?: Json
          created_at?: string
          dashboard_preferences?: Json
          id?: string
          notification_preferences?: Json
          teacher_id: string
          updated_at?: string
        }
        Update: {
          app_language?: string
          appearance?: string
          calendar_preferences?: Json
          created_at?: string
          dashboard_preferences?: Json
          id?: string
          notification_preferences?: Json
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_preferences_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_student_notes: {
        Row: {
          attachment_label: string
          author_id: string
          created_at: string
          id: string
          note_type: string
          pinned: boolean
          student_id: string | null
          target_id: string | null
          target_type: string
          teacher_id: string
          text: string
          updated_at: string
          visible_to_admin: boolean
        }
        Insert: {
          attachment_label?: string
          author_id: string
          created_at?: string
          id?: string
          note_type?: string
          pinned?: boolean
          student_id?: string | null
          target_id?: string | null
          target_type?: string
          teacher_id: string
          text: string
          updated_at?: string
          visible_to_admin?: boolean
        }
        Update: {
          attachment_label?: string
          author_id?: string
          created_at?: string
          id?: string
          note_type?: string
          pinned?: boolean
          student_id?: string | null
          target_id?: string | null
          target_type?: string
          teacher_id?: string
          text?: string
          updated_at?: string
          visible_to_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_students: {
        Row: {
          created_at: string
          id: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          admin_note: string | null
          avatar_url: string | null
          created_at: string
          description: string | null
          email: string
          first_name: string
          id: string
          invite_email_sent_at: string | null
          last_login_at: string | null
          last_name: string
          levels: string[]
          phone: string | null
          status: string
          teacher_user_id: string | null
          teaching_languages: string[]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          email: string
          first_name: string
          id?: string
          invite_email_sent_at?: string | null
          last_login_at?: string | null
          last_name?: string
          levels?: string[]
          phone?: string | null
          status?: string
          teacher_user_id?: string | null
          teaching_languages?: string[]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          email?: string
          first_name?: string
          id?: string
          invite_email_sent_at?: string | null
          last_login_at?: string | null
          last_name?: string
          levels?: string[]
          phone?: string | null
          status?: string
          teacher_user_id?: string | null
          teaching_languages?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_teacher_user_id_fkey"
            columns: ["teacher_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          student_id: string
          token_hash: string
          used_at: string | null
          used_by_parent_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          revoked_at?: string | null
          student_id: string
          token_hash: string
          used_at?: string | null
          used_by_parent_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          student_id?: string
          token_hash?: string
          used_at?: string | null
          used_by_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_link_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_link_tokens_used_by_parent_id_fkey"
            columns: ["used_by_parent_id"]
            isOneToOne: false
            referencedRelation: "telegram_parent_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notifications: {
        Row: {
          attempts: number
          canceled_at: string | null
          created_at: string
          error: string | null
          event_key: string
          id: string
          notification_type: string
          parent_id: string | null
          payload: Json
          processing_started_at: string | null
          provider: string
          recipient_label: string | null
          recipient_type: string
          scheduled_for: string
          sent_at: string | null
          skipped_reason: string | null
          status: string
          student_id: string | null
          trial_booking_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          canceled_at?: string | null
          created_at?: string
          error?: string | null
          event_key: string
          id?: string
          notification_type: string
          parent_id?: string | null
          payload?: Json
          processing_started_at?: string | null
          provider?: string
          recipient_label?: string | null
          recipient_type?: string
          scheduled_for?: string
          sent_at?: string | null
          skipped_reason?: string | null
          status?: string
          student_id?: string | null
          trial_booking_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          canceled_at?: string | null
          created_at?: string
          error?: string | null
          event_key?: string
          id?: string
          notification_type?: string
          parent_id?: string | null
          payload?: Json
          processing_started_at?: string | null
          provider?: string
          recipient_label?: string | null
          recipient_type?: string
          scheduled_for?: string
          sent_at?: string | null
          skipped_reason?: string | null
          status?: string
          student_id?: string | null
          trial_booking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "telegram_parent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_notifications_trial_booking_id_fkey"
            columns: ["trial_booking_id"]
            isOneToOne: false
            referencedRelation: "trial_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_parent_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          language: string
          last_name: string | null
          linked_at: string | null
          notify_billing: boolean
          notify_grades: boolean
          notify_homework: boolean
          notify_lesson_reminders: boolean
          notify_schedule_changes: boolean
          notify_trials: boolean
          notify_weekly: boolean
          parent_name: string | null
          sendpulse_contact_id: string | null
          telegram_chat_id: string | null
          telegram_user_id: string | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          language?: string
          last_name?: string | null
          linked_at?: string | null
          notify_billing?: boolean
          notify_grades?: boolean
          notify_homework?: boolean
          notify_lesson_reminders?: boolean
          notify_schedule_changes?: boolean
          notify_trials?: boolean
          notify_weekly?: boolean
          parent_name?: string | null
          sendpulse_contact_id?: string | null
          telegram_chat_id?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          language?: string
          last_name?: string | null
          linked_at?: string | null
          notify_billing?: boolean
          notify_grades?: boolean
          notify_homework?: boolean
          notify_lesson_reminders?: boolean
          notify_schedule_changes?: boolean
          notify_trials?: boolean
          notify_weekly?: boolean
          parent_name?: string | null
          sendpulse_contact_id?: string | null
          telegram_chat_id?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactional_emails: {
        Row: {
          created_at: string | null
          error: string | null
          event_key: string | null
          event_type: string | null
          event_version: number | null
          html: string | null
          id: string
          language: string | null
          notification_log_id: string | null
          provider: string | null
          provider_message_id: string | null
          provider_response: Json | null
          recipient_email: string | null
          recipient_name: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_variables: Json | null
          text: string | null
          trial_request_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_key?: string | null
          event_type?: string | null
          event_version?: number | null
          html?: string | null
          id?: string
          language?: string | null
          notification_log_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_variables?: Json | null
          text?: string | null
          trial_request_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_key?: string | null
          event_type?: string | null
          event_version?: number | null
          html?: string | null
          id?: string
          language?: string | null
          notification_log_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_variables?: Json | null
          text?: string | null
          trial_request_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactional_emails_notification_log_id_fkey"
            columns: ["notification_log_id"]
            isOneToOne: false
            referencedRelation: "notification_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactional_emails_trial_request_id_fkey"
            columns: ["trial_request_id"]
            isOneToOne: false
            referencedRelation: "trial_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_booking_rate_limits: {
        Row: {
          attempts: number
          created_at: string
          ip_hash: string
          updated_at: string
          window_start: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          ip_hash: string
          updated_at?: string
          window_start: string
        }
        Update: {
          attempts?: number
          created_at?: string
          ip_hash?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      trial_bookings: {
        Row: {
          assessment_score: number
          child_age: number
          child_name: string
          created_at: string
          english_experience: string
          guardian_confirmed_at: string
          id: string
          idempotency_key: string | null
          internal_notes: string | null
          lesson_url: string | null
          marketing_consent_at: string | null
          meeting_url: string | null
          parent_email: string
          parent_name: string
          parent_notes: string | null
          parent_phone: string | null
          preferred_language: string
          preliminary_recommendation: string
          privacy_accepted_at: string
          school_grade: string
          selected_date: string
          selected_time: string
          status: Database["public"]["Enums"]["trial_booking_status"]
          teacher_confirmed_direction: string | null
          teacher_confirmed_level: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          assessment_score: number
          child_age: number
          child_name: string
          created_at?: string
          english_experience: string
          guardian_confirmed_at: string
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          lesson_url?: string | null
          marketing_consent_at?: string | null
          meeting_url?: string | null
          parent_email: string
          parent_name: string
          parent_notes?: string | null
          parent_phone?: string | null
          preferred_language: string
          preliminary_recommendation: string
          privacy_accepted_at: string
          school_grade: string
          selected_date: string
          selected_time: string
          status?: Database["public"]["Enums"]["trial_booking_status"]
          teacher_confirmed_direction?: string | null
          teacher_confirmed_level?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          assessment_score?: number
          child_age?: number
          child_name?: string
          created_at?: string
          english_experience?: string
          guardian_confirmed_at?: string
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          lesson_url?: string | null
          marketing_consent_at?: string | null
          meeting_url?: string | null
          parent_email?: string
          parent_name?: string
          parent_notes?: string | null
          parent_phone?: string | null
          preferred_language?: string
          preliminary_recommendation?: string
          privacy_accepted_at?: string
          school_grade?: string
          selected_date?: string
          selected_time?: string
          status?: Database["public"]["Enums"]["trial_booking_status"]
          teacher_confirmed_direction?: string | null
          teacher_confirmed_level?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          title: string
          unit_number: number
          updated_at: string
          workbook_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          unit_number?: number
          updated_at?: string
          workbook_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          unit_number?: number
          updated_at?: string
          workbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workbook_assignments: {
        Row: {
          assignee_type: string
          created_at: string
          group_id: string | null
          id: string
          user_id: string | null
          workbook_id: string
        }
        Insert: {
          assignee_type: string
          created_at?: string
          group_id?: string | null
          id?: string
          user_id?: string | null
          workbook_id: string
        }
        Update: {
          assignee_type?: string
          created_at?: string
          group_id?: string | null
          id?: string
          user_id?: string | null
          workbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workbook_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workbook_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workbook_assignments_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      workbooks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          level: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          level?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          level?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      teacher_student_progress: {
        Row: {
          attendance_rate: number | null
          attendance_records: number | null
          attended_lessons: number | null
          completed_lessons: number | null
          course_progress: number | null
          homework_completion_rate: number | null
          homework_submitted: number | null
          homework_total: number | null
          student_email: string | null
          student_id: string | null
          student_name: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_subscription_lessons_remaining: {
        Args: {
          p_idempotency_key: string
          p_new_lessons_remaining: number
          p_reason: string
          p_user_id: string
        }
        Returns: {
          audit_id: string
          delta: number
          inserted: boolean
          new_lessons_remaining: number
          previous_lessons_remaining: number
        }[]
      }
      apply_stripe_checkout_completed: {
        Args: {
          p_amount_total: number
          p_checkout_session_id: string
          p_currency: string
          p_current_period_end: string
          p_current_period_start: string
          p_customer_email: string
          p_lesson_format: string
          p_lessons_total: number
          p_next_payment_date: string
          p_plan_id: string
          p_stripe_customer_id: string
          p_stripe_event_id: string
          p_stripe_price_id: string
          p_stripe_subscription_id: string
          p_subscription_status: string
          p_user_id: string
        }
        Returns: {
          lessons_remaining: number
          payment_inserted: boolean
        }[]
      }
      apply_stripe_invoice_payment_failed: {
        Args: {
          p_amount_due: number
          p_currency: string
          p_failure_reason: string
          p_next_payment_date: string
          p_payment_failed_at: string
          p_stripe_customer_id: string
          p_stripe_event_id: string
          p_stripe_invoice_id: string
          p_stripe_subscription_id: string
          p_subscription_status: string
          p_user_id: string
        }
        Returns: {
          failure_inserted: boolean
          lessons_remaining: number
        }[]
      }
      apply_stripe_subscription_payment: {
        Args: {
          p_amount_total: number
          p_checkout_session_id: string
          p_currency: string
          p_current_period_end: string
          p_current_period_start: string
          p_customer_email: string
          p_event_type: string
          p_lesson_format: string
          p_lessons_total: number
          p_next_payment_date: string
          p_plan_id: string
          p_stripe_customer_id: string
          p_stripe_event_id: string
          p_stripe_invoice_id: string
          p_stripe_price_id: string
          p_stripe_subscription_id: string
          p_subscription_status: string
          p_user_id: string
        }
        Returns: {
          lessons_remaining: number
          payment_inserted: boolean
        }[]
      }
      apply_stripe_subscription_state: {
        Args: {
          p_cancel_at_period_end: boolean
          p_canceled_at: string
          p_current_period_end: string
          p_current_period_start: string
          p_lesson_format: string
          p_next_payment_date: string
          p_plan_id: string
          p_stripe_customer_id: string
          p_stripe_price_id: string
          p_stripe_subscription_id: string
          p_subscription_status: string
          p_user_id: string
        }
        Returns: {
          lessons_remaining: number
        }[]
      }
      avatar_cost: { Args: { _avatar_id: string }; Returns: number }
      cleanup_lesson_block_content_items: { Args: never; Returns: undefined }
      clear_star_celebration: { Args: never; Returns: undefined }
      complete_assigned_interactive_content: {
        Args: {
          _content_item_id: string
          _errors_count?: number
          _lesson_id: string
          _score_percent?: number
          _star_rating?: number
        }
        Returns: {
          already_completed: boolean
          stars_awarded: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      disconnect_telegram_parent: {
        Args: { _parent_id: string; _student_id: string }
        Returns: boolean
      }
      email_otp_is_expired: {
        Args: { _email: string; _ttl_seconds?: number }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      equip_avatar: { Args: { _avatar_id: string }; Returns: undefined }
      get_interactive_tasks_for_lesson: {
        Args: { _lesson_id: string }
        Returns: {
          created_at: string
          id: string
          lesson_id: string
          mechanic_type: string
          order: number
          payload_json: Json
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "interactive_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_student_content_items: {
        Args: { _user_id: string }
        Returns: {
          checked_at: string | null
          created_at: string
          due_date: string | null
          emoji: string
          errors_count: number | null
          external_link: string | null
          file_name: string | null
          file_url: string | null
          homework_status: string
          id: string
          interactive_attempts: number
          interactive_completed_at: string | null
          interactive_lesson_id: string | null
          interactive_score_percent: number | null
          material_mode: string
          module_id: string
          result_percent: number | null
          review_comment: string | null
          reviewed_by_teacher_id: string | null
          rewarded_stars: number
          scheduled_date: string | null
          scheduled_time: string | null
          star_rating: number | null
          student_result: string | null
          submitted_at: string | null
          submitted_attachment_name: string | null
          submitted_attachment_url: string | null
          teacher_comment: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          unlocked: boolean
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "content_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_visible_live_sessions: {
        Args: never
        Returns: {
          completed_at: string
          current_task_id: string
          current_task_index: number
          id: string
          last_seen_at: string
          lesson_id: string
          lesson_title: string
          started_at: string
          status: string
          student_email: string
          student_id: string
          student_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_current_teacher_by_email: { Args: never; Returns: string }
      link_telegram_parent: {
        Args: {
          p_chat_id: string
          p_first_name: string
          p_last_name: string
          p_telegram_user_id: string
          p_token_hash: string
          p_username: string
        }
        Returns: {
          parent_id: string
          status: string
          student_id: string
          student_name: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purchase_avatar: { Args: { _avatar_id: string }; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      repair_stripe_profile_sync: {
        Args: { p_user_id: string }
        Returns: {
          lessons_remaining: number
          lessons_total: number
          subscription_status: string
        }[]
      }
      repair_student_interactive_completion: {
        Args: { _user_id: string }
        Returns: undefined
      }
      submit_student_homework: {
        Args: {
          _attachment_name: string
          _attachment_url: string
          _content_item_id: string
        }
        Returns: undefined
      }
      teacher_global_search: {
        Args: { _query: string }
        Returns: {
          category: string
          metadata: Json
          result_id: string
          subtitle: string
          title: string
        }[]
      }
      teacher_review_homework: {
        Args: {
          _homework_id: string
          _result_percent: number
          _star_rating: number
          _status: string
          _teacher_comment: string
          _teacher_id: string
        }
        Returns: undefined
      }
      teacher_start_lesson: { Args: { _lesson_id: string }; Returns: undefined }
    }
    Enums: {
      access_status: "pending" | "active" | "suspended" | "cancelled"
      app_role: "admin" | "student" | "teacher"
      content_type:
        | "lesson"
        | "homework"
        | "practice"
        | "grammar"
        | "listening"
        | "checkpoint"
      lesson_kind:
        | "theory"
        | "class_task"
        | "homework"
        | "practice"
        | "checkpoint"
      payment_status:
        | "unpaid"
        | "pending_review"
        | "paid"
        | "refunded"
        | "failed"
      trial_booking_status:
        | "submitted"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
        | "converted"
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
      access_status: ["pending", "active", "suspended", "cancelled"],
      app_role: ["admin", "student", "teacher"],
      content_type: [
        "lesson",
        "homework",
        "practice",
        "grammar",
        "listening",
        "checkpoint",
      ],
      lesson_kind: [
        "theory",
        "class_task",
        "homework",
        "practice",
        "checkpoint",
      ],
      payment_status: [
        "unpaid",
        "pending_review",
        "paid",
        "refunded",
        "failed",
      ],
      trial_booking_status: [
        "submitted",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
        "converted",
      ],
    },
  },
} as const
