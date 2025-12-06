// ============================================
// EMBEDDINGS MODULE - QIVANA
// ============================================
// Génération et comparaison d'embeddings via OpenAI
// + Anti-duplicate check avec pgvector

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

/**
 * Génère un embedding pour une question via OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = import.meta.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured for embeddings');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Vérifie si une question existe déjà (similarité > 0.85)
 * Retourne true si duplicate trouvé
 */
export async function checkDuplicate(
  supabase: SupabaseClient<Database>,
  questionText: string,
  embedding: number[],
  threshold: number = 0.85
): Promise<boolean> {
  // Utiliser la fonction pgvector pour trouver les questions similaires
  // @ts-ignore - match_questions est une fonction SQL personnalisée non typée
  const result = await supabase.rpc('match_questions', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 1,
  });

  const data = result.data as any[] | null;
  const error = result.error;

  if (error) {
    console.error('Error checking duplicates:', error);
    // Ne pas bloquer si erreur - on insère quand même
    return false;
  }

  // Si au moins un match trouvé avec similarité > threshold
  return data !== null && data.length > 0;
}

/**
 * Sauvegarde un embedding dans la DB
 */
export async function saveEmbedding(
  supabase: SupabaseClient<Database>,
  questionId: string,
  embedding: number[]
): Promise<void> {
  // Convertir le tableau de nombres en string pour pgvector
  const embeddingString = `[${embedding.join(',')}]`;
  
  const { error } = await supabase.from('embeddings').insert({
    question_id: questionId,
    embedding: embeddingString,
  });

  if (error) {
    console.error('Error saving embedding:', error);
    // Ne pas throw - l'embedding n'est pas critique
  }
}
