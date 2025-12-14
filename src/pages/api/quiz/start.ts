// ============================================
// API ROUTE - START QUIZ (Unified System)
// ============================================
// Système unifié : vérifie stock DB → génère IA si insuffisant (Premium/Premium+)
// Sécurité Freemium : bloque toute génération IA

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import {
  createQuizSession,
  fetchQuestionsWithAutoGeneration,
} from '../../../lib/quiz';
import type { Universe, Difficulty, Question } from '../../../lib/quiz';

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

  // ⚠️ SÉCURITÉ FREEMIUM : Récupérer le profil AVANT toute logique
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response('Profil introuvable', { status: 404 });
  }

  const userPlan = profile.plan;

  try {
    // Parser le formulaire
    const formData = await request.formData();
    const universe = formData.get('universe') as Universe;
    const difficulty = formData.get('difficulty') as Difficulty;
    
    // Récupérer le timer (selon plan)
    let timerSeconds = 10; // Par défaut pour Freemium
    if (userPlan !== 'freemium') {
      const timerValue = formData.get('timer');
      if (timerValue) {
        const parsedTimer = parseInt(timerValue.toString(), 10);
        // Vérifier que c'est un nombre valide
        if (!isNaN(parsedTimer) && parsedTimer > 0) {
          timerSeconds = parsedTimer;
          // Validation : Premium (5/10/15) ou Premium+ (3-20)
          if (userPlan === 'premium') {
            if (![5, 10, 15].includes(timerSeconds)) {
              timerSeconds = 10; // Fallback
            }
          } else if (userPlan === 'premium+') {
            if (timerSeconds < 3 || timerSeconds > 20) {
              timerSeconds = 10; // Fallback
            }
          }
        }
      }
    }

    if (!universe || !difficulty) {
      return new Response('Univers et difficulté requis', { status: 400 });
    }

    const questionsRequested = 10;
    const questionsMinimum = 3;

    // Utiliser la fonction unifiée pour récupérer les questions avec génération IA automatique
    const { fetchQuestionsWithAutoGeneration } = await import('../../../lib/quiz');
    
    let questions: Question[];
    try {
      questions = await fetchQuestionsWithAutoGeneration(
        supabase,
        user.id,
        universe,
        difficulty,
        questionsRequested,
        questionsMinimum,
        true // Exclure les questions déjà vues (mode solo)
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      // Gérer les erreurs spécifiques selon le plan
      if (errorMessage.includes('Stock insuffisant') && userPlan === 'freemium') {
        return new Response(
          JSON.stringify({
            error: 'Stock insuffisant',
            message: 'Plus assez de questions disponibles. Passe Premium pour accéder aux quiz personnalisés !',
            requiresPremium: true,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          error: 'Impossible de charger les questions',
          message: errorMessage,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // ============================================
    // ÉTAPE 4 : Créer la session de quiz
    // ============================================
    const sessionId = await createQuizSession(
      supabase,
      user.id,
      'step-by-step',
      universe,
      difficulty,
      questions.map((q) => q.id),
      timerSeconds
    );

    // ⚠️ IMPORTANT : Retourner JSON au lieu de redirect pour éviter les problèmes avec redirect: 'manual'
    // Le client suivra la redirection manuellement
    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        redirectTo: `/quiz/play?session=${sessionId}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error starting quiz:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    console.error('❌ Full error:', JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({
        error: 'Erreur lors du démarrage du quiz',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
