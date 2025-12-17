// ============================================
// API ROUTE - CHECK CAN JOIN MULTIPLAYER
// ============================================
// Vérifie si un utilisateur peut rejoindre un salon multijoueur

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

// Limites de participation journalière par plan
const DAILY_LIMITS: Record<string, number> = {
  'freemium': 5,
  'premium': 20,
  'premium+': -1, // illimité
};

export const GET: APIRoute = async ({ cookies, url }) => {
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
    return new Response(JSON.stringify({ canJoin: false, reason: 'NOT_AUTHENTICATED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const salonId = url.searchParams.get('salonId');

  // Récupérer le profil de l'utilisateur
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ canJoin: false, reason: 'PROFILE_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Si on a un salonId, vérifier si l'utilisateur est le chef
  if (salonId) {
    const { data: salon } = await supabase
      .from('duel_sessions')
      .select('chef_id')
      .eq('id', salonId)
      .single();

    if (salon && salon.chef_id === user.id) {
      // Le chef peut toujours rejoindre (c'est son salon)
      return new Response(
        JSON.stringify({ canJoin: true, isChef: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Vérifier la limite journalière (sauf pour Premium+)
  const dailyLimit = DAILY_LIMITS[profile.plan] || DAILY_LIMITS['freemium'];
  
  if (dailyLimit === -1) {
    // Premium+ : accès illimité
    return new Response(
      JSON.stringify({ canJoin: true, plan: profile.plan }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Vérifier le nombre de participations du jour via la fonction DB
  const { data: limitCheck, error: limitError } = await supabase
    .rpc('can_join_multiplayer', { p_user_id: user.id });
  
  if (limitError) {
    console.error('Error checking daily limit:', limitError);
    // En cas d'erreur, on autorise (fail-open pour UX)
    return new Response(
      JSON.stringify({ canJoin: true, plan: profile.plan }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (limitCheck && limitCheck.length > 0) {
    const { can_join, current_count, daily_limit } = limitCheck[0];
    
    return new Response(
      JSON.stringify({ 
        canJoin: can_join,
        plan: profile.plan,
        currentCount: current_count,
        dailyLimit: daily_limit,
        reason: can_join ? null : 'DAILY_LIMIT_REACHED',
        message: can_join 
          ? null 
          : `Tu as atteint ta limite de ${daily_limit} parties multijoueur par jour. Passe à Premium+ pour un accès illimité !`
      }),
      {
        status: can_join ? 200 : 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Par défaut, autoriser
  return new Response(
    JSON.stringify({ canJoin: true, plan: profile.plan }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
