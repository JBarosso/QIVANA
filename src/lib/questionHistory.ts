// ============================================
// QUESTION HISTORY - Éviter les doublons
// ============================================
// Gère l'historique des questions custom pour éviter les répétitions

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const MAX_HISTORY_SIZE = 50; // Nombre max de questions à garder par utilisateur

/**
 * Génère un hash simple d'une chaîne (pour détection de doublons)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Vérifie si une question existe déjà dans l'historique de l'utilisateur
 */
export async function isQuestionInHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  questionText: string
): Promise<boolean> {
  const hash = simpleHash(questionText.toLowerCase().trim());

  const { data, error } = await supabase
    .from('user_question_history')
    .select('id')
    .eq('user_id', userId)
    .eq('question_hash', hash)
    .limit(1);

  if (error) {
    console.error('Error checking question history:', error);
    return false; // En cas d'erreur, on permet la question
  }

  return data && data.length > 0;
}

/**
 * Ajoute des questions à l'historique de l'utilisateur
 */
export async function addQuestionsToHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  questions: Array<{ question: string }>,
  theme?: string
): Promise<void> {
  if (questions.length === 0) return;

  try {
    // Créer les entrées à insérer
    const entries = questions.map((q) => ({
      user_id: userId,
      question_hash: simpleHash(q.question.toLowerCase().trim()),
      theme: theme || null,
    }));

    // Insérer en batch
    const { error: insertError } = await supabase
      .from('user_question_history')
      .insert(entries as any);

    if (insertError) {
      console.error('Error inserting question history:', insertError);
      return;
    }

    // Nettoyer les anciennes entrées si on dépasse la limite
    await cleanupOldHistory(supabase, userId);
  } catch (error) {
    console.error('Error in addQuestionsToHistory:', error);
  }
}

/**
 * Nettoie les anciennes entrées pour respecter la limite
 */
async function cleanupOldHistory(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  try {
    // Compter les entrées
    const { count, error: countError } = await supabase
      .from('user_question_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError || count === null) return;

    if (count > MAX_HISTORY_SIZE) {
      // Récupérer les IDs des entrées les plus anciennes à supprimer
      const toDelete = count - MAX_HISTORY_SIZE;
      
      const { data: oldEntries } = await supabase
        .from('user_question_history')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(toDelete);

      if (oldEntries && oldEntries.length > 0) {
        const idsToDelete = oldEntries.map((e) => e.id);
        
        await supabase
          .from('user_question_history')
          .delete()
          .in('id', idsToDelete);
      }
    }
  } catch (error) {
    console.error('Error in cleanupOldHistory:', error);
  }
}

/**
 * Récupère les hashes des questions récentes pour injection dans le prompt
 */
export async function getRecentQuestionHashes(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = 30
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_question_history')
      .select('question_hash')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((d) => d.question_hash);
  } catch (error) {
    console.error('Error getting recent question hashes:', error);
    return [];
  }
}

/**
 * Efface tout l'historique d'un utilisateur
 */
export async function clearUserHistory(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  try {
    await supabase
      .from('user_question_history')
      .delete()
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error clearing user history:', error);
  }
}
