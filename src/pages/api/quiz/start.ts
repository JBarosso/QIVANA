// ============================================
// API ROUTE - START QUIZ (Unified System)
// ============================================
// Système unifié : vérifie stock DB → génère IA si insuffisant (Premium/Premium+)
// Sécurité Freemium : bloque toute génération IA

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import {
  fetchRandomQuestions,
  createQuizSession,
  getSeenQuestionIds,
  checkQuestionStock,
} from '../../../lib/quiz';
import { generateControlledAIQuestions } from '../../../lib/ai-generation';
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

    if (!universe || !difficulty) {
      return new Response('Univers et difficulté requis', { status: 400 });
    }

    const questionsRequested = 10;
    const questionsMinimum = 3;

    // ============================================
    // ÉTAPE 1 : Vérifier le stock DB disponible
    // ============================================
    const seenIds = await getSeenQuestionIds(supabase, user.id, universe, difficulty);
    const availableStock = await checkQuestionStock(
      supabase,
      user.id,
      universe,
      difficulty,
      questionsRequested
    );

    console.log(`📊 Stock disponible: ${availableStock} questions (demandé: ${questionsRequested})`);
    console.log(`👁️ Questions déjà vues: ${seenIds.length} questions`);

    // ============================================
    // ÉTAPE 2 : Si stock insuffisant
    // ============================================
    if (availableStock < questionsRequested) {
      // ⚠️ SÉCURITÉ FREEMIUM : Double vérification avant génération IA
      if (userPlan === 'freemium') {
        return new Response(
          JSON.stringify({
            error: 'Stock insuffisant',
            message: 'Stock insuffisant. Passe Premium pour débloquer la génération IA.',
            requiresPremium: true,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Pour Premium/Premium+ : génération IA contrôlée
      const missingCount = questionsRequested - availableStock;
      console.log(`🤖 Stock insuffisant. Génération IA contrôlée: ${missingCount} questions manquantes`);

      try {
        // Génération contrôlée (1 batch, pas de boucle)
        const generationResult = await generateControlledAIQuestions(
          supabase,
          user.id,
          universe,
          difficulty,
          missingCount,
          1 // Buffer de 1 question
        );

        console.log(
          `✅ Génération IA: ${generationResult.questionIds.length} questions insérées, ${generationResult.duplicatesSkipped} duplicates`
        );

        // Logging pour analytics (à implémenter dans une table dédiée si nécessaire)
        console.log(`📊 AI Generation logged: user=${user.id}, universe=${universe}, count=${generationResult.questionIds.length}`);
      } catch (generationError) {
        console.error('❌ Erreur lors de la génération IA:', generationError);
        // Continuer même si génération échoue (on utilisera ce qui est disponible en DB)
      }
    }

    // ============================================
    // ÉTAPE 3 : Recharger depuis la DB (après génération si applicable)
    // ============================================
    // ⚠️ IMPORTANT : Recharger les seenIds car de nouvelles questions peuvent avoir été générées
    // et d'autres sessions peuvent avoir été complétées entre temps
    const updatedSeenIds = await getSeenQuestionIds(supabase, user.id, universe, difficulty);
    console.log(`👁️ Questions déjà vues (après génération): ${updatedSeenIds.length} questions`);
    
    let questions: Question[];
    
    try {
      questions = await fetchRandomQuestions(
        supabase,
        universe,
        difficulty,
        questionsRequested,
        updatedSeenIds // Utiliser les seenIds mis à jour
      );
      
      console.log(`✅ Questions récupérées: ${questions.length} questions`);
    } catch (fetchError) {
      // Si fetchRandomQuestions échoue (pas de questions disponibles après exclusion des vues)
      console.error('❌ Erreur lors de la récupération des questions:', fetchError);
      console.error(`📊 Détails: Stock disponible=${availableStock}, Questions vues=${updatedSeenIds.length}`);
      
      // ⚠️ SÉCURITÉ FREEMIUM : Bloquer si erreur de récupération
      if (userPlan === 'freemium') {
        return new Response(
          JSON.stringify({
            error: 'Stock insuffisant',
            message: 'Stock insuffisant. Passe Premium pour débloquer la génération IA.',
            requiresPremium: true,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      // ⚠️ IMPORTANT : Pour Premium/Premium+, si toutes les questions ont été vues,
      // on doit générer de nouvelles questions même si le stock initial était suffisant
      if (fetchError instanceof Error && fetchError.message.includes('déjà été vues')) {
        console.log(`🤖 Toutes les questions ont été vues. Génération IA pour Premium/Premium+...`);
        
        try {
          // Générer exactement le nombre de questions demandé
          const generationResult = await generateControlledAIQuestions(
            supabase,
            user.id,
            universe,
            difficulty,
            questionsRequested, // Générer exactement le nombre demandé
            1 // Buffer de 1 question
          );

          console.log(
            `✅ Génération IA (toutes vues): ${generationResult.questionIds.length} questions insérées`
          );

          // Réessayer de récupérer les questions (maintenant avec nouvelles questions générées)
          const finalSeenIds = await getSeenQuestionIds(supabase, user.id, universe, difficulty);
          questions = await fetchRandomQuestions(
            supabase,
            universe,
            difficulty,
            questionsRequested,
            finalSeenIds
          );
          
          console.log(`✅ Questions récupérées après génération: ${questions.length} questions`);
        } catch (generationError) {
          console.error('❌ Erreur lors de la génération IA (fallback):', generationError);
          return new Response(
            JSON.stringify({
              error: 'Impossible de générer les questions',
              message: 'Erreur lors de la génération IA. Veuillez réessayer.',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        // Autre erreur
        return new Response(
          JSON.stringify({
            error: 'Impossible de charger les questions',
            message: fetchError instanceof Error ? fetchError.message : 'Erreur lors de la récupération des questions',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Si toujours insuffisant après génération, accepter ce qui est disponible
    if (questions.length < questionsMinimum) {
      // ⚠️ SÉCURITÉ FREEMIUM : Message différent selon le plan
      if (userPlan === 'freemium') {
        return new Response(
          JSON.stringify({
            error: 'Stock insuffisant',
            message: 'Stock insuffisant. Passe Premium pour débloquer la génération IA.',
            requiresPremium: true,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Pour Premium/Premium+ : accepter moins de questions si nécessaire
      if (questions.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Stock insuffisant',
            message: 'Impossible de générer un quiz. Stock insuffisant même après génération IA.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(`⚠️ Moins de questions que demandé: ${questions.length}/${questionsRequested}`);
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
      questions.map((q) => q.id)
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
    console.error('Error starting quiz:', error);
    return new Response(
      error instanceof Error ? error.message : 'Erreur interne',
      { status: 500 }
    );
  }
};
