// ============================================
// API ROUTE - ANSWER DUEL QUESTION
// ============================================
// Enregistre la réponse d'un joueur à une question de duel

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
    const questionId = formData.get('question_id')?.toString();
    const questionIndexStr = formData.get('question_index')?.toString();
    const selectedIndexStr = formData.get('selected_index')?.toString();
    const timeRemainingStr = formData.get('time_remaining')?.toString();

    if (!salonId || !questionId || !questionIndexStr || !selectedIndexStr || !timeRemainingStr) {
      return new Response(
        JSON.stringify({ error: 'Données manquantes' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const questionIndex = parseInt(questionIndexStr, 10);
    const selectedIndex = parseInt(selectedIndexStr, 10);
    const timeRemaining = parseInt(timeRemainingStr, 10);

    if (isNaN(questionIndex) || isNaN(selectedIndex) || isNaN(timeRemaining)) {
      return new Response(
        JSON.stringify({ error: 'Données invalides' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que le salon existe et est en cours
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

    if (salon.status !== 'in-progress') {
      return new Response(
        JSON.stringify({ error: 'Le duel n\'est pas en cours' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que l'utilisateur fait partie du duel
    const participants = Array.isArray(salon.participants) ? salon.participants : [];
    const isChef = salon.chef_id === user.id;
    const isParticipant = participants.some((p: any) => p.id === user.id);

    if (!isChef && !isParticipant) {
      return new Response(
        JSON.stringify({ error: 'Vous ne faites pas partie de ce duel' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que la question fait partie du duel
    if (!salon.questions_ids || !Array.isArray(salon.questions_ids) || !salon.questions_ids.includes(questionId)) {
      return new Response(
        JSON.stringify({ error: 'Question invalide pour ce duel' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer la question pour vérifier la bonne réponse
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('correct_index')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return new Response(
        JSON.stringify({ error: 'Question introuvable' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier si l'utilisateur a déjà répondu à cette question
    const { data: existingAnswer } = await supabase
      .from('duel_answers')
      .select('id')
      .eq('duel_session_id', salonId)
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (existingAnswer) {
      return new Response(
        JSON.stringify({ error: 'Vous avez déjà répondu à cette question' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculer si la réponse est correcte
    const isCorrect = selectedIndex >= 0 && selectedIndex === question.correct_index;
    
    // Calculer les points (simplifié pour l'instant, on peut améliorer plus tard)
    const timerSeconds = salon.timer_seconds || 10;
    const pointsEarned = isCorrect
      ? Math.max(1, Math.round((timeRemaining / timerSeconds) * 20))
      : 0;

    // Insérer la réponse
    const { error: insertError } = await supabase
      .from('duel_answers')
      .insert({
        duel_session_id: salonId,
        user_id: user.id,
        question_id: questionId,
        question_index: questionIndex,
        selected_index: selectedIndex >= 0 ? selectedIndex : null,
        is_correct: isCorrect,
        time_remaining: timeRemaining,
        points_earned: pointsEarned,
      });

    if (insertError) {
      console.error('Error inserting answer:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de l\'enregistrement de la réponse: ' + insertError.message,
          details: insertError.details,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Answer saved successfully:', {
      salonId,
      userId: user.id,
      questionId,
      isCorrect,
      pointsEarned,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        isCorrect,
        pointsEarned,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in answer endpoint:', error);
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
