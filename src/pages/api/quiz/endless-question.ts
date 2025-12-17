// ============================================
// API ROUTE - ENDLESS QUESTION
// ============================================
// Génère des questions pour le mode Endless via IA
// Système de batch : génère 10 questions, puis 5 par 5

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { generateQuiz } from '../../../lib/ai';
import { checkAndConsumeAiCredit } from '../../../lib/ai-credits';
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

  try {
    const { difficulty, questionNumber = 1 } = await request.json();

    // Récupérer le profil pour obtenir le plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response('Profil introuvable', { status: 404 });
    }

    if (profile.plan === 'freemium') {
      return new Response(
        JSON.stringify({ error: 'Mode Endless réservé aux abonnés Premium' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
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
      const remainingInCache = cachedQuestions.length;
      questionCache.set(cacheKey, cachedQuestions);
      
      // Pré-générer à la 7ème question de chaque batch (quand il reste 3 questions dans un batch de 10)
      // questionNumber commence à 1
      // Question 7 : (7-1) % 10 = 6 (7ème du premier batch, index 6)
      // Question 17 : (17-1) % 10 = 6 (7ème du deuxième batch, index 6)
      // etc.
      // À la 7ème question d'un batch de 10, il reste 3 questions dans le cache
      const positionInBatch = (questionNumber - 1) % 10;
      if (positionInBatch === 6 && remainingInCache === 3) {
        // Génération asynchrone en arrière-plan (ne pas attendre)
        generateBatchAsync(cacheKey, difficulty, user.id);
      }
      
      return new Response(
        JSON.stringify({ question }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pas de cache, générer un batch de questions
    // Batch de 10 questions (même après les 10 premières)
    const batchSize = 10;
    const theme = ENDLESS_THEMES[Math.floor(Math.random() * ENDLESS_THEMES.length)];

    // ⚠️ VÉRIFICATION ET CONSOMMATION DES CRÉDITS IA (avant génération)
    const creditCheck = await checkAndConsumeAiCredit(supabase, user.id, {
      mode: 'endless',
      questionsInBatch: batchSize,
    });

    if (!creditCheck.allowed) {
      if (creditCheck.error === 'out_of_credits') {
        return new Response(
          JSON.stringify({ 
            error: 'out_of_credits',
            message: 'Crédits IA épuisés',
            creditsRemaining: creditCheck.creditsRemaining,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Impossible de générer des questions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

      // Logging pour analytics (ai_usage) - en arrière-plan
      supabase
        .from('ai_usage')
        .insert({
          user_id: user.id,
          quiz_type: 'ai-custom-quiz', // Endless utilise custom prompts
          questions_count: aiResponse.questions.length,
          universe: 'other',
          prompt: theme.substring(0, 200),
          mode: 'endless',
          credits_consumed: 1,
          plan_at_time: profile.plan,
        })
        .then(({ error }) => {
          if (error) console.error('Error logging endless AI usage:', error);
        });

      return new Response(
        JSON.stringify({
          question: {
            question: firstQuestion.question,
            choices: firstQuestion.choices,
            correct_index: firstQuestion.correct_index,
            explanation: firstQuestion.explanation,
          },
          creditsRemaining: creditCheck.creditsRemaining,
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
 * ⚠️ IMPORTANT: Cette fonction doit aussi vérifier et consommer les crédits
 */
async function generateBatchAsync(cacheKey: string, difficulty: string, userId: string) {
  try {
    // Créer un client Supabase pour cette fonction async
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    // ⚠️ VÉRIFICATION ET CONSOMMATION DES CRÉDITS IA
    const creditCheck = await checkAndConsumeAiCredit(supabaseAdmin, userId, {
      mode: 'endless',
      questionsInBatch: 10,
    });

    if (!creditCheck.allowed) {
      console.warn(`⚠️ Endless: Cannot generate batch for ${userId} - out of credits`);
      return; // Ne pas générer si pas de crédits
    }

    const theme = ENDLESS_THEMES[Math.floor(Math.random() * ENDLESS_THEMES.length)];
    
    // Générer 10 questions par batch (au lieu de 5)
    const aiResponse = await generateQuiz({
      universe: 'other' as any,
      difficulty: difficulty as Difficulty,
      numberOfQuestions: 10,
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

      // Logging pour analytics (ai_usage) - en arrière-plan
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();

      supabaseAdmin
        .from('ai_usage')
        .insert({
          user_id: userId,
          quiz_type: 'ai-custom-quiz',
          questions_count: aiResponse.questions.length,
          universe: 'other',
          prompt: theme.substring(0, 200),
          mode: 'endless',
          credits_consumed: 1,
          plan_at_time: profile?.plan || 'unknown',
        })
        .then(({ error }) => {
          if (error) console.error('Error logging endless batch AI usage:', error);
        });
    }
  } catch (error) {
    console.error('Error generating batch:', error);
  }
}
