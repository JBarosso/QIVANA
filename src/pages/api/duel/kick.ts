// ============================================
// API ROUTE - KICK PARTICIPANT FROM DUEL SALON
// ============================================
// Permet au chef d'expulser un participant

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
      JSON.stringify({ error: 'Non autorisé' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parser le formulaire
    const formData = await request.formData();
    const salonId = formData.get('salon_id')?.toString();
    const participantId = formData.get('participant_id')?.toString();

    if (!salonId || !participantId) {
      return new Response(
        JSON.stringify({ error: 'ID de salon ou participant manquant' }),
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
        JSON.stringify({ error: 'Seul le chef peut expulser des participants' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que le salon est en lobby
    if (salon.status !== 'lobby') {
      return new Response(
        JSON.stringify({ error: 'Le salon n\'est plus en attente de joueurs' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Empêcher le chef de s'expulser lui-même
    if (participantId === salon.chef_id) {
      return new Response(
        JSON.stringify({ error: 'Le chef ne peut pas s\'expulser lui-même' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Retirer le participant de la liste
    const participants = Array.isArray(salon.participants) ? salon.participants : [];
    const updatedParticipants = participants.filter((p: any) => p.id !== participantId);

    // Vérifier que le participant était bien dans la liste
    const wasInList = participants.some((p: any) => p.id === participantId);
    if (!wasInList) {
      return new Response(
        JSON.stringify({ error: 'Participant non trouvé dans le salon' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Mettre à jour le salon
    const { data: updatedSalon, error: updateError } = await supabase
      .from('duel_sessions')
      .update({ participants: updatedParticipants })
      .eq('id', salonId)
      .eq('status', 'lobby')
      .select('participants')
      .single();

    if (updateError) {
      console.error('Error expelling participant:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de l\'expulsion: ' + updateError.message,
          details: updateError.details,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Participant expelled successfully:', participantId);
    console.log('✅ Updated participants:', updatedSalon?.participants);

    return new Response(
      JSON.stringify({ 
        success: true,
        participants: updatedSalon?.participants || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in kick endpoint:', error);
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
