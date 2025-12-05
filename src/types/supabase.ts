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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          estimated_cost_cents: number | null
          id: string
          prompt: string | null
          questions_count: number
          quiz_type: string
          tokens_used: number | null
          universe: Database["public"]["Enums"]["quiz_universe"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_cents?: number | null
          id?: string
          prompt?: string | null
          questions_count: number
          quiz_type: string
          tokens_used?: number | null
          universe?: Database["public"]["Enums"]["quiz_universe"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_cents?: number | null
          id?: string
          prompt?: string | null
          questions_count?: number
          quiz_type?: string
          tokens_used?: number | null
          universe?: Database["public"]["Enums"]["quiz_universe"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_sessions: {
        Row: {
          chef_control_enabled: boolean
          chef_id: string
          completed_at: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          id: string
          is_public: boolean
          mode: Database["public"]["Enums"]["quiz_type"]
          participants: Json
          questions_count: number
          questions_ids: string[] | null
          salon_code: string
          salon_name: string
          started_at: string | null
          status: Database["public"]["Enums"]["duel_status"]
          timer_seconds: number | null
          universe: Database["public"]["Enums"]["quiz_universe"]
        }
        Insert: {
          chef_control_enabled?: boolean
          chef_id: string
          completed_at?: string | null
          created_at?: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          id?: string
          is_public?: boolean
          mode: Database["public"]["Enums"]["quiz_type"]
          participants?: Json
          questions_count: number
          questions_ids?: string[] | null
          salon_code: string
          salon_name: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          timer_seconds?: number | null
          universe: Database["public"]["Enums"]["quiz_universe"]
        }
        Update: {
          chef_control_enabled?: boolean
          chef_id?: string
          completed_at?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          id?: string
          is_public?: boolean
          mode?: Database["public"]["Enums"]["quiz_type"]
          participants?: Json
          questions_count?: number
          questions_ids?: string[] | null
          salon_code?: string
          salon_name?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          timer_seconds?: number | null
          universe?: Database["public"]["Enums"]["quiz_universe"]
        }
        Relationships: [
          {
            foreignKeyName: "duel_sessions_chef_id_fkey"
            columns: ["chef_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          question_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          additional_info: string | null
          created_at: string
          id: string
          question_id: string
          reason: string
          reported_by: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          additional_info?: string | null
          created_at?: string
          id?: string
          question_id: string
          reason: string
          reported_by: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          additional_info?: string | null
          created_at?: string
          id?: string
          question_id?: string
          reason?: string
          reported_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "flags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          plan: Database["public"]["Enums"]["user_plan"]
          status: string
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan: Database["public"]["Enums"]["user_plan"]
          status: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan?: Database["public"]["Enums"]["user_plan"]
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_quizzes_used_this_month: number
          ai_quota_reset_date: string
          avatar: string | null
          created_at: string
          id: string
          plan: Database["public"]["Enums"]["user_plan"]
          points: number
          pseudo: string
          updated_at: string
        }
        Insert: {
          ai_quizzes_used_this_month?: number
          ai_quota_reset_date?: string
          avatar?: string | null
          created_at?: string
          id: string
          plan?: Database["public"]["Enums"]["user_plan"]
          points?: number
          pseudo: string
          updated_at?: string
        }
        Update: {
          ai_quizzes_used_this_month?: number
          ai_quota_reset_date?: string
          avatar?: string | null
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["user_plan"]
          points?: number
          pseudo?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          choices: Json
          correct_index: number
          created_at: string
          created_by: Database["public"]["Enums"]["question_source"]
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          explanation: string
          id: string
          is_approved: boolean
          question: string
          reviewed_at: string | null
          reviewed_by: string | null
          type: string
          universe: Database["public"]["Enums"]["quiz_universe"]
        }
        Insert: {
          choices: Json
          correct_index: number
          created_at?: string
          created_by?: Database["public"]["Enums"]["question_source"]
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          explanation: string
          id?: string
          is_approved?: boolean
          question: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          type: string
          universe: Database["public"]["Enums"]["quiz_universe"]
        }
        Update: {
          choices?: Json
          correct_index?: number
          created_at?: string
          created_by?: Database["public"]["Enums"]["question_source"]
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          explanation?: string
          id?: string
          is_approved?: boolean
          question?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          type?: string
          universe?: Database["public"]["Enums"]["quiz_universe"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          answers: Json | null
          completed_at: string | null
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          id: string
          max_score: number
          questions_ids: string[]
          quiz_mode: Database["public"]["Enums"]["quiz_mode"]
          quiz_type: Database["public"]["Enums"]["quiz_type"]
          score: number
          started_at: string
          time_spent_seconds: number | null
          universe: Database["public"]["Enums"]["quiz_universe"]
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          id?: string
          max_score: number
          questions_ids: string[]
          quiz_mode: Database["public"]["Enums"]["quiz_mode"]
          quiz_type: Database["public"]["Enums"]["quiz_type"]
          score?: number
          started_at?: string
          time_spent_seconds?: number | null
          universe: Database["public"]["Enums"]["quiz_universe"]
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          id?: string
          max_score?: number
          questions_ids?: string[]
          quiz_mode?: Database["public"]["Enums"]["quiz_mode"]
          quiz_type?: Database["public"]["Enums"]["quiz_type"]
          score?: number
          started_at?: string
          time_spent_seconds?: number | null
          universe?: Database["public"]["Enums"]["quiz_universe"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      [_ in never]: never
    }
    Enums: {
      duel_status: "lobby" | "in-progress" | "completed" | "cancelled"
      question_source: "ia" | "admin"
      quiz_difficulty: "easy" | "medium" | "hard"
      quiz_mode: "step-by-step" | "all-in-one" | "infinite"
      quiz_type: "db" | "ai-predefined" | "ai-prompt-free"
      quiz_universe:
        | "anime"
        | "manga"
        | "comics"
        | "games"
        | "movies"
        | "series"
        | "other"
      user_plan: "freemium" | "premium" | "premium+"
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
      duel_status: ["lobby", "in-progress", "completed", "cancelled"],
      question_source: ["ia", "admin"],
      quiz_difficulty: ["easy", "medium", "hard"],
      quiz_mode: ["step-by-step", "all-in-one", "infinite"],
      quiz_type: ["db", "ai-predefined", "ai-prompt-free"],
      quiz_universe: [
        "anime",
        "manga",
        "comics",
        "games",
        "movies",
        "series",
        "other",
      ],
      user_plan: ["freemium", "premium", "premium+"],
    },
  },
} as const
