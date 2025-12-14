// ============================================
// API ROUTE - RATE QUIZ
// ============================================
// Permet aux utilisateurs de noter un quiz

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
    return new Response('Non autorisé', { status: 401 });
  }

  try {
    const { sessionId, quizType, theme, rating, comment, promptUsed } = await request.json();

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: 'La note doit être entre 1 et 5' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!quizType || !['db', 'ai-predefined', 'ai-custom-quiz', 'duel'].includes(quizType)) {
      return new Response(
        JSON.stringify({ error: 'Type de quiz invalide' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que l'utilisateur n'a pas déjà noté cette session
    if (sessionId) {
      const { data: existingRating } = await supabase
        .from('quiz_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single();

      if (existingRating) {
        return new Response(
          JSON.stringify({ error: 'Tu as déjà noté ce quiz' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insérer la notation
    const { error: insertError } = await supabase
      .from('quiz_ratings')
      .insert({
        user_id: user.id,
        session_id: sessionId || null,
        quiz_type: quizType,
        theme: theme || null,
        rating,
        comment: comment || null,
        prompt_used: promptUsed || null,
      });

    if (insertError) {
      console.error('Error inserting rating:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si la note est >= 4 et qu'un prompt a été utilisé, l'ajouter aux exemples
    if (rating >= 4 && promptUsed && quizType === 'ai-custom-quiz') {
      // Vérifier si ce prompt existe déjà
      const { data: existingPrompt } = await supabase
        .from('prompt_examples')
        .select('id')
        .eq('prompt', promptUsed)
        .single();

      if (!existingPrompt) {
        // Ajouter le prompt comme exemple utilisateur
        await supabase
          .from('prompt_examples')
          .insert({
            prompt: promptUsed.substring(0, 200), // Limiter à 200 caractères
            source: 'user',
            is_active: true,
          });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in rate API:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
