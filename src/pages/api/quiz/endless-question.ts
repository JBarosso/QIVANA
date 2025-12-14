// ============================================
// API ROUTE - ENDLESS QUESTION
// ============================================
// Génère des questions pour le mode Endless via IA
// Système de batch : génère 10 questions, puis 5 par 5

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { generateQuiz } from '../../../lib/ai';
import type { Difficulty } from '../../../lib/quiz';

// Thèmes variés pour le mode Endless (plus engageants)
const ENDLESS_THEMES = [
  'Quiz sur les animes cultes japonais',
  'Quiz sur les personnages de manga shonen',
  'Quiz sur les jeux vidéo rétro et modernes',
  'Quiz sur les films et séries de super-héros',
  'Quiz sur l\'univers Star Wars',
  'Quiz sur les films d\'animation Disney et Pixar',
  'Quiz sur l\'histoire des jeux vidéo',
  'Quiz sur les animes des années 2000',
  'Quiz sur les comics Marvel et DC',
  'Quiz sur les séries cultes',
];

// Cache en mémoire pour les questions générées (session-based)
// En production, utiliser Redis ou une table temporaire
const questionCache = new Map<string, Array<{
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}>>();

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key) { return cookies.get(key)?.value; },
        set(key, value, options) { cookies.set(key, value, options); },
        remove(key, options) { cookies.delete(key, options); },
      },
    }
  );

  // Vérifier l'auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return new Response('Non autorisé', { status: 401 });
  }

  // Vérifier le plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (!profile || profile.plan === 'freemium') {
    return new Response(
      JSON.stringify({ error: 'Mode Endless réservé aux abonnés Premium' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { difficulty, questionNumber = 1 } = await request.json();
    const cacheKey = `${user.id}_endless`;

    // Vérifier si on a des questions en cache
    let cachedQuestions = questionCache.get(cacheKey) || [];
    
    // Si c'est une nouvelle partie (question 1), réinitialiser le cache
    if (questionNumber === 1) {
      cachedQuestions = [];
      questionCache.set(cacheKey, cachedQuestions);
    }

    // Si on a des questions en cache, en retourner une
    if (cachedQuestions.length > 0) {
      const question = cachedQuestions.shift();
      questionCache.set(cacheKey, cachedQuestions);
      
      // Pré-générer si on arrive à 3 questions restantes
      if (cachedQuestions.length <= 3) {
        // Génération asynchrone en arrière-plan (ne pas attendre)
        generateBatchAsync(cacheKey, difficulty, user.id);
      }
      
      return new Response(
        JSON.stringify({ question }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pas de cache, générer un batch de questions
    const batchSize = questionNumber === 1 ? 10 : 5;
    const theme = ENDLESS_THEMES[Math.floor(Math.random() * ENDLESS_THEMES.length)];

    console.log(`🔥 Endless: Génération de ${batchSize} questions ${difficulty} - "${theme}"`);

    const aiResponse = await generateQuiz({
      universe: 'other' as any, // Univers mixte
      difficulty: difficulty as Difficulty,
      numberOfQuestions: batchSize,
      customPrompt: `${theme}
      
IMPORTANT ENDLESS MODE RULES:
- Questions must be varied and cover different aspects
- Each question must be standalone
- Progressive difficulty within the batch is encouraged
- Questions should be engaging and fun
- Avoid overly obscure questions that frustrate players`,
    });

    if (aiResponse.mode === 'quiz' && aiResponse.questions.length > 0) {
      // Mettre en cache toutes sauf la première
      const [firstQuestion, ...restQuestions] = aiResponse.questions;
      questionCache.set(cacheKey, restQuestions);

      return new Response(
        JSON.stringify({
          question: {
            question: firstQuestion.question,
            choices: firstQuestion.choices,
            correct_index: firstQuestion.correct_index,
            explanation: firstQuestion.explanation,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('No questions generated');
  } catch (error) {
    console.error('Error in endless-question:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de la génération de la question' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Génère un batch de questions en arrière-plan
 */
async function generateBatchAsync(cacheKey: string, difficulty: string, userId: string) {
  try {
    const theme = ENDLESS_THEMES[Math.floor(Math.random() * ENDLESS_THEMES.length)];
    
    const aiResponse = await generateQuiz({
      universe: 'other' as any,
      difficulty: difficulty as Difficulty,
      numberOfQuestions: 5,
      customPrompt: theme,
    });

    if (aiResponse.mode === 'quiz' && aiResponse.questions.length > 0) {
      const existingQuestions = questionCache.get(cacheKey) || [];
      const newQuestions = aiResponse.questions.map(q => ({
        question: q.question,
        choices: q.choices,
        correct_index: q.correct_index,
        explanation: q.explanation,
      }));
      
      questionCache.set(cacheKey, [...existingQuestions, ...newQuestions]);
      console.log(`✅ Endless: ${newQuestions.length} questions ajoutées au cache pour ${userId}`);
    }
  } catch (error) {
    console.error('Error generating batch:', error);
  }
}
