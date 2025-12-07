// ============================================
// API ROUTE - GET DUEL SALON PARTICIPANTS
// ============================================
// Retourne les participants d'un salon (utilisé par le composant React)

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { requireAuth } from '../../../lib/auth';

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
    return new Response(
      JSON.stringify({ error: 'Non autorisé' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Récupérer le salonId depuis les query params
  const url = new URL(request.url);
  const salonId = url.searchParams.get('salonId');

  if (!salonId) {
    return new Response(
      JSON.stringify({ error: 'ID de salon manquant' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Récupérer le salon avec les participants
  const { data: salon, error: salonError } = await supabase
    .from('duel_sessions')
    .select('id, chef_id, participants, status')
    .eq('id', salonId)
    .single();

  if (salonError || !salon) {
    return new Response(
      JSON.stringify({ error: 'Salon introuvable' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Vérifier que le salon est en lobby
  if (salon.status !== 'lobby') {
    return new Response(
      JSON.stringify({ error: 'Salon non disponible' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Retourner les participants et le chef_id
  return new Response(
    JSON.stringify({
      participants: Array.isArray(salon.participants) ? salon.participants : [],
      chef_id: salon.chef_id,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
