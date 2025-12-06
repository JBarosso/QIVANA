import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type Universe = 'anime' | 'manga' | 'comics' | 'games' | 'movies' | 'series' | 'other';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizMode = 'db' | 'ai' | 'prompt-free';

export interface Question {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  difficulty: Difficulty;
  universe: Universe;
  type: 'predefined' | 'prompt-free';
  created_by: 'ia' | 'admin';
  created_at: string;
}

export interface QuizSession {
  id: string;
  user_id: string;
  quiz_type: 'db' | 'ai-predefined' | 'ai-custom-quiz';
  quiz_mode: 'step-by-step' | 'all-in-one';
  universe: Universe;
  difficulty: Difficulty;
  questions_ids: string[];
  answers: any; // jsonb in DB
  score: number;
  max_score: number;
  started_at: string;
  completed_at: string | null;
  temp_questions?: any; // JSONB - Questions temporaires pour mode quiz custom (non stockées en DB)
}

export interface QuizAnswer {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  timeRemaining: number;
  pointsEarned: number;
}

/**
 * Récupère des questions aléatoires depuis la DB
 * @param supabase - Client Supabase
 * @param universe - Univers sélectionné
 * @param difficulty - Difficulté sélectionnée
 * @param limit - Nombre de questions (défaut: 10)
 * @param excludeIds - IDs de questions à exclure (duplicate prevention)
 * @returns Array de questions
 */
export async function fetchRandomQuestions(
  supabase: SupabaseClient<Database>,
  universe: Universe,
  difficulty: Difficulty,
  limit: number = 10,
  excludeIds: string[] = []
): Promise<Question[]> {
  // Fetch all questions matching criteria
  const { data: allQuestions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('universe', universe)
    .eq('difficulty', difficulty)
    .eq('type', 'predefined');

  if (error) {
    console.error('Error fetching questions:', error);
    throw new Error('Impossible de charger les questions');
  }

  if (!allQuestions || allQuestions.length === 0) {
    throw new Error('Aucune question disponible pour ces critères');
  }

  // Filter out seen questions (client-side filtering)
  const availableQuestions = allQuestions.filter(
    (q) => !excludeIds.includes(q.id)
  );

  if (availableQuestions.length === 0) {
    throw new Error('Toutes les questions ont déjà été vues. Réinitialisation nécessaire.');
  }

  // Shuffle and limit
  const shuffled = shuffleArray(availableQuestions) as Question[];
  return shuffled.slice(0, limit);
}

/**
 * Crée une nouvelle session de quiz
 */
export async function createQuizSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode: QuizMode,
  universe: Universe,
  difficulty: Difficulty,
  questionIds: string[]
): Promise<string> {
  // Calculer le score maximum basé sur le nombre de questions
  // Points de base (10) + bonus temps max (10) = 20 points par question
  const maxScore = questionIds.length * 10;

  const { data, error } = await supabase
    .from('quiz_sessions')
    .insert({
      user_id: userId,
      quiz_type: 'db', // db, ia, prompt-free
      quiz_mode: mode === 'db' ? 'step-by-step' : 'step-by-step', // step-by-step or all-in-one
      universe,
      difficulty,
      questions_ids: questionIds,
      answers: [],
      score: 0,
      max_score: maxScore,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating quiz session:', error);
    throw new Error('Impossible de créer la session de quiz');
  }

  return data.id;
}

/**
 * Met à jour une session de quiz avec une réponse
 */
export async function updateQuizAnswer(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  questionIndex: number,
  answer: number,
  pointsEarned: number
): Promise<void> {
  // Récupérer la session actuelle
  const { data: session, error: fetchError } = await supabase
    .from('quiz_sessions')
    .select('answers, score')
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    throw new Error('Session introuvable');
  }

  // Mettre à jour answers et score
  const currentAnswers = Array.isArray(session.answers) ? session.answers : [];
  const newAnswers = [...currentAnswers];
  newAnswers[questionIndex] = answer;

  // Arrondir le score pour éviter les erreurs de type integer
  const roundedScore = Math.round(session.score + pointsEarned);

  const { error: updateError } = await supabase
    .from('quiz_sessions')
    .update({
      answers: newAnswers,
      score: roundedScore,
    })
    .eq('id', sessionId);

  if (updateError) {
    console.error('Supabase UPDATE error:', updateError);
    throw new Error('Impossible de sauvegarder la réponse');
  }
}

/**
 * Termine une session de quiz et ajoute les points au profil
 */
export async function completeQuizSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<void> {
  // Récupérer la session pour obtenir le score et l'user_id
  const { data: session, error: fetchError } = await supabase
    .from('quiz_sessions')
    .select('score, user_id')
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    throw new Error('Session introuvable');
  }

  // Marquer la session comme complétée
  const { error: updateError } = await supabase
    .from('quiz_sessions')
    .update({
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (updateError) {
    throw new Error('Impossible de terminer la session');
  }

  // Récupérer les points actuels du profil
  const { data: profile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', session.user_id)
    .single();

  if (profileFetchError || !profile) {
    console.error('Error fetching profile:', profileFetchError);
    return; // Ne pas bloquer si le profil n'existe pas
  }

  // Ajouter les points du quiz au profil
  const newPoints = (profile.points || 0) + session.score;

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      points: newPoints,
    })
    .eq('id', session.user_id);

  if (profileUpdateError) {
    console.error('Error updating profile points:', profileUpdateError);
    // Ne pas bloquer si l'ajout de points échoue
  }
}

/**
 * Récupère une session de quiz
 */
export async function getQuizSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<QuizSession | null> {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching quiz session:', error);
    return null;
  }

  return data as QuizSession;
}

/**
 * Calcule le score pour une question
 * @param isCorrect - La réponse est-elle correcte
 * @param timeRemaining - Temps restant en secondes
 * @param totalTime - Temps total en secondes (défaut: 10s)
 * @returns Points gagnés (0-20 points)
 */
export function calculateScore(
  isCorrect: boolean,
  timeRemaining: number,
  totalTime: number = 10
): number {
  if (!isCorrect) return 0;
  
  // Base : 10 points pour une bonne réponse
  const basePoints = 10;
  
  // Bonus temps : jusqu'à 10 points supplémentaires selon la vitesse
  const timeBonus = (timeRemaining / totalTime) * 10;
  
  return basePoints + timeBonus;
}

/**
 * Récupère les IDs de questions déjà vues par l'utilisateur
 */
export async function getSeenQuestionIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  universe?: Universe,
  difficulty?: Difficulty
): Promise<string[]> {
  let query = supabase
    .from('quiz_sessions')
    .select('questions_ids')
    .eq('user_id', userId)
    .not('completed_at', 'is', null);

  if (universe) {
    query = query.eq('universe', universe);
  }
  
  if (difficulty) {
    query = query.eq('difficulty', difficulty);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  // Flatten all question IDs
  const allIds = data.flatMap((session) => session.questions_ids || []);
  
  // Return unique IDs
  return [...new Set(allIds)];
}

/**
 * Utility: Shuffle array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
