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
          translation: string
          user_id: string
          word: string
        }
        Insert: {
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
      profiles: {
        Row: {
          avatar_id: string | null
          created_at: string
          email: string
          has_access: boolean
          id: string
          name: string
          pending_celebration: number
          star_balance: number
          total_stars_earned: number
        }
        Insert: {
          avatar_id?: string | null
          created_at?: string
          email: string
          has_access?: boolean
          id: string
          name?: string
          pending_celebration?: number
          star_balance?: number
          total_stars_earned?: number
        }
        Update: {
          avatar_id?: string | null
          created_at?: string
          email?: string
          has_access?: boolean
          id?: string
          name?: string
          pending_celebration?: number
          star_balance?: number
          total_stars_earned?: number
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          day: string
          id: string
          is_conducted: boolean
          position: number
          time: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          is_conducted?: boolean
          position?: number
          time: string
          topic?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          is_conducted?: boolean
          position?: number
          time?: string
          topic?: string
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
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
