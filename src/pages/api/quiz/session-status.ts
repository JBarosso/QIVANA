// ============================================
// API ROUTE - SESSION STATUS
// ============================================
// Vérifie si une session de quiz est complétée

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { getQuizSession } from '../../../lib/quiz';

export const GET: APIRoute = async ({ request, cookies }) => {
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
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session');

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Récupérer la session
    const session = await getQuizSession(supabase, sessionId);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session introuvable' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Vérifier que la session appartient à l'utilisateur
    if (session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Retourner le statut
    return new Response(
      JSON.stringify({
        completed: !!session.completed_at,
        sessionId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error checking session status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur interne' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
