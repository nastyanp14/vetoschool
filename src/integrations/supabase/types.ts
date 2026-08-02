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
          created_at: string
          due_date: string | null
          emoji: string
          external_link: string | null
          file_name: string | null
          file_url: string | null
          id: string
          module_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          star_rating: number | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          unlocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          emoji?: string
          external_link?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          module_id: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          star_rating?: number | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          unlocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          emoji?: string
          external_link?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          module_id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          star_rating?: number | null
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          unlocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dictionary_words: {
        Row: {
          category: string
          created_at: string
          emoji: string
          id: string
          lesson: string
          audio_url: string | null
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
          lesson?: string
          translation?: string
          user_id?: string
          word?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          category: string
          comment: string | null
          content_id: string | null
          created_at: string
          id: string
          max_score: number
          score: number
          user_id: string
        }
        Insert: {
          category: string
          comment?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          max_score?: number
          score: number
          user_id: string
        }
        Update: {
          category?: string
          comment?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          max_score?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
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
      lessons: {
        Row: {
          created_at: string
          id: string
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
      profiles: {
        Row: {
          access_status: Database["public"]["Enums"]["access_status"]
          age: string | null
          avatar_id: string | null
          course: string | null
          created_at: string
          email: string
          has_access: boolean
          id: string
          level: string | null
          name: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_failed_at: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          pending_celebration: number
          current_period_end: string | null
          current_period_start: string | null
          lesson_format: string | null
          lessons_remaining: number
          lessons_total: number
          next_payment_date: string | null
          plan_id: string | null
          star_balance: number
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          student_status: string
          subscription_status: string | null
          total_stars_earned: number
          updated_at: string
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["access_status"]
          age?: string | null
          avatar_id?: string | null
          course?: string | null
          created_at?: string
          email: string
          has_access?: boolean
          id: string
          level?: string | null
          name?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_failed_at?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          pending_celebration?: number
          current_period_end?: string | null
          current_period_start?: string | null
          lesson_format?: string | null
          lessons_remaining?: number
          lessons_total?: number
          next_payment_date?: string | null
          plan_id?: string | null
          star_balance?: number
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          student_status?: string
          subscription_status?: string | null
          total_stars_earned?: number
          updated_at?: string
        }
        Update: {
          access_status?: Database["public"]["Enums"]["access_status"]
          age?: string | null
          avatar_id?: string | null
          course?: string | null
          created_at?: string
          email?: string
          has_access?: boolean
          id?: string
          level?: string | null
          name?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_failed_at?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          pending_celebration?: number
          current_period_end?: string | null
          current_period_start?: string | null
          lesson_format?: string | null
          lessons_remaining?: number
          lessons_total?: number
          next_payment_date?: string | null
          plan_id?: string | null
          star_balance?: number
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          student_status?: string
          subscription_status?: string | null
          total_stars_earned?: number
          updated_at?: string
        }
        Relationships: []
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
          stripe_customer_id: string
          stripe_event_id: string
          stripe_charge_id: string | null
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
          stripe_customer_id: string
          stripe_event_id: string
          stripe_charge_id?: string | null
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
          stripe_customer_id?: string
          stripe_event_id?: string
          stripe_charge_id?: string | null
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
      schedules: {
        Row: {
          comment: string | null
          created_at: string
          day: string
          duration_minutes: number | null
          group_id: string | null
          id: string
          is_conducted: boolean
          lesson_number: string | null
          lesson_status: string
          lesson_type: string
          online_url: string | null
          position: number
          rescheduled_from: string | null
          room: string | null
          scheduled_date: string | null
          teacher_id: string | null
          time: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          day: string
          duration_minutes?: number | null
          group_id?: string | null
          id?: string
          is_conducted?: boolean
          lesson_number?: string | null
          lesson_status?: string
          lesson_type?: string
          online_url?: string | null
          position?: number
          rescheduled_from?: string | null
          room?: string | null
          scheduled_date?: string | null
          teacher_id?: string | null
          time: string
          topic?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          day?: string
          duration_minutes?: number | null
          group_id?: string | null
          id?: string
          is_conducted?: boolean
          lesson_number?: string | null
          lesson_status?: string
          lesson_type?: string
          online_url?: string | null
          position?: number
          rescheduled_from?: string | null
          room?: string | null
          scheduled_date?: string | null
          teacher_id?: string | null
          time?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
      student_groups: {
        Row: {
          age_range: string | null
          course: string | null
          created_at: string
          current_lesson: string | null
          current_unit: string | null
          description: string | null
          id: string
          lesson_duration_minutes: number | null
          level: string | null
          max_seats: number | null
          name: string
          progress: number
          start_date: string | null
          status: string
          teacher_id: string | null
          updated_at: string
          weekly_frequency: number | null
        }
        Insert: {
          age_range?: string | null
          course?: string | null
          created_at?: string
          current_lesson?: string | null
          current_unit?: string | null
          description?: string | null
          id?: string
          lesson_duration_minutes?: number | null
          level?: string | null
          max_seats?: number | null
          name: string
          progress?: number
          start_date?: string | null
          status?: string
          teacher_id?: string | null
          updated_at?: string
          weekly_frequency?: number | null
        }
        Update: {
          age_range?: string | null
          course?: string | null
          created_at?: string
          current_lesson?: string | null
          current_unit?: string | null
          description?: string | null
          id?: string
          lesson_duration_minutes?: number | null
          level?: string | null
          max_seats?: number | null
          name?: string
          progress?: number
          start_date?: string | null
          status?: string
          teacher_id?: string | null
          updated_at?: string
          weekly_frequency?: number | null
        }
        Relationships: []
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
        Relationships: []
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
      [_ in never]: never
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
      apply_stripe_invoice_payment_failed: {
        Args: {
          p_amount_due: number | null
          p_currency: string | null
          p_failure_reason: string | null
          p_next_payment_date: string | null
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
      apply_stripe_checkout_completed: {
        Args: {
          p_amount_total: number | null
          p_checkout_session_id: string
          p_currency: string | null
          p_current_period_end: string | null
          p_current_period_start: string | null
          p_customer_email: string | null
          p_lesson_format: string
          p_lessons_total: number
          p_next_payment_date: string | null
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
      apply_stripe_subscription_payment: {
        Args: {
          p_amount_total: number | null
          p_checkout_session_id: string | null
          p_currency: string | null
          p_current_period_end: string | null
          p_current_period_start: string | null
          p_customer_email: string | null
          p_event_type: string
          p_lesson_format: string
          p_lessons_total: number
          p_next_payment_date: string | null
          p_plan_id: string
          p_stripe_customer_id: string
          p_stripe_event_id: string
          p_stripe_invoice_id: string | null
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
          p_canceled_at: string | null
          p_current_period_end: string | null
          p_current_period_start: string | null
          p_lesson_format: string | null
          p_next_payment_date: string | null
          p_plan_id: string | null
          p_stripe_customer_id: string
          p_stripe_price_id: string | null
          p_stripe_subscription_id: string
          p_subscription_status: string
          p_user_id: string
        }
        Returns: {
          lessons_remaining: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      access_status: "pending" | "active" | "suspended" | "cancelled"
      app_role: "admin" | "teacher" | "student"
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
      payment_status: "unpaid" | "pending_review" | "paid" | "refunded" | "failed"
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
      app_role: ["admin", "student"],
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
    },
  },
} as const
