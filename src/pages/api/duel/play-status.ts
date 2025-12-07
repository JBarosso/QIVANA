// ============================================
// API ROUTE - GET DUEL PLAY STATUS
// ============================================
// Retourne le statut du duel et la liste des participants avec leur statut de réponse

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

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
      JSON.stringify({ error: 'Non authentifié' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(request.url);
    const salonId = url.searchParams.get('salonId');
    const questionId = url.searchParams.get('questionId');

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

    // Récupérer tous les joueurs
    const allPlayerIds = [salon.chef_id, ...participants.map((p: any) => p.id)];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, pseudo')
      .in('id', allPlayerIds);

    const profileMap = new Map((profiles || []).map((p: { id: string; pseudo: string }) => [p.id, p.pseudo]));

    // Si une question est spécifiée, vérifier qui a répondu
    let playersStatus: Array<{
      userId: string;
      pseudo: string;
      hasAnswered: boolean;
      isChef: boolean;
    }> = [];

    if (questionId) {
      const { data: answers } = await supabase
        .from('duel_answers')
        .select('user_id')
        .eq('duel_session_id', salonId)
        .eq('question_id', questionId);

      const answeredUserIds = new Set((answers || []).map((a: any) => a.user_id));

      playersStatus = allPlayerIds.map((playerId) => ({
        userId: playerId,
        pseudo: profileMap.get(playerId) || 'Joueur inconnu',
        hasAnswered: answeredUserIds.has(playerId),
        isChef: playerId === salon.chef_id,
      }));
    } else {
      // Sans question spécifiée, juste retourner la liste des joueurs
      playersStatus = allPlayerIds.map((playerId) => ({
        userId: playerId,
        pseudo: profileMap.get(playerId) || 'Joueur inconnu',
        hasAnswered: false,
        isChef: playerId === salon.chef_id,
      }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        players: playersStatus,
        totalPlayers: allPlayerIds.length,
        answeredCount: questionId ? playersStatus.filter((p) => p.hasAnswered).length : 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in play-status endpoint:', error);
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
