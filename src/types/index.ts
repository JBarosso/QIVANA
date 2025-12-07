// ============================================
// QIVANA - TYPES TYPESCRIPT
// ============================================

import type { AstroGlobal } from 'astro';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// ============================================
// QUIZ TYPES
// ============================================

export type Universe = 'anime' | 'manga' | 'comics' | 'games' | 'movies' | 'series' | 'other';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizMode = 'step-by-step' | 'all-in-one' | 'infinite';
export type QuizType = 'db' | 'ai-predefined' | 'ai-custom-quiz';

// ============================================
// QUESTION TYPES
// ============================================

export interface Question {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  difficulty: Difficulty;
  universe: Universe;
  type?: 'predefined' | 'custom-quiz';
  created_by?: string;
  created_at?: string;
  is_approved?: boolean;
}

// Question temporaire (pour les quiz customs, avant stockage DB)
export interface TempQuestion {
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

// ============================================
// ANSWER TYPES
// ============================================

// Les réponses sont stockées comme un tableau d'index (0, 1, 2, 3) ou null si pas répondu
export type Answer = number | null;
export type Answers = Answer[];

// ============================================
// SESSION TYPES
// ============================================

export interface QuizSession {
  id: string;
  user_id: string;
  quiz_type: QuizType;
  quiz_mode: QuizMode;
  universe: Universe;
  difficulty: Difficulty;
  questions_ids: string[];
  answers: Answers;
  score: number;
  max_score: number;
  started_at: string;
  completed_at: string | null;
  timer_seconds?: number | null; // Timer en secondes (optionnel pour compatibilité)
  temp_questions?: TempQuestion[]; // Questions temporaires pour mode quiz custom (non stockées en DB)
}

// ============================================
// USER & PROFILE TYPES
// ============================================

export type UserPlan = 'freemium' | 'premium' | 'premium+';

export interface Profile {
  id: string;
  pseudo: string;
  avatar: string | null;
  plan: UserPlan;
  points: number;
  ai_quizzes_used_this_month: number;
  ai_quota_reset_date: string;
  created_at: string;
  updated_at: string;
}

// Réexporter le type User de Supabase pour faciliter les imports
export type { User };

// ============================================
// AI TYPES
// ============================================

export interface AIQuestion {
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

export interface AIQuizResponse {
  questions: AIQuestion[];
}

export interface AIQuizRequest {
  universe: Universe;
  difficulty: Difficulty;
  numQuestions: number;
  customPrompt?: string;
}

// ============================================
// ASTRO TYPES
// ============================================

// Type pour Astro.locals (enrichi avec Supabase)
// Note: Les types Astro.locals sont maintenant définis dans src/env.d.ts
// Cette interface est gardée pour référence mais n'est plus utilisée
export interface AstroLocals {
  supabase: SupabaseClient;
  user?: User | null;
}

// Type pour la fonction requireAuth
export interface AuthResult {
  user: User;
  profile: Profile;
}

// Type helper pour Astro context
// Utiliser le type AstroGlobal directement avec un cast si nécessaire
export type AstroContext = AstroGlobal<any>;
