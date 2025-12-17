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
      avatars: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          image_url: string
          name: string
          rarity: string
          unlock_criteria: Json
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          image_url: string
          name: string
          rarity: string
          unlock_criteria?: Json
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name?: string
          rarity?: string
          unlock_criteria?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          code: string
          created_at: string
          criteria: Json
          description: string
          icon_url: string | null
          id: string
          name: string
          rarity: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          criteria?: Json
          description: string
          icon_url?: string | null
          id?: string
          name: string
          rarity?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          criteria?: Json
          description?: string
          icon_url?: string | null
          id?: string
          name?: string
          rarity?: string
          updated_at?: string
        }
        Relationships: []
      }
      duel_answers: {
        Row: {
          answered_at: string
          duel_session_id: string
          id: string
          is_correct: boolean
          points_earned: number
          question_id: string
          question_index: number
          selected_index: number
          time_remaining: number | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          duel_session_id: string
          id?: string
          is_correct: boolean
          points_earned?: number
          question_id: string
          question_index: number
          selected_index: number
          time_remaining?: number | null
          user_id: string
        }
        Update: {
          answered_at?: string
          duel_session_id?: string
          id?: string
          is_correct?: boolean
          points_earned?: number
          question_id?: string
          question_index?: number
          selected_index?: number
          time_remaining?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_answers_duel_session_id_fkey"
            columns: ["duel_session_id"]
            isOneToOne: false
            referencedRelation: "duel_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_results: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          players: Json
          room_id: string
          settings: Json
          winner_id: string | null
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          players: Json
          room_id: string
          settings: Json
          winner_id?: string | null
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          players?: Json
          room_id?: string
          settings?: Json
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duel_results_winner_id_fkey"
            columns: ["winner_id"]
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
          current_question_index: number | null
          custom_prompt: string | null
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          game_mode: Database["public"]["Enums"]["duel_game_mode"]
          id: string
          initial_lives: number | null
          is_public: boolean
          mode: Database["public"]["Enums"]["quiz_type"]
          participants: Json
          player_lives: Json | null
          questions_count: number
          questions_ids: string[] | null
          salon_code: string
          salon_name: string
          started_at: string | null
          status: Database["public"]["Enums"]["duel_status"]
          temp_questions: Json | null
          timer_seconds: number | null
          universe: Database["public"]["Enums"]["quiz_universe"]
          updated_at: string | null
        }
        Insert: {
          chef_control_enabled?: boolean
          chef_id: string
          completed_at?: string | null
          created_at?: string
          current_question_index?: number | null
          custom_prompt?: string | null
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          game_mode?: Database["public"]["Enums"]["duel_game_mode"]
          id?: string
          initial_lives?: number | null
          is_public?: boolean
          mode: Database["public"]["Enums"]["quiz_type"]
          participants?: Json
          player_lives?: Json | null
          questions_count: number
          questions_ids?: string[] | null
          salon_code: string
          salon_name: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          temp_questions?: Json | null
          timer_seconds?: number | null
          universe: Database["public"]["Enums"]["quiz_universe"]
          updated_at?: string | null
        }
        Update: {
          chef_control_enabled?: boolean
          chef_id?: string
          completed_at?: string | null
          created_at?: string
          current_question_index?: number | null
          custom_prompt?: string | null
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          game_mode?: Database["public"]["Enums"]["duel_game_mode"]
          id?: string
          initial_lives?: number | null
          is_public?: boolean
          mode?: Database["public"]["Enums"]["quiz_type"]
          participants?: Json
          player_lives?: Json | null
          questions_count?: number
          questions_ids?: string[] | null
          salon_code?: string
          salon_name?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          temp_questions?: Json | null
          timer_seconds?: number | null
          universe?: Database["public"]["Enums"]["quiz_universe"]
          updated_at?: string | null
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
      endless_scores: {
        Row: {
          created_at: string
          id: string
          lives_remaining: number
          max_difficulty: string
          questions_answered: number
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lives_remaining?: number
          max_difficulty: string
          questions_answered: number
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lives_remaining?: number
          max_difficulty?: string
          questions_answered?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "endless_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          duels_played: number | null
          duels_won: number | null
          id: string
          is_admin: boolean
          plan: Database["public"]["Enums"]["user_plan"]
          points: number
          pseudo: string
          selected_avatar_id: string | null
          slug: string | null
          subscription_end_date: string | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          ai_quizzes_used_this_month?: number
          ai_quota_reset_date?: string
          avatar?: string | null
          created_at?: string
          duels_played?: number | null
          duels_won?: number | null
          id: string
          is_admin?: boolean
          plan?: Database["public"]["Enums"]["user_plan"]
          points?: number
          pseudo: string
          selected_avatar_id?: string | null
          slug?: string | null
          subscription_end_date?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          ai_quizzes_used_this_month?: number
          ai_quota_reset_date?: string
          avatar?: string | null
          created_at?: string
          duels_played?: number | null
          duels_won?: number | null
          id?: string
          is_admin?: boolean
          plan?: Database["public"]["Enums"]["user_plan"]
          points?: number
          pseudo?: string
          selected_avatar_id?: string | null
          slug?: string | null
          subscription_end_date?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_selected_avatar_id_fkey"
            columns: ["selected_avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_examples: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          prompt: string
          source: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          prompt: string
          source?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          prompt?: string
          source?: string
          usage_count?: number
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
      quiz_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          prompt_used: string | null
          quiz_type: string
          rating: number
          session_id: string | null
          theme: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          prompt_used?: string | null
          quiz_type: string
          rating: number
          session_id?: string | null
          theme?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          prompt_used?: string | null
          quiz_type?: string
          rating?: number
          session_id?: string | null
          theme?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_ratings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_ratings_user_id_fkey"
            columns: ["user_id"]
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
          temp_questions: Json | null
          time_spent_seconds: number | null
          timer_seconds: number | null
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
          temp_questions?: Json | null
          time_spent_seconds?: number | null
          timer_seconds?: number | null
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
          temp_questions?: Json | null
          time_spent_seconds?: number | null
          timer_seconds?: number | null
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
      user_avatars: {
        Row: {
          avatar_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          avatar_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatars_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_question_history: {
        Row: {
          created_at: string
          id: string
          question_hash: string
          theme: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_hash: string
          theme?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_hash?: string
          theme?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      recent_duels: {
        Row: {
          completed_at: string | null
          difficulty: string | null
          id: string | null
          player_count: number | null
          room_id: string | null
          universe: string | null
          winner_pseudo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_and_unlock_avatars: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      check_and_unlock_badges: {
        Args: { p_user_id: string }
        Returns: {
          unlocked_badge_ids: string[]
        }[]
      }
      cleanup_old_question_history: { Args: never; Returns: undefined }
      generate_profile_slug: { Args: { p_pseudo: string }; Returns: string }
      get_duel_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          duels_played: number
          duels_won: number
          player_id: string
          pseudo: string
          rank: number
          total_score: number
          win_rate: number
        }[]
      }
      get_player_duel_stats: {
        Args: { player_id: string }
        Returns: {
          duels_played: number
          duels_won: number
          total_score: number
          win_rate: number
        }[]
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      match_questions: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          id: string
          question_id: string
          similarity: number
        }[]
      }
      update_daily_streak: {
        Args: { p_user_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
    }
    Enums: {
      duel_game_mode: "classic" | "deathmatch" | "battle_royal"
      duel_status: "lobby" | "in-progress" | "completed" | "cancelled"
      question_source: "ia" | "admin"
      quiz_difficulty: "easy" | "medium" | "hard"
      quiz_mode: "step-by-step" | "all-in-one" | "infinite"
      quiz_type: "db" | "ai-predefined" | "ai-custom-quiz"
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
      duel_game_mode: ["classic", "deathmatch", "battle_royal"],
      duel_status: ["lobby", "in-progress", "completed", "cancelled"],
      question_source: ["ia", "admin"],
      quiz_difficulty: ["easy", "medium", "hard"],
      quiz_mode: ["step-by-step", "all-in-one", "infinite"],
      quiz_type: ["db", "ai-predefined", "ai-custom-quiz"],
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
