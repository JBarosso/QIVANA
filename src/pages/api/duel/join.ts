// ============================================
// API ROUTE - JOIN DUEL SALON
// ============================================
// Permet à un utilisateur Premium+ de rejoindre un salon

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
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
    return new Response(JSON.stringify({ error: 'Non authentifié' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ⚠️ SÉCURITÉ : Vérifier que l'utilisateur a Premium+
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, pseudo')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Profil introuvable' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (profile.plan !== 'premium+') {
    return new Response(
      JSON.stringify({ error: 'Accès réservé aux utilisateurs Premium+' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Parser le formulaire
    const formData = await request.formData();
    const salonId = formData.get('salon_id')?.toString();

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

    // Vérifier que le salon est en lobby
    if (salon.status !== 'lobby') {
      return new Response(
        JSON.stringify({ error: 'Ce salon n\'est plus en attente de joueurs' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Vérifier que l'utilisateur n'est pas déjà le chef
    if (salon.chef_id === user.id) {
      return new Response(
        JSON.stringify({ redirectTo: `/duel/lobby?salon=${salonId}` }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Ajouter l'utilisateur aux participants
    const participants = Array.isArray(salon.participants) ? salon.participants : [];
    
    // Vérifier si l'utilisateur n'est pas déjà dans la liste
    const alreadyJoined = participants.some((p: any) => p.id === user.id);
    
    if (!alreadyJoined) {
      const newParticipant = {
        id: user.id,
        pseudo: profile.pseudo,
        joined_at: new Date().toISOString(),
      };

      const updatedParticipants = [...participants, newParticipant];

      const { error: updateError } = await supabase
        .from('duel_sessions')
        .update({ participants: updatedParticipants })
        .eq('id', salonId)
        .eq('status', 'lobby'); // S'assurer que le salon est toujours en lobby

      if (updateError) {
        console.error('❌ Error adding participant:', updateError);
        console.error('Update error details:', {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        });
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de l\'ajout au salon: ' + updateError.message,
            details: updateError.details,
            code: updateError.code
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      // Vérifier que la mise à jour a bien fonctionné
      const { data: updatedSalon, error: verifyError } = await supabase
        .from('duel_sessions')
        .select('participants')
        .eq('id', salonId)
        .single();
      
      if (verifyError) {
        console.error('❌ Error verifying update:', verifyError);
      } else {
        console.log('✅ Participant added successfully:', newParticipant);
        console.log('✅ Updated participants:', updatedSalon?.participants);
      }
    }

    // Rediriger vers le lobby
    return new Response(
      JSON.stringify({
        success: true,
        redirectTo: `/duel/lobby?salon=${salonId}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error joining salon:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erreur lors de la jonction du salon',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
