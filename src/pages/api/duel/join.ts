// ============================================
// API ROUTE - JOIN DUEL SALON
// ============================================
// Permet à un utilisateur authentifié de rejoindre un salon
// Limites journalières : Freemium (5/jour), Premium (20/jour), Premium+ (illimité)

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

// Limites de participation journalière par plan
const DAILY_LIMITS: Record<string, number> = {
  'freemium': 5,
  'premium': 20,
  'premium+': -1, // illimité
};

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

  // Récupérer le profil de l'utilisateur
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

    // ⚠️ VÉRIFIER LA LIMITE JOURNALIÈRE (sauf pour Premium+ et le chef du salon)
    const dailyLimit = DAILY_LIMITS[profile.plan] || DAILY_LIMITS['freemium'];
    
    if (dailyLimit !== -1) {
      // Vérifier le nombre de participations du jour via la fonction DB
      const { data: limitCheck, error: limitError } = await supabase
        .rpc('can_join_multiplayer', { p_user_id: user.id });
      
      if (limitError) {
        console.error('Error checking daily limit:', limitError);
        // En cas d'erreur, on continue (fail-open pour UX)
      } else if (limitCheck && limitCheck.length > 0) {
        const { can_join, current_count, daily_limit } = limitCheck[0];
        
        if (!can_join) {
          return new Response(
            JSON.stringify({ 
              error: 'Limite journalière atteinte',
              code: 'DAILY_LIMIT_REACHED',
              current_count,
              daily_limit,
              plan: profile.plan,
              message: `Tu as atteint ta limite de ${daily_limit} parties multijoueur par jour. Passe à Premium+ pour un accès illimité !`
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
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

      // IMPORTANT: Cette mise à jour déclenchera un événement Realtime pour tous les clients
      // Le trigger Postgres mettra à jour updated_at automatiquement pour forcer Realtime
      console.log('📡 Updating duel_sessions.participants - this should trigger Realtime event');
      const { data: updatedSalon, error: updateError } = await supabase
        .from('duel_sessions')
        .update({ 
          participants: updatedParticipants,
          // updated_at sera mis à jour automatiquement par le trigger
        })
        .eq('id', salonId)
        .eq('status', 'lobby') // S'assurer que le salon est toujours en lobby
        .select('participants, updated_at')
        .single();

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
      
      console.log('✅ Participant added successfully:', newParticipant);
      console.log('✅ Updated participants:', updatedSalon?.participants);
      console.log('📡 Realtime event should be triggered NOW for all connected clients');
      
      // 📊 Enregistrer la participation pour le compteur journalier (sauf Premium+)
      const dailyLimit = DAILY_LIMITS[profile.plan] || DAILY_LIMITS['freemium'];
      if (dailyLimit !== -1) {
        const { error: participationError } = await supabase
          .from('multiplayer_participations')
          .insert({
            user_id: user.id,
            session_id: salonId,
          });
        
        if (participationError) {
          // Log mais ne pas bloquer (la participation est déjà enregistrée dans le salon)
          console.warn('⚠️ Could not record participation for daily limit:', participationError);
        } else {
          console.log('📊 Participation recorded for daily limit tracking');
        }
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
