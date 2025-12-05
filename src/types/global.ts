// ============================================
// GLOBAL TYPES
// Shared types used across the application
// ============================================

// User plans (from context.md Section 2)
export type UserPlan = 'freemium' | 'premium' | 'premium+';

// Quiz types (from context.md Section 3)
export type QuizType = 'db' | 'ai-predefined' | 'ai-prompt-free';

// Quiz universes (from context.md Section 4)
export type QuizUniverse = 'anime' | 'manga' | 'comics' | 'games' | 'movies' | 'series' | 'other';

// Quiz difficulty (from context.md Section 4)
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

// Quiz modes (from context.md Section 6)
export type QuizMode = 'step-by-step' | 'all-in-one' | 'infinite';

// Question structure (from context.md Section 4)
export interface Question {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  difficulty: QuizDifficulty;
  universe: QuizUniverse;
  type: 'predefined' | 'prompt-free';
  createdBy: 'ia' | 'admin';
  createdAt: string;
}

// Basic user profile
export interface UserProfile {
  id: string;
  email: string;
  pseudo: string;
  avatar?: string;
  plan: UserPlan;
  points: number;
  streak: number;
  createdAt: string;
}

// Environment variables (for type safety)
export interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_APP_URL: string;
  readonly NODE_ENV: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
