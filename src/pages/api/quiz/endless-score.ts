// ============================================
// API ROUTE - ENDLESS SCORE
// ============================================
// Sauvegarde le score d'une partie Endless

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

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

  try {
    const { score, questionsAnswered, maxDifficulty, livesRemaining } = await request.json();

    // Validation
    if (typeof score !== 'number' || score < 0) {
      return new Response(
        JSON.stringify({ error: 'Score invalide' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insérer le score
    const { error: insertError } = await supabase
      .from('endless_scores')
      .insert({
        user_id: user.id,
        score,
        questions_answered: questionsAnswered || 0,
        max_difficulty: maxDifficulty || 'easy',
        lives_remaining: livesRemaining || 0,
      });

    if (insertError) {
      console.error('Error inserting endless score:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la sauvegarde' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in endless-score:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
