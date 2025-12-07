// ============================================
// API ROUTE - NEXT QUESTION (Chef Only)
// ============================================
// Permet au chef de passer à la question suivante

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

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

  try {
    // Parser le formulaire
    const formData = await request.formData();
    const salonId = formData.get('salon_id')?.toString();
    const force = formData.get('force') === 'true';

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
        JSON.stringify({ error: 'Seul le chef peut passer à la question suivante' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que le salon est en cours
    if (salon.status !== 'in-progress') {
      return new Response(
        JSON.stringify({ error: 'Le duel n\'est pas en cours' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier qu'il y a des questions
    if (!salon.questions_ids || !Array.isArray(salon.questions_ids) || salon.questions_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucune question disponible' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const currentIndex = salon.current_question_index || 0;
    const totalQuestions = salon.questions_ids.length;
    
    // Vérifier que l'index est valide
    if (currentIndex < 0 || currentIndex >= salon.questions_ids.length) {
      return new Response(
        JSON.stringify({ error: 'Index de question invalide' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    const currentQuestionId = salon.questions_ids[currentIndex];

    console.log('🔍 Checking answers for question:', {
      salonId,
      currentIndex,
      currentQuestionId,
      totalQuestions,
    });

    // Vérifier que tous les joueurs actifs ont répondu à la question actuelle
    const participants = Array.isArray(salon.participants) ? salon.participants : [];
    const allPlayerIds = [salon.chef_id, ...participants.map((p: any) => p.id)];

    console.log('👥 All player IDs:', allPlayerIds);

    // Compter les réponses pour la question actuelle
    const { data: answers, error: answersError } = await supabase
      .from('duel_answers')
      .select('user_id, question_id')
      .eq('duel_session_id', salonId)
      .eq('question_id', currentQuestionId);

    if (answersError) {
      console.error('❌ Error checking answers:', answersError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la vérification des réponses: ' + answersError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('📝 Answers found:', answers?.map((a: any) => a.user_id));

    const answeredUserIds = new Set((answers || []).map((a: any) => a.user_id));
    const playersWhoAnswered = answeredUserIds.size;
    const totalActivePlayers = allPlayerIds.length;

    console.log('📊 Answer statistics:', {
      playersWhoAnswered,
      totalActivePlayers,
      answeredUserIds: Array.from(answeredUserIds),
      allPlayerIds,
      missing: allPlayerIds.filter((id) => !answeredUserIds.has(id)),
    });

    // Vérifier si tous les joueurs ont répondu

    if (playersWhoAnswered < totalActivePlayers && !force) {
      const missingPlayers = allPlayerIds.filter((id) => !answeredUserIds.has(id));
      console.log('⏳ Not all players have answered:', {
        answered: playersWhoAnswered,
        total: totalActivePlayers,
        missing: missingPlayers,
      });

      return new Response(
        JSON.stringify({ 
          error: 'Tous les joueurs n\'ont pas encore répondu à cette question',
          answered: playersWhoAnswered,
          total: totalActivePlayers,
          canForce: true, // Le chef peut forcer le passage
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Si on force, log pour information
    if (force && playersWhoAnswered < totalActivePlayers) {
      console.log('⚠️ Forcing next question despite missing answers:', {
        answered: playersWhoAnswered,
        total: totalActivePlayers,
      });
    }

    // Vérifier si c'est la dernière question
    if (currentIndex >= totalQuestions - 1) {
      // Terminer le duel
      // IMPORTANT: Cette mise à jour déclenchera un événement Realtime pour tous les clients
      // Le trigger Postgres mettra à jour updated_at automatiquement
      const { error: completeError } = await supabase
        .from('duel_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          // updated_at sera mis à jour automatiquement par le trigger
        })
        .eq('id', salonId);

      if (completeError) {
        console.error('Error completing duel:', completeError);
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de la finalisation du duel: ' + completeError.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          completed: true,
          redirectTo: `/duel/results?salon=${salonId}`,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Passer à la question suivante
    // IMPORTANT: Cette mise à jour déclenchera un événement Realtime pour tous les clients
    // Le trigger Postgres mettra à jour updated_at automatiquement
    const nextIndex = currentIndex + 1;

    const { error: updateError } = await supabase
      .from('duel_sessions')
      .update({
        current_question_index: nextIndex,
        // updated_at sera mis à jour automatiquement par le trigger
      })
      .eq('id', salonId)
      .eq('status', 'in-progress');

    if (updateError) {
      console.error('Error moving to next question:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors du passage à la question suivante: ' + updateError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Moved to next question:', {
      salonId,
      from: currentIndex,
      to: nextIndex,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        currentQuestionIndex: nextIndex,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in next-question endpoint:', error);
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
