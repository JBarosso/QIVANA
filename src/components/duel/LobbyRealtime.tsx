import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import '../../styles/components/LobbyRealtime.scss';

interface Participant {
  id: string;
  pseudo: string;
  joined_at?: string;
}

interface LobbyRealtimeProps {
  supabaseUrl: string;
  supabaseKey: string;
  salonId: string;
  currentUserId: string;
  currentUserPseudo: string;
  isChef: boolean;
}

export default function LobbyRealtime({
  supabaseUrl,
  supabaseKey,
  salonId,
  currentUserId,
  currentUserPseudo,
  isChef,
}: LobbyRealtimeProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Créer le client Supabase avec session persistante
  const [supabase] = useState(() => 
    createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  );

  useEffect(() => {
    // Charger les participants initiaux
    const loadParticipants = async () => {
      try {
        // Vérifier que l'utilisateur est authentifié
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('User not authenticated');
          setIsLoading(false);
          return;
        }

        // Sélectionner tous les champs (select('*') pour éviter les erreurs 406)
        const { data, error } = await supabase
          .from('duel_sessions')
          .select('*')
          .eq('id', salonId)
          .single();

        if (!error && data?.participants) {
          const parsed = Array.isArray(data.participants) ? data.participants : [];
          setParticipants(parsed as Participant[]);
        } else if (error) {
          console.error('Error loading participants:', error);
          // Log détaillé pour debug
          console.error('Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
        }
      } catch (error) {
        console.error('Error loading participants:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadParticipants();

    // S'abonner aux changements en temps réel
    const channel = supabase
      .channel(`duel-session-${salonId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'duel_sessions',
          filter: `id=eq.${salonId}`,
        },
        (payload) => {
          if (payload.new.participants) {
            const parsed = Array.isArray(payload.new.participants)
              ? payload.new.participants
              : [];
            setParticipants(parsed as Participant[]);
          }
        }
      )
      .subscribe();

    // Nettoyer l'abonnement au démontage
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, salonId]);

  // Ajouter le joueur actuel s'il n'est pas déjà dans la liste
  useEffect(() => {
    const currentParticipant = participants.find((p) => p.id === currentUserId);
    
    if (!currentParticipant) {
      // Ajouter le joueur actuel au salon
      const addParticipant = async () => {
        const newParticipant: Participant = {
          id: currentUserId,
          pseudo: currentUserPseudo,
          joined_at: new Date().toISOString(),
        };

        const updatedParticipants = [...participants, newParticipant];

        const { error } = await supabase
          .from('duel_sessions')
          .update({ participants: updatedParticipants })
          .eq('id', salonId);

        if (error) {
          console.error('Error adding participant:', error);
        }
      };

      if (!isLoading) {
        addParticipant();
      }
    }
  }, [participants, currentUserId, currentUserPseudo, salonId, supabase, isLoading]);

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (participants.length === 0) {
    return (
      <div className="lobby-realtime">
        <p className="lobby-realtime__empty">Aucun joueur pour l'instant</p>
      </div>
    );
  }

  return (
    <div className="lobby-realtime">
      <ul className="lobby-realtime__list">
        {participants.map((participant) => (
          <li
            key={participant.id}
            className={`lobby-realtime__player ${
              participant.id === currentUserId ? 'lobby-realtime__player--current' : ''
            }`}
          >
            <span className="lobby-realtime__player-name">{participant.pseudo}</span>
            <div className="lobby-realtime__player-badges">
              {participant.id === currentUserId && (
                <span className="lobby-realtime__player-badge">Vous</span>
              )}
              {isChef && participant.id === currentUserId && (
                <span className="lobby-realtime__player-badge lobby-realtime__player-badge--chef">👑 Chef</span>
              )}
            </div>
            {isChef && participant.id !== currentUserId && (
              <button
                className="lobby-realtime__kick-btn"
                onClick={async () => {
                  const updated = participants.filter((p) => p.id !== participant.id);
                  await supabase
                    .from('duel_sessions')
                    .update({ participants: updated })
                    .eq('id', salonId);
                }}
                title="Expulser"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
