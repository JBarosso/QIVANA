// ============================================
// API ROUTE - ENDLESS QUESTION
// ============================================
// Génère une question pour le mode Endless

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { generateQuiz } from '../../../lib/ai';

// Univers aléatoires pour varier les questions
const UNIVERSES = ['anime', 'manga', 'comics', 'games', 'movies', 'series'] as const;

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
    const { difficulty } = await request.json();

    // Choisir un univers aléatoire
    const randomUniverse = UNIVERSES[Math.floor(Math.random() * UNIVERSES.length)];

    // D'abord essayer de récupérer une question de la DB
    const { data: dbQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('universe', randomUniverse)
      .eq('difficulty', difficulty)
      .eq('is_approved', true)
      .limit(50);

    if (dbQuestions && dbQuestions.length > 0) {
      // Choisir une question aléatoire
      const randomQuestion = dbQuestions[Math.floor(Math.random() * dbQuestions.length)];
      
      return new Response(
        JSON.stringify({
          question: {
            question: randomQuestion.question,
            choices: randomQuestion.choices,
            correct_index: randomQuestion.correct_index,
            explanation: randomQuestion.explanation,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: générer via IA
    const aiResponse = await generateQuiz({
      universe: randomUniverse,
      difficulty: difficulty as any,
      numberOfQuestions: 1,
    });

    if (aiResponse.questions.length > 0) {
      const question = aiResponse.questions[0];
      return new Response(
        JSON.stringify({
          question: {
            question: question.question,
            choices: question.choices,
            correct_index: question.correct_index,
            explanation: question.explanation,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('No question generated');
  } catch (error) {
    console.error('Error in endless-question:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de la génération' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
