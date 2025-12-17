// ============================================
// API ROUTE - AI CREDITS STATUS
// ============================================
// Retourne le statut des crédits IA pour l'utilisateur connecté

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { getAiCreditsStatus } from '../../../lib/ai-credits';

export const GET: APIRoute = async ({ cookies }) => {
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

  // Récupérer le statut des crédits
  const status = await getAiCreditsStatus(supabase, user.id);

  if (!status) {
    return new Response(
      JSON.stringify({ error: 'Impossible de récupérer le statut des crédits' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      monthlyUsed: status.monthlyUsed,
      monthlyLimit: status.monthlyLimit,
      extraCredits: status.extraCredits,
      periodResetDate: status.periodResetDate.toISOString(),
      plan: status.plan,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
