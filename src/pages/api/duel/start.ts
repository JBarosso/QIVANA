// ============================================
// API ROUTE - START DUEL
// ============================================
// Démarre un duel : génère les questions selon le mode (DB, AI-predefined, ou Custom Quiz)
// Système unifié : vérifie stock DB → génère IA si insuffisant (comme en mode solo)

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import {
  fetchQuestionsWithAutoGeneration,
} from '../../../lib/quiz';
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
      // Mode Custom Quiz : récupérer depuis temp_questions
      if (!salon.temp_questions || !Array.isArray(salon.temp_questions)) {
        return new Response(
          JSON.stringify({ error: 'Questions custom introuvables. Le salon doit être créé avec un custom quiz.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Convertir temp_questions en format Question
      tempQuestions = salon.temp_questions;
      questions = tempQuestions.map((q: any, index: number) => ({
        id: q.id || `temp-${index}`,
        question: q.question,
        choices: q.choices,
        correctIndex: q.correct_index,
        explanation: q.explanation || '',
        difficulty: q.difficulty || difficulty,
        universe: q.universe || universe,
      }));

      console.log('✅ Custom quiz questions loaded:', questions.length);
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
    });

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
