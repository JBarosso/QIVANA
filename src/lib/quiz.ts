import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import type {
  Universe,
  Difficulty,
  QuizMode,
  Question,
  QuizSession,
  TempQuestion,
  Answers,
} from '../types';

// Ré-exporter les types pour la compatibilité
export type { Universe, Difficulty, QuizMode, Question, QuizSession, TempQuestion, Answers };

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
  questionIds: string[],
  timerSeconds: number = 10
): Promise<string> {
  // Calculer le score maximum basé sur le nombre de questions
  // Points de base (10) + bonus temps max (10) = 20 points par question
  const maxScore = questionIds.length * 20;

  const { data, error } = await supabase
    .from('quiz_sessions')
    .insert({
      user_id: userId,
      quiz_type: 'db', // db, ai-predefined, ai-custom-quiz
      quiz_mode: mode, // step-by-step, all-in-one, infinite
      universe,
      difficulty,
      questions_ids: questionIds,
      answers: [],
      score: 0,
      max_score: maxScore,
      timer_seconds: timerSeconds,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error creating quiz session:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    console.error('❌ Session data attempted:', {
      user_id: userId,
      quiz_type: 'db',
      quiz_mode: mode,
      universe,
      difficulty,
      questions_count: questionIds.length,
      timer_seconds: timerSeconds,
    });
    throw new Error(`Impossible de créer la session de quiz: ${error.message || 'Erreur inconnue'}`);
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
  const currentAnswers: Answers = Array.isArray(session.answers) ? (session.answers as Answers) : [];
  const newAnswers: Answers = [...currentAnswers];
  newAnswers[questionIndex] = answer;

  // Arrondir le score pour éviter les erreurs de type integer
  const roundedScore = Math.round(session.score + pointsEarned);
  
  // ⚠️ SÉCURITÉ : S'assurer que le score ne dépasse pas max_score
  // Récupérer max_score pour validation
  const { data: sessionWithMax, error: maxScoreError } = await supabase
    .from('quiz_sessions')
    .select('max_score')
    .eq('id', sessionId)
    .single();
  
  if (maxScoreError || !sessionWithMax) {
    console.error('Error fetching max_score:', maxScoreError);
    throw new Error('Impossible de récupérer les informations de session');
  }
  
  // Clamper le score entre 0 et max_score pour respecter la contrainte
  const clampedScore = Math.max(0, Math.min(roundedScore, sessionWithMax.max_score || Infinity));
  
  if (clampedScore !== roundedScore) {
    console.warn(`⚠️ Score clampé: ${roundedScore} → ${clampedScore} (max_score: ${sessionWithMax.max_score})`);
  }

  const { error: updateError } = await supabase
    .from('quiz_sessions')
    .update({
      answers: newAnswers,
      score: clampedScore,
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
 * Récupère les 20-50 dernières questions vues par l'utilisateur dans un univers
 * Utilisé pour l'injection de contexte dans les prompts IA
 * @param supabase - Client Supabase
 * @param userId - ID de l'utilisateur
 * @param universe - Univers ciblé
 * @param limit - Nombre de questions à récupérer (défaut: 30)
 * @returns Array de textes de questions (pour injection dans prompt)
 */
export async function getRecentUserQuestions(
  supabase: SupabaseClient<Database>,
  userId: string,
  universe: Universe,
  limit: number = 30
): Promise<string[]> {
  // Récupérer les sessions complétées de cet univers, triées par date (plus récentes en premier)
  const { data: sessions, error } = await supabase
    .from('quiz_sessions')
    .select('questions_ids')
    .eq('user_id', userId)
    .eq('universe', universe)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(10); // Limiter à 10 sessions récentes pour éviter trop de données

  if (error || !sessions) {
    return [];
  }

  // Récupérer les IDs de questions des sessions récentes
  const questionIds: string[] = [];
  for (const session of sessions) {
    if (session.questions_ids && Array.isArray(session.questions_ids)) {
      questionIds.push(...session.questions_ids);
    }
  }

  // Limiter le nombre d'IDs
  const limitedIds = questionIds.slice(0, limit);

  if (limitedIds.length === 0) {
    return [];
  }

  // Récupérer les textes des questions depuis la DB
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('question')
    .in('id', limitedIds);

  if (questionsError || !questions) {
    return [];
  }

  // Retourner uniquement les textes des questions
  return questions.map((q) => q.question).filter((q): q is string => typeof q === 'string');
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

/**
 * Vérifie le stock de questions disponibles pour un utilisateur
 * @param supabase - Client Supabase
 * @param userId - ID de l'utilisateur
 * @param universe - Univers
 * @param difficulty - Difficulté
 * @param requestedCount - Nombre de questions demandées
 * @returns Nombre de questions disponibles (non vues par l'utilisateur)
 */
export async function checkQuestionStock(
  supabase: SupabaseClient<Database>,
  userId: string,
  universe: Universe,
  difficulty: Difficulty,
  requestedCount: number
): Promise<number> {
  // Récupérer les IDs déjà vus
  const seenIds = await getSeenQuestionIds(supabase, userId, universe, difficulty);

  // Récupérer toutes les questions disponibles
  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .eq('universe', universe)
    .eq('difficulty', difficulty)
    .eq('type', 'predefined');

  if (error) {
    console.error('Error checking question stock:', error);
    return 0;
  }

  if (!data) {
    return 0;
  }

  // Filtrer les questions déjà vues côté code
  const availableQuestions = seenIds.length > 0
    ? data.filter((q) => !seenIds.includes(q.id))
    : data;

  return availableQuestions.length;
}
