import { useEffect, useState, useMemo } from 'react';
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
  chefId: string;
  chefPseudo: string;
  accessToken?: string | null;
}

export default function LobbyRealtime({
  supabaseUrl,
  supabaseKey,
  salonId,
  currentUserId,
  currentUserPseudo,
  isChef,
  chefId,
  chefPseudo,
  accessToken,
}: LobbyRealtimeProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [salonChefId, setSalonChefId] = useState<string>(chefId);
  
  // Log pour debug
  console.log('🎮 LobbyRealtime initialized:', {
    salonId,
    currentUserId,
    isChef,
    chefId,
    chefPseudo,
    salonChefId,
  });

  // Créer le client Supabase avec session persistante
  // Si un accessToken est fourni depuis le serveur, l'utiliser pour initialiser la session
  const [supabase] = useState(() => {
    const client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
    
    // Si un token d'accès est fourni, l'utiliser pour initialiser la session
    if (accessToken && typeof window !== 'undefined') {
      // Initialiser la session avec le token
      client.auth.setSession({
        access_token: accessToken,
        refresh_token: '', // Le refresh token sera récupéré automatiquement
      } as any).catch((error) => {
        console.warn('Could not set session from token:', error);
      });
    }
    
    return client;
  });

  useEffect(() => {
    let mounted = true;
    
    // Charger les participants initiaux via l'API (contourne le problème de session côté client)
    const loadParticipants = async () => {
      try {
        console.log(`🔍 Loading participants for salon ${salonId}`);
        
        // Utiliser l'API au lieu du client Supabase directement
        const response = await fetch(`/api/duel/participants?salonId=${salonId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Error loading participants from API:', response.status, errorData);
          
          // Fallback: essayer avec le client Supabase
          console.log('🔄 Falling back to Supabase client...');
          const { data, error } = await supabase
            .from('duel_sessions')
            .select('*')
            .eq('id', salonId)
            .maybeSingle();
          
          if (!error && data && mounted) {
            const parsed = Array.isArray(data.participants) ? data.participants : [];
            console.log('✅ Loaded participants (fallback):', parsed);
            setParticipants(parsed as Participant[]);
            if (data.chef_id) {
              setSalonChefId(data.chef_id);
            }
            setIsLoading(false);
            return;
          }
          
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        
        if (mounted) {
          const parsed = Array.isArray(data.participants) ? data.participants : [];
          console.log('✅ Loaded participants from API:', parsed);
          setParticipants(parsed as Participant[]);
          if (data.chef_id) {
            setSalonChefId(data.chef_id);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading participants:', error);
        if (mounted) {
          setIsLoading(false);
        }
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
          console.log('🔄 Realtime update received:', payload.new);
          if (payload.new) {
            // Mettre à jour les participants
            if (payload.new.participants) {
              const parsed = Array.isArray(payload.new.participants)
                ? payload.new.participants
                : [];
              console.log('👥 Updated participants:', parsed);
              setParticipants(parsed as Participant[]);
            }
            // Mettre à jour le chef_id si changé
            if (payload.new.chef_id) {
              setSalonChefId(payload.new.chef_id);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    // Nettoyer l'abonnement au démontage
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, salonId]);

  // S'assurer que le chef est toujours dans la liste des participants affichés
  // Le chef doit toujours être visible, même s'il n'est pas dans le tableau participants
  const allParticipants = useMemo(() => {
    const participantsList = [...participants];
    
    console.log('📋 Building participant list:', {
      participantsCount: participantsList.length,
      salonChefId,
      chefPseudo,
      participants: participantsList.map(p => ({ id: p.id, pseudo: p.pseudo })),
    });
    
    // Vérifier si le chef est dans la liste des participants
    const chefInList = participantsList.find((p) => p.id === salonChefId);
    
    // Si le chef n'est pas dans la liste, l'ajouter en premier
    if (!chefInList && salonChefId && chefPseudo) {
      participantsList.unshift({
        id: salonChefId,
        pseudo: chefPseudo,
        joined_at: new Date().toISOString(),
      });
      console.log('👑 Chef added to display list:', chefPseudo, 'with id:', salonChefId);
    }
    
    // Trier pour que le chef soit toujours en premier
    const sorted = participantsList.sort((a, b) => {
      if (a.id === salonChefId) return -1;
      if (b.id === salonChefId) return 1;
      return 0;
    });
    
    console.log('✅ Final participant list:', sorted.map(p => ({
      id: p.id,
      pseudo: p.pseudo,
      isChef: p.id === salonChefId,
    })));
    
    return sorted;
  }, [participants, salonChefId, chefPseudo]);

  // Note: L'ajout des participants est géré par l'API /api/duel/join
  // Le composant se contente d'afficher la liste mise à jour en temps réel

  // Note: Le chargement est géré dans le rendu final

  if (isLoading) {
    return (
      <div className="lobby-realtime">
        <p className="lobby-realtime__empty">Chargement des joueurs...</p>
      </div>
    );
  }

  if (allParticipants.length === 0) {
    return (
      <div className="lobby-realtime">
        <p className="lobby-realtime__empty">Aucun joueur pour l'instant</p>
        <p className="lobby-realtime__empty" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Le chef devrait apparaître ici. Si personne n'apparaît, essayez de rafraîchir la page.
        </p>
      </div>
    );
  }

  return (
    <div className="lobby-realtime">
      <ul className="lobby-realtime__list">
        {allParticipants.map((participant) => {
          // Le chef est déterminé par salonChefId, pas par isChef (qui est pour l'utilisateur actuel)
          const isParticipantChef = participant.id === salonChefId;
          const isCurrentUser = participant.id === currentUserId;
          
          // Debug log pour chaque participant
          if (isParticipantChef) {
            console.log('👑 Rendering chef:', participant.pseudo, 'salonChefId:', salonChefId);
          }
          
          return (
            <li
              key={participant.id}
              className={`lobby-realtime__player ${
                isCurrentUser ? 'lobby-realtime__player--current' : ''
              }`}
            >
              <span className="lobby-realtime__player-name">{participant.pseudo}</span>
              <div className="lobby-realtime__player-badges">
                {isCurrentUser && (
                  <span className="lobby-realtime__player-badge">Vous</span>
                )}
                {/* Afficher le badge chef uniquement si c'est vraiment le chef (basé sur salonChefId) */}
                {isParticipantChef && (
                  <span className="lobby-realtime__player-badge lobby-realtime__player-badge--chef">👑 Chef</span>
                )}
              </div>
              {/* Le bouton d'expulsion est visible uniquement pour le chef (isChef) et uniquement sur les autres joueurs */}
              {isChef && !isParticipantChef && (
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
          );
        })}
      </ul>
    </div>
  );
}
