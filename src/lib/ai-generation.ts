// ============================================
// AI GENERATION HELPER - QIVANA
// ============================================
// Fonction helper pour la génération contrôlée d'IA
// Suit le modèle unifié : génère seulement le manquant + buffer

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import type { Universe, Difficulty } from './quiz';
import { generateQuiz } from './ai';
import { generateEmbedding, checkDuplicate, saveEmbedding } from './embeddings';
import { getRecentUserQuestions } from './quiz';

export interface ControlledGenerationResult {
  questionIds: string[];
  generatedCount: number;
  duplicatesSkipped: number;
  errors: string[];
}

/**
 * Génère des questions IA de manière contrôlée (1 batch, pas de boucle)
 * @param supabase - Client Supabase
 * @param userId - ID de l'utilisateur
 * @param universe - Univers
 * @param difficulty - Difficulté
 * @param missingCount - Nombre de questions manquantes à générer
 * @param buffer - Buffer supplémentaire (1-2 questions, défaut: 1)
 * @returns IDs des questions insérées + statistiques
 */
export async function generateControlledAIQuestions(
  supabase: SupabaseClient<Database>,
  userId: string,
  universe: Universe,
  difficulty: Difficulty,
  missingCount: number,
  buffer: number = 1
): Promise<ControlledGenerationResult> {
  // Calculer le nombre total à générer (manquant + buffer)
  const totalToGenerate = missingCount + buffer;

  console.log(`🤖 Controlled AI generation: ${missingCount} missing + ${buffer} buffer = ${totalToGenerate} total`);

  // Récupérer les questions récentes de l'utilisateur pour injection de contexte
  const contextQuestions = await getRecentUserQuestions(supabase, userId, universe, 30);
  console.log(`📝 Context: ${contextQuestions.length} recent questions for injection`);

  // Générer le quiz via IA avec contexte
  const aiResponse = await generateQuiz({
    universe,
    difficulty,
    numberOfQuestions: totalToGenerate,
    contextQuestions: contextQuestions.length > 0 ? contextQuestions : undefined,
  });

  console.log(`✅ AI generated ${aiResponse.questions.length} questions`);

  // Traiter les questions : déduplication + insertion
  const insertedQuestions: string[] = [];
  const duplicates: string[] = [];
  const errors: string[] = [];

  for (const question of aiResponse.questions) {
    try {
      // Générer l'embedding
      const embedding = await generateEmbedding(question.question);

      // Vérifier les duplicates
      const isDuplicate = await checkDuplicate(supabase, question.question, embedding);

      if (isDuplicate) {
        console.log('⚠️ Duplicate detected, skipping');
        duplicates.push(question.question);
        continue;
      }

      // Insérer la question dans la DB
      const { data: insertedQuestion, error: insertError } = await supabase
        .from('questions')
        .insert({
          question: question.question,
          choices: question.choices,
          correct_index: question.correct_index,
          explanation: question.explanation,
          difficulty,
          universe,
          type: 'predefined',
          created_by: 'ia',
          is_approved: true,
        })
        .select('id')
        .single();

      if (insertError || !insertedQuestion) {
        const errorMsg = `Error inserting question: ${insertError?.message || 'Unknown error'}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
        continue;
      }

      // Sauvegarder l'embedding
      await saveEmbedding(supabase, insertedQuestion.id, embedding);

      insertedQuestions.push(insertedQuestion.id);
    } catch (error) {
      const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
      console.error('❌', errorMsg);
      errors.push(errorMsg);
    }
  }

  console.log(`✅ Inserted ${insertedQuestions.length} questions, ${duplicates.length} duplicates skipped`);

  // ============================================
  // LOGGING pour analytics
  // ============================================
  try {
    // Log dans la console (à remplacer par une table dédiée si nécessaire)
    console.log(`📊 AI Generation Log:`, {
      userId,
      universe,
      difficulty,
      requested: totalToGenerate,
      generated: aiResponse.questions.length,
      inserted: insertedQuestions.length,
      duplicates: duplicates.length,
      timestamp: new Date().toISOString(),
    });

    // TODO: Implémenter logging dans table ai_usage si elle existe
    // await supabase.from('ai_usage').insert({
    //   user_id: userId,
    //   universe,
    //   difficulty,
    //   questions_generated: aiResponse.questions.length,
    //   questions_inserted: insertedQuestions.length,
    //   duplicates_skipped: duplicates.length,
    //   created_at: new Date().toISOString(),
    // });
  } catch (logError) {
    console.error('Error logging AI generation:', logError);
    // Ne pas bloquer si le logging échoue
  }

  return {
    questionIds: insertedQuestions,
    generatedCount: aiResponse.questions.length,
    duplicatesSkipped: duplicates.length,
    errors,
  };
}
