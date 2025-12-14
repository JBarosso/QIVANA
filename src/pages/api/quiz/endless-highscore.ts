// ============================================
// API ROUTE - ENDLESS HIGHSCORE
// ============================================
// Récupère le meilleur score d'un utilisateur

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

export const GET: APIRoute = async ({ url, cookies }) => {
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

  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(
      JSON.stringify({ highScore: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { data: scores } = await supabase
      .from('endless_scores')
      .select('score')
      .eq('user_id', userId)
      .order('score', { ascending: false })
      .limit(1);

    const highScore = scores && scores.length > 0 ? scores[0].score : 0;

    return new Response(
      JSON.stringify({ highScore }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching highscore:', error);
    return new Response(
      JSON.stringify({ highScore: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
