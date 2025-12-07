import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import '../../styles/components/LobbyRealtime.scss';

interface Participant {
  id: string;
  pseudo: string;
  joined_at?: string;
}

// Fonction helper pour valider et parser les participants depuis JSON
function parseParticipants(data: unknown): Participant[] {
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.filter((p): p is Participant => {
    return (
      typeof p === 'object' &&
      p !== null &&
      'id' in p &&
      'pseudo' in p &&
      typeof (p as any).id === 'string' &&
      typeof (p as any).pseudo === 'string'
    );
  }).map((p) => ({
    id: (p as any).id,
    pseudo: (p as any).pseudo,
    joined_at: typeof (p as any).joined_at === 'string' ? (p as any).joined_at : undefined,
  }));
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

  // Créer le client Supabase avec session persistante ET configuration Realtime optimisée
  // IMPORTANT: Ne pas utiliser setSession avec juste un access_token
  // À la place, on laisse le client Supabase gérer la session depuis localStorage/cookies
  const [supabase] = useState(() => {
    const client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // IMPORTANT: Ne pas utiliser flowType: 'pkce' ici car on veut que le client
        // récupère automatiquement la session depuis localStorage/cookies
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        // Configuration Realtime pour meilleure performance et réactivité
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
      },
    });
    
    // Vérifier la session existante (depuis localStorage ou cookies)
    // Le client Supabase devrait automatiquement récupérer la session si elle existe
    if (typeof window !== 'undefined') {
      // Attendre un peu pour que le client initialise la session depuis le storage
      setTimeout(() => {
        client.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
          if (sessionError) {
            console.warn('⚠️ Error getting session:', sessionError);
            console.warn('⚠️ Realtime may not work without a valid session');
          } else if (sessionData.session) {
            console.log('✅ Session found for Realtime:', {
              userId: sessionData.session.user.id,
              expiresAt: sessionData.session.expires_at 
                ? new Date(sessionData.session.expires_at * 1000).toISOString() 
                : 'N/A',
            });
          } else {
            console.warn('⚠️ No session available for Realtime');
            console.warn('⚠️ Realtime requires authentication to work');
            console.warn('💡 Make sure user is logged in before accessing the lobby');
          }
        });
      }, 100);
    }
    
    console.log('🔧 Supabase client initialized with Realtime support for LobbyRealtime');
    console.log('📊 Supabase URL:', supabaseUrl);
    console.log('📊 Realtime config:', {
      eventsPerSecond: 10,
      heartbeatIntervalMs: 30000,
    });
    
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
            const parsed = parseParticipants(data.participants);
            console.log('✅ Loaded participants (fallback):', parsed);
            setParticipants(parsed);
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
          const parsed = parseParticipants(data.participants);
          console.log('✅ Loaded participants from API:', parsed);
          setParticipants(parsed);
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

    // Variable pour tracker les mises à jour Realtime (déclarée avant le channel)
    let lastRealtimeUpdate = Date.now();

    // Fonction pour recharger les participants depuis l'API
    const reloadParticipants = async () => {
      try {
        const response = await fetch(`/api/duel/participants?salonId=${salonId}`);
        if (response.ok) {
          const data = await response.json();
          if (mounted) {
            const parsed = parseParticipants(data.participants);
            console.log('🔄 Reloaded participants:', parsed);
            setParticipants(parsed);
            if (data.chef_id) {
              setSalonChefId(data.chef_id);
            }
          }
        } else {
          // Si erreur 400, le salon n'est peut-être plus en lobby
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 400 && errorData.error === 'Salon non disponible') {
            console.log('⚠️ Salon is no longer in lobby during reload');
            // Vérifier le statut et rediriger si nécessaire
            const { data: salonData } = await supabase
              .from('duel_sessions')
              .select('status')
              .eq('id', salonId)
              .single();
            
            if (salonData?.status === 'in-progress') {
              console.log('🎮 Duel has started, redirecting...');
              window.location.href = `/duel/play?salon=${salonId}`;
            }
          }
        }
      } catch (error) {
        console.error('Error reloading participants:', error);
      }
    };

    // S'abonner aux changements en temps réel
    // IMPORTANT: Utiliser un nom de channel simple et stable pour éviter les reconnexions
    const channelName = `duel-session-${salonId}`;
    console.log('📡 Creating Realtime channel:', channelName);
    console.log('📡 Supabase URL:', supabaseUrl);
    console.log('📡 Salon ID:', salonId);
    
    // IMPORTANT: Vérifier et attendre que la session soit prête avant de souscrire
    // Realtime nécessite une session valide pour fonctionner
    const setupRealtimeChannel = async () => {
      // Attendre un peu pour que le client Supabase initialise la session depuis localStorage
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Vérifier l'état de la session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Error getting session for Realtime:', sessionError);
        console.error('⚠️ Realtime will likely fail without a valid session');
        console.error('💡 Solution: Make sure user is logged in and session is stored in localStorage');
      } else if (sessionData.session) {
        console.log('✅ Session ready for Realtime:', {
          hasSession: true,
          userId: sessionData.session.user.id,
          expiresAt: sessionData.session.expires_at 
            ? new Date(sessionData.session.expires_at * 1000).toISOString() 
            : 'N/A',
        });
        
        // Vérifier que l'utilisateur de la session correspond à currentUserId
        if (sessionData.session.user.id !== currentUserId) {
          console.warn('⚠️ Session user ID does not match currentUserId:', {
            sessionUserId: sessionData.session.user.id,
            currentUserId,
          });
        }
      } else {
        console.error('❌ No session found for Realtime');
        console.error('⚠️ Realtime requires authentication - subscription will fail');
        console.error('💡 Solution: User must be logged in before accessing the lobby');
        console.error('💡 Check if session is stored in localStorage or cookies');
        
        // Essayer de forcer un refresh de la session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('❌ Could not refresh session:', refreshError);
        } else if (refreshData.session) {
          console.log('✅ Session refreshed successfully');
        }
      }
      
      // Créer et souscrire au channel
      // IMPORTANT: Ne souscrire QUE si on a une session valide
      if (!sessionData.session) {
        console.error('❌ Cannot subscribe to Realtime without a valid session');
        console.error('💡 User must be logged in before accessing the lobby');
        return null; // Retourner null si pas de session
      }
      
      const channel = supabase
        .channel(channelName)
        .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'duel_sessions',
          filter: `id=eq.${salonId}`,
        },
        (payload) => {
          const timestamp = new Date().toISOString();
          console.log('🔄 Realtime UPDATE received on duel_sessions:', {
            new: payload.new,
            old: payload.old,
            timestamp,
            eventType: 'UPDATE',
            table: 'duel_sessions',
            salonId,
          });
          
          // Tracker que Realtime fonctionne (pour le polling de secours)
          lastRealtimeUpdate = Date.now();
          console.log('✅ Realtime update received - polling not needed');
          
          if (payload.new) {
            // ============================================
            // GESTION DU STATUT DU SALON (via Realtime)
            // ============================================
            
            // Si le duel démarre (status passe à 'in-progress'), rediriger tous les joueurs IMMÉDIATEMENT
            if (payload.new.status === 'in-progress') {
              const oldStatus = payload.old?.status;
              console.log('🎮 Duel status changed to in-progress via Realtime!', {
                oldStatus,
                newStatus: payload.new.status,
                salonId,
                timestamp: new Date().toISOString(),
              });
              
              // Rediriger immédiatement via Realtime (pas de polling nécessaire)
              console.log('🎮 Redirecting to play page via Realtime...');
              window.location.href = `/duel/play?salon=${salonId}`;
              return;
            }

            // Si le salon n'est plus en lobby, arrêter les mises à jour
            if (payload.new.status !== 'lobby') {
              console.log('⚠️ Salon is no longer in lobby, status:', payload.new.status);
              // Ne pas continuer à mettre à jour si le salon n'est plus en lobby
              return;
            }

            // ============================================
            // GESTION DES PARTICIPANTS (via Realtime)
            // ============================================
            
            // Mettre à jour les participants en temps réel (via Realtime, pas de polling)
            // Vérifier si les participants ont vraiment changé
            const oldParticipants = parseParticipants(payload.old?.participants);
            const newParticipants = parseParticipants(payload.new.participants);
            
            // Comparer pour éviter les mises à jour inutiles
            const oldIds = oldParticipants.map((p) => p.id).sort();
            const newIds = newParticipants.map((p) => p.id).sort();
            const participantsChanged = JSON.stringify(oldIds) !== JSON.stringify(newIds);
            
            if (participantsChanged) {
              const timestamp = new Date().toISOString();
              console.log('👥 Participants changed via Realtime:', {
                old: oldParticipants.map((p) => ({ id: p.id, pseudo: p.pseudo })),
                new: newParticipants.map((p) => ({ id: p.id, pseudo: p.pseudo })),
                oldIds,
                newIds,
                timestamp,
              });
              
              // Mettre à jour immédiatement (via Realtime, pas de polling)
              setParticipants(newParticipants);
              
              // Tracker que Realtime fonctionne
              lastRealtimeUpdate = Date.now();
              console.log('✅ Realtime update received - polling not needed');
              
              // Dispatcher l'événement pour mettre à jour le bouton "Démarrer"
              window.dispatchEvent(
                new CustomEvent('participants-updated', {
                  detail: { count: newParticipants.length },
                })
              );
              
              console.log('✅ Participants state updated via Realtime at', timestamp);
            } else {
              console.log('👥 Participants unchanged (same IDs) - skipping update');
            }
            
            // Mettre à jour le chef_id si changé (via Realtime)
            if (payload.new.chef_id && payload.new.chef_id !== payload.old?.chef_id) {
              console.log('👑 Chef changed via Realtime:', {
                old: payload.old?.chef_id,
                new: payload.new.chef_id,
              });
              setSalonChefId(payload.new.chef_id);
            }
          }
        }
      )
      .subscribe((status, err) => {
        const timestamp = new Date().toISOString();
        console.log('📡 Realtime subscription status:', status, 'at', timestamp);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to Realtime updates for duel_sessions');
          console.log('📊 Realtime is active - all updates should be instant (< 100ms)');
          console.log('📊 Channel name:', channelName);
          console.log('📊 Listening to: UPDATE on duel_sessions WHERE id =', salonId);
          
          // Tester immédiatement si Realtime fonctionne en vérifiant la connexion
          supabase.auth.getSession().then(({ data: sessionData }) => {
            console.log('📊 Realtime subscription active with session:', {
              hasSession: !!sessionData.session,
              userId: sessionData.session?.user?.id,
            });
            
            // Vérifier que le channel est bien connecté
            const channelState = supabase.getChannels().find((ch) => ch.topic === channelName);
            if (channelState) {
              console.log('📊 Channel state:', {
                topic: channelState.topic,
                state: channelState.state,
                joinedOnce: channelState.joinedOnce,
              });
            }
          });
          
          // Marquer que Realtime fonctionne
          lastRealtimeUpdate = Date.now();
          console.log('✅ Realtime subscription confirmed - polling will be skipped if updates arrive');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error:', err);
          console.error('⚠️ Realtime may not be enabled for duel_sessions table');
          console.error('⚠️ OR: No valid session/authentication');
          console.error('⚠️ OR: Realtime server connection issue');
          console.error('⚠️ Falling back to polling (60s interval)');
          console.error('🔍 Error details:', JSON.stringify(err, null, 2));
          
          // Vérifier la session en cas d'erreur
          supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
            if (sessionError || !sessionData.session) {
              console.error('❌ No valid session - this is likely the cause of Realtime failure');
              console.error('💡 Solution: Ensure user is authenticated before subscribing to Realtime');
            }
          });
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Realtime subscription timed out');
          console.error('⚠️ This usually means Realtime server is unreachable');
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Realtime channel closed');
          console.warn('⚠️ Channel will attempt to reconnect automatically');
        } else {
          console.warn('⚠️ Realtime subscription status:', status);
          if (err) {
            console.warn('⚠️ Error object:', err);
          }
        }
      });
      
      return channel;
    };
    
    // Appeler setupRealtimeChannel pour initialiser le channel
    let channelInstance: ReturnType<typeof supabase.channel> | null = null;
    setupRealtimeChannel()
      .then((ch) => {
        if (ch) {
          channelInstance = ch;
          console.log('✅ Realtime channel setup completed');
        } else {
          console.warn('⚠️ Realtime channel setup returned null (no session)');
        }
      })
      .catch((error) => {
        console.error('❌ Error setting up Realtime channel:', error);
      });

    // Polling de secours TRÈS rare (60 secondes) - uniquement si Realtime échoue complètement
    // Realtime devrait gérer TOUTES les mises à jour en temps réel :
    // - Nouveaux participants (via UPDATE sur duel_sessions.participants)
    // - Changement de statut (via UPDATE sur duel_sessions.status)
    // - Expulsion de participants (via UPDATE sur duel_sessions.participants)
    // 
    // NOTE: Si Realtime fonctionne, ce polling ne devrait JAMAIS se déclencher
    let pollInterval: NodeJS.Timeout | null = null;
    // lastRealtimeUpdate est déjà déclaré plus haut, ne pas le redéclarer
    
    const startPolling = () => {
      if (pollInterval) return; // Déjà en cours
      
      // Polling de secours très rare (60 secondes) - seulement en cas de problème Realtime
      pollInterval = setInterval(async () => {
        if (!mounted) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }
        
        // Vérifier si Realtime a fonctionné récemment (dans les 5 dernières secondes)
        const timeSinceLastRealtime = Date.now() - lastRealtimeUpdate;
        if (timeSinceLastRealtime < 5000) {
          console.log('✅ Realtime is working (last update', Math.round(timeSinceLastRealtime / 1000), 's ago) - skipping polling');
          return;
        }
        
        // Si pas de mise à jour Realtime depuis 5 secondes, c'est suspect
        console.warn('⚠️ No Realtime updates for', Math.round(timeSinceLastRealtime / 1000), 's - polling fallback triggered');
        
        // Vérifier d'abord le statut du salon avant de poller
        try {
          const statusResponse = await fetch(`/api/duel/participants?salonId=${salonId}`);
          if (statusResponse.ok) {
            reloadParticipants();
          } else {
            // Si le salon n'est plus en lobby, arrêter le polling
            const errorData = await statusResponse.json().catch(() => ({}));
            if (errorData.error === 'Salon non disponible' || statusResponse.status === 400) {
              console.log('⏹️ Salon is no longer in lobby, stopping polling');
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              // Vérifier si le duel a démarré et rediriger
              const { data: checkData } = await supabase
                .from('duel_sessions')
                .select('status')
                .eq('id', salonId)
                .single();
              
              if (checkData && checkData.status === 'in-progress') {
                console.log('🎮 Duel has started, redirecting...');
                window.location.href = `/duel/play?salon=${salonId}`;
              }
            }
          }
        } catch (error) {
          console.error('Error in polling check:', error);
        }
      }, 60000); // Polling de secours toutes les 60 secondes seulement (fallback d'urgence)
    };
    
    startPolling();

    // Nettoyer l'abonnement au démontage
    return () => {
      console.log('🧹 Cleaning up Realtime subscription');
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      // Nettoyer le channel
      if (channelInstance) {
        supabase.removeChannel(channelInstance);
      } else {
        // Si le channel n'a pas été créé, essayer de le trouver par nom
        const channels = supabase.getChannels();
        const channelToRemove = channels.find((ch) => ch.topic === channelName);
        if (channelToRemove) {
          supabase.removeChannel(channelToRemove);
        }
      }
    };
  }, [supabase, salonId]);

  // Détecter si l'utilisateur actuel a été expulsé
  useEffect(() => {
    // Ne pas vérifier pendant le chargement initial
    if (isLoading) {
      return;
    }

    // Le chef ne peut pas être expulsé
    if (isChef || currentUserId === salonChefId) {
      return;
    }

    // Vérifier si l'utilisateur actuel est toujours dans la liste des participants
    // On vérifie aussi que la liste a été chargée (au moins le chef devrait être là)
    const isStillParticipant = participants.some((p) => p.id === currentUserId);
    const hasParticipants = participants.length > 0 || salonChefId; // Au moins le chef existe

    // Si la liste a été chargée et que l'utilisateur n'est plus dedans, il a été expulsé
    if (hasParticipants && !isStillParticipant) {
      // L'utilisateur a été expulsé
      console.log('🚫 User has been expelled from salon:', {
        currentUserId,
        participants: participants.map(p => ({ id: p.id, pseudo: p.pseudo })),
        salonChefId,
      });
      alert('Vous avez été expulsé du salon par le chef.');
      // Rediriger vers la page d'accueil
      window.location.href = '/';
    }
  }, [participants, currentUserId, isChef, salonChefId, isLoading]);

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

  // Émettre un événement pour mettre à jour le bouton "Démarrer" dans le lobby
  useEffect(() => {
    const event = new CustomEvent('participants-updated', {
      detail: { count: participants.length },
    });
    window.dispatchEvent(event);
  }, [participants.length]);

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
                    if (!confirm(`Expulser ${participant.pseudo} du salon ?`)) {
                      return;
                    }
                    
                    try {
                      console.log('🗑️ Expelling participant:', {
                        participantId: participant.id,
                        participantPseudo: participant.pseudo,
                        salonId,
                      });
                      
                      // Utiliser l'API au lieu du client Supabase directement
                      const formData = new FormData();
                      formData.append('salon_id', salonId);
                      formData.append('participant_id', participant.id);
                      
                      const response = await fetch('/api/duel/kick', {
                        method: 'POST',
                        body: formData,
                      });
                      
                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error('❌ Error expelling participant:', response.status, errorData);
                        alert(`Erreur lors de l'expulsion: ${errorData.error || 'Erreur inconnue'}`);
                        return;
                      }
                      
                      const data = await response.json();
                      console.log('✅ Participant expelled successfully:', participant.pseudo);
                      console.log('✅ Updated participants from API:', data.participants);
                      
                      // Mettre à jour la liste localement (le Realtime devrait aussi le faire)
                      if (data.participants && Array.isArray(data.participants)) {
                        setParticipants(parseParticipants(data.participants));
                      }
                    } catch (error) {
                      console.error('❌ Error expelling participant:', error);
                      alert('Erreur lors de l\'expulsion: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
                    }
                  }}
                  title={`Expulser ${participant.pseudo}`}
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
