// ============================================
// API ROUTE - START DUEL
// ============================================
// Démarre un duel : génère les questions selon le mode (DB, AI-predefined, ou Custom Quiz)
// Système unifié : vérifie stock DB → génère IA si insuffisant (comme en mode solo)

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import {
  fetchQuestionsWithAutoGeneration,
  getRecentUserQuestions,
} from '../../../lib/quiz';
import { generateQuiz } from '../../../lib/ai';
import type { Universe, Difficulty, Question } from '../../../lib/quiz';

export const POST: APIRoute = async ({ request, cookies }) => {
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
    return new Response(
      JSON.stringify({ error: 'Non authentifié' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Vérifier Premium+
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: 'Profil introuvable' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (profile.plan !== 'premium+') {
    return new Response(
      JSON.stringify({ error: 'Accès réservé aux utilisateurs Premium+' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parser le formulaire
    const formData = await request.formData();
    const salonId = formData.get('salon_id')?.toString();

    if (!salonId) {
      return new Response(
        JSON.stringify({ error: 'ID de salon manquant' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer le salon
    const { data: salon, error: salonError } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', salonId)
      .single();

    if (salonError || !salon) {
      return new Response(
        JSON.stringify({ error: 'Salon introuvable' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que l'utilisateur est le chef
    if (salon.chef_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Seul le chef peut démarrer le duel' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que le salon est en lobby
    if (salon.status !== 'lobby') {
      return new Response(
        JSON.stringify({ error: 'Le salon n\'est plus en attente de joueurs' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier qu'il y a au moins 2 joueurs (chef + 1 participant minimum)
    const participants = Array.isArray(salon.participants) ? salon.participants : [];
    const totalPlayers = 1 + participants.length; // Chef + participants

    if (totalPlayers < 2) {
      return new Response(
        JSON.stringify({ error: 'Il faut au moins 2 joueurs pour démarrer un duel' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer les paramètres du salon
    const questionsCount = salon.questions_count;
    const universe = salon.universe as Universe;
    const difficulty = salon.difficulty as Difficulty;
    const mode = salon.mode as 'db' | 'ai-predefined' | 'ai-custom-quiz';

    console.log('🎮 Starting duel:', {
      salonId,
      mode,
      universe,
      difficulty,
      questionsCount,
      totalPlayers,
    });

    // ============================================
    // GESTION SELON LE MODE
    // ============================================
    let questions: Question[] = [];
    let tempQuestions: any[] | null = null;

    if (mode === 'ai-custom-quiz') {
      // Mode Custom Quiz : générer les questions au démarrage depuis le prompt stocké
      const customPrompt = (salon as any).custom_prompt;
      
      if (!customPrompt || typeof customPrompt !== 'string' || customPrompt.length < 10) {
        // Fallback : vérifier si temp_questions existe (ancien système)
        if (salon.temp_questions && Array.isArray(salon.temp_questions)) {
          console.log('⚠️ Using deprecated temp_questions (migration from old system)');
          const customQuestions: any[] = salon.temp_questions;
          tempQuestions = customQuestions;
          
          questions = customQuestions.map((q: any, index: number) => ({
            id: q.id || `temp-${index}`,
            question: q.question,
            choices: q.choices,
            correct_index: q.correct_index,
            explanation: q.explanation || '',
            difficulty: q.difficulty || difficulty,
            universe: q.universe || universe,
          }));
          
          console.log('✅ Custom quiz questions loaded from temp_questions (deprecated):', questions.length);
        } else {
          return new Response(
            JSON.stringify({ error: 'Prompt custom introuvable. Le salon doit être créé avec un custom quiz.' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        // ⚠️ IMPORTANT : Générer les questions au démarrage depuis le prompt
        console.log('🎨 Generating custom quiz from prompt at game start...');
        
        // Vérifier le quota IA
        const { data: quotaProfile } = await supabase
          .from('profiles')
          .select('ai_quizzes_used_this_month, ai_quota_reset_date')
          .eq('id', user.id)
          .single();

        if (quotaProfile) {
          const now = new Date();
          const resetDate = new Date(quotaProfile.ai_quota_reset_date);
          
          // Si la date de reset est passée, réinitialiser le quota
          if (now > resetDate) {
            await supabase
              .from('profiles')
              .update({
                ai_quizzes_used_this_month: 0,
                ai_quota_reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
              })
              .eq('id', user.id);
          }
        }

        const currentQuota = quotaProfile?.ai_quizzes_used_this_month || 0;
        const maxQuota = 200; // Premium+ a 200 quiz IA par mois
        
        if (currentQuota >= maxQuota) {
          return new Response(
            JSON.stringify({ 
              error: 'Quota mensuel de quiz IA épuisé',
              message: `Vous avez utilisé ${currentQuota}/${maxQuota} quiz IA ce mois. Le quota sera réinitialisé le mois prochain.`
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Générer le custom quiz au démarrage
        try {
          const contextQuestions = await getRecentUserQuestions(supabase, user.id, 'other', 20);
          
          const aiResponse = await generateQuiz({
            universe: 'other',
            difficulty: difficulty as Difficulty,
            numberOfQuestions: questionsCount,
            customPrompt: customPrompt,
            contextQuestions: contextQuestions.length > 0 ? contextQuestions : undefined,
          });

          tempQuestions = aiResponse.questions;
          
          // Convertir en format Question
          questions = tempQuestions.map((q: any, index: number) => ({
            id: q.id || `temp-${index}`,
            question: q.question,
            choices: q.choices,
            correct_index: q.correct_index,
            explanation: q.explanation || '',
            difficulty: q.difficulty || difficulty,
            universe: q.universe || universe,
          }));
          
          // Incrémenter le quota
          await supabase
            .from('profiles')
            .update({
              ai_quizzes_used_this_month: currentQuota + 1,
            })
            .eq('id', user.id);

          console.log(`✅ Custom quiz generated at game start: ${questions.length} questions`);
        } catch (error) {
          console.error('Error generating custom quiz:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Erreur lors de la génération du quiz custom',
              details: error instanceof Error ? error.message : 'Erreur inconnue'
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
    } else {
      // Mode DB : utiliser la fonction unifiée avec génération IA automatique si nécessaire
      // Pour les duels, on n'exclut PAS les questions déjà vues (toutes les questions sont disponibles)
      const questionsRequested = questionsCount;
      const questionsMinimum = 3;

      try {
        questions = await fetchQuestionsWithAutoGeneration(
          supabase,
          user.id,
          universe,
          difficulty,
          questionsRequested,
          questionsMinimum,
          false // Ne PAS exclure les questions déjà vues (multijoueur)
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('❌ Erreur lors de la récupération des questions:', error);
        
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
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucune question disponible pour ces critères' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // ⚠️ IMPORTANT : Ne PAS mettre à jour le statut ici
    // Socket.IO mettra à jour Supabase après le démarrage réussi du jeu
    // On retourne juste les questions pour Socket.IO
    
    console.log('✅ Questions retrieved successfully:', {
      salonId,
      questionsCount: questions.length,
      totalPlayers,
      mode,
    });
    
    // ⚠️ DEBUG : Vérifier le format des questions
    if (questions.length > 0) {
      const firstQuestion = questions[0];
      console.log('📋 First question format check:', {
        id: firstQuestion.id,
        hasCorrectIndex: 'correct_index' in firstQuestion,
        correctIndex: firstQuestion.correct_index,
        choicesCount: firstQuestion.choices?.length,
      });
    }

    // Retourner les questions complètes pour Socket.IO
    return new Response(
      JSON.stringify({ 
        success: true,
        redirectTo: `/duel/play?room=${salon.salon_code}&salon=${salonId}`,
        questionsCount: questions.length,
        questions: questions, // Questions complètes pour Socket.IO
        mode: mode, // Mode du quiz (db, ai-predefined, ai-custom-quiz)
        tempQuestions: tempQuestions, // Questions temporaires si custom quiz
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in start duel endpoint:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur interne' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
