import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { fetchRandomQuestions, createQuizSession, getSeenQuestionIds } from '../../../lib/quiz';
import type { Universe, Difficulty } from '../../../lib/quiz';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Créer le client Supabase
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key) {
          return cookies.get(key)?.value;
        },
        set(key, value, options) {
          cookies.set(key, value, options);
        },
        remove(key, options) {
          cookies.delete(key, options);
        },
      },
    }
  );

  // Vérifier l'auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return redirect('/auth/login');
  }

  try {
    // Parser le formulaire
    const formData = await request.formData();
    const universe = formData.get('universe') as Universe;
    const difficulty = formData.get('difficulty') as Difficulty;

    if (!universe || !difficulty) {
      return new Response('Univers et difficulté requis', { status: 400 });
    }

    // Récupérer les questions déjà vues (duplicate prevention)
    const seenIds = await getSeenQuestionIds(supabase, user.id, universe, difficulty);

    // Fetch questions aléatoires (max 10, mais accepte minimum 3)
    const questionsRequested = 10;
    const questionsMinimum = 3;
    
    const questions = await fetchRandomQuestions(
      supabase,
      universe,
      difficulty,
      questionsRequested,
      seenIds
    );

    if (questions.length < questionsMinimum) {
      return new Response(
        `Pas assez de questions disponibles (${questions.length}/${questionsMinimum} minimum). Essaie une autre difficulté ou univers.`,
        { status: 400 }
      );
    }

    // Créer la session de quiz
    const sessionId = await createQuizSession(
      supabase,
      user.id,
      'step-by-step',
      universe,
      difficulty,
      questions.map((q) => q.id)
    );

    // Rediriger vers la page de jeu avec l'ID de session
    return redirect(`/quiz/play?session=${sessionId}`);
  } catch (error) {
    console.error('Error starting quiz:', error);
    return new Response(
      error instanceof Error ? error.message : 'Erreur interne',
      { status: 500 }
    );
  }
};
