// ============================================
// API ROUTE - START DUEL
// ============================================
// Démarre un duel : génère les questions depuis la DB uniquement (pas d'AI)
// et met le salon en status 'in-progress'

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { fetchRandomQuestions } from '../../../lib/quiz';
import type { Universe, Difficulty } from '../../../lib/quiz';

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

    // ⚠️ IMPORTANT : Multiplayer utilise UNIQUEMENT des questions DB (pas d'AI)
    // Récupérer les questions depuis la DB uniquement
    const questionsCount = salon.questions_count;
    const universe = salon.universe as Universe;
    const difficulty = salon.difficulty as Difficulty;

    console.log('🎮 Starting duel:', {
      salonId,
      universe,
      difficulty,
      questionsCount,
      totalPlayers,
    });

    // Récupérer les questions depuis la DB (pas d'AI, pas de filtrage par utilisateur)
    // Pour un duel, on peut utiliser toutes les questions disponibles
    let questions;
    try {
      questions = await fetchRandomQuestions(
        supabase,
        universe,
        difficulty,
        questionsCount,
        [] // Pas d'exclusion pour les duels (toutes les questions sont disponibles)
      );
    } catch (error) {
      console.error('Error fetching questions:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Impossible de récupérer les questions. Stock insuffisant pour ce duel.',
          details: error instanceof Error ? error.message : 'Erreur inconnue'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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

    // Si on a moins de questions que demandé, on continue avec ce qu'on a
    const questionIds = questions.map((q) => q.id);

    // Mettre à jour le salon : questions_ids, status='in-progress', started_at
    // IMPORTANT: Cette mise à jour déclenchera un événement Realtime pour tous les clients
    // Le trigger Postgres mettra à jour updated_at automatiquement
    const { error: updateError } = await supabase
      .from('duel_sessions')
      .update({
        questions_ids: questionIds,
        status: 'in-progress',
        started_at: new Date().toISOString(),
        // updated_at sera mis à jour automatiquement par le trigger
      })
      .eq('id', salonId)
      .eq('status', 'lobby'); // S'assurer que le salon est toujours en lobby

    if (updateError) {
      console.error('Error starting duel:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors du démarrage du duel: ' + updateError.message,
          details: updateError.details,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Duel started successfully:', {
      salonId,
      questionsCount: questionIds.length,
      totalPlayers,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        redirectTo: `/duel/play?salon=${salonId}`,
        questionsCount: questionIds.length,
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
