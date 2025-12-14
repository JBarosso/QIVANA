import { useEffect, useState, useMemo } from 'react';
import { useSocketIO } from '../../lib/useSocketIO';
import type { RoomSettings, Player } from '../../lib/socket';

interface LobbyRealtimeProps {
  roomId: string;
  currentUserId: string;
  currentUserPseudo: string;
  isChef: boolean;
  chefId: string;
  chefPseudo: string;
}

export default function LobbyRealtime({
  roomId,
  currentUserId,
  currentUserPseudo,
  isChef,
  chefId,
  chefPseudo,
}: LobbyRealtimeProps) {
  const { socket, isConnected } = useSocketIO();
  const [room, setRoom] = useState<RoomSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rejoindre la room au montage
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('⏳ Waiting for Socket.IO connection...');
      return;
    }

    let retryTimeout: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 500; // 500ms entre chaque tentative

    // Fonction pour essayer de rejoindre la room
    const attemptJoin = () => {
      console.log(`🎮 Joining room: ${roomId} (attempt ${retryCount + 1}/${maxRetries})`);
      socket.emit('room:join', {
        roomId: roomId,
        playerId: currentUserId,
        pseudo: currentUserPseudo,
      });
    };

    // Écouter les événements de room
    const onRoomCreated = (data: { roomId: string; room: RoomSettings }) => {
      // Si c'est notre room et qu'on est le chef, mettre à jour l'état directement
      if (data.roomId === roomId && isChef) {
        console.log('✅ Room created (chef):', data.room);
        setRoom(data.room);
        setIsLoading(false);
        setError(null);
        // Annuler les tentatives de retry
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
      }
    };

    const onRoomJoined = (data: { room: RoomSettings }) => {
      console.log('✅ Room joined:', data.room);
      setRoom(data.room);
      setIsLoading(false);
      setError(null);
      // Annuler les tentatives de retry
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      retryCount = 0; // Reset le compteur
    };

    const onPlayerJoined = (data: { player: Player; room: RoomSettings }) => {
      console.log('👤 Player joined:', data.player.pseudo);
      setRoom(data.room);
    };

    const onPlayerLeft = (data: { playerId: string; room: RoomSettings }) => {
      console.log('👋 Player left:', data.playerId);
      setRoom(data.room);
    };

    const onRoomError = (data: { message: string; code?: string }) => {
      console.error('❌ Room error:', data.message);
      
      // Si le joueur est banni, rediriger vers la page d'accueil
      if (data.code === 'BANNED' || data.message.includes('banni') || data.message.includes('banned')) {
        console.log('🚫 Player is banned, redirecting to home...');
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vous avez été banni de ce salon et ne pouvez plus y revenir.', type: 'error' } }));
        // Rediriger vers la page d'accueil (pas vers le salon)
        setTimeout(() => { window.location.href = '/'; }, 2000);
        return;
      }
      
      // Si la room n'existe pas encore et qu'on est le chef, réessayer après un délai
      if (data.message.includes('introuvable') || data.message.includes('not found')) {
        if (isChef && retryCount < maxRetries) {
          retryCount++;
          console.log(`⏳ Room not found yet, retrying in ${retryDelay}ms... (${retryCount}/${maxRetries})`);
          retryTimeout = setTimeout(() => {
            attemptJoin();
          }, retryDelay);
          return; // Ne pas afficher l'erreur, on réessaie
        }
      }
      
      // Pour les autres erreurs ou si on a épuisé les tentatives
      setError(data.message);
      setIsLoading(false);
    };

    const onKicked = (data: { roomId: string; reason?: string }) => {
      console.log('👢 Kicked from room:', data.roomId);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vous avez été expulsé du salon par le chef.', type: 'error' } }));
      setTimeout(() => { window.location.href = '/'; }, 2000);
    };

    const onBanned = (data: { roomId: string; reason?: string }) => {
      console.log('🚫 Banned from room:', data.roomId);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Vous avez été banni de ce salon et ne pouvez plus y revenir.', type: 'error' } }));
      // Rediriger vers la page d'accueil (pas vers le salon)
      setTimeout(() => { window.location.href = '/'; }, 2000);
    };

    // Écouter room:created pour le chef
    // Écouter le démarrage du jeu pour rediriger tous les joueurs (pas seulement le leader)
    const onGameQuestion = (data: any) => {
      console.log('🎮 Game started, redirecting to play page...');
      // Rediriger vers la page de jeu
      const salonId = new URLSearchParams(window.location.search).get('salon');
      if (salonId) {
        window.location.href = `/duel/play?room=${roomId}&salon=${salonId}`;
      } else {
        window.location.href = `/duel/play?room=${roomId}`;
      }
    };

    socket.on('room:created', onRoomCreated);
    socket.on('room:joined', onRoomJoined);
    socket.on('room:player-joined', onPlayerJoined);
    socket.on('room:player-left', onPlayerLeft);
    socket.on('room:error', onRoomError);
    socket.on('room:kicked', onKicked);
    socket.on('room:banned', onBanned);
    socket.on('game:question', onGameQuestion); // Écouter le démarrage du jeu

    // Écouter l'événement personnalisé de création de room
    const onRoomCreatedEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ roomId: string; room: RoomSettings }>;
      if (customEvent.detail.roomId === roomId && isChef) {
        console.log('✅ Room created event received, joining now...');
        // La room est créée, on peut maintenant rejoindre
        attemptJoin();
      }
    };

    let fallbackTimeout: NodeJS.Timeout | null = null;

    // Si on est le chef, attendre l'événement de création ou un timeout
    // Sinon, rejoindre immédiatement
    if (isChef) {
      window.addEventListener('socket-room-created', onRoomCreatedEvent);
      
      // Attendre l'événement de création (max 2 secondes)
      fallbackTimeout = setTimeout(() => {
        console.log('⏳ Room creation timeout, attempting join anyway...');
        attemptJoin();
      }, 2000);
    } else {
      // Rejoindre immédiatement si on n'est pas le chef
      attemptJoin();
    }

    // Cleanup
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
      window.removeEventListener('socket-room-created', onRoomCreatedEvent);
      if (socket) {
        socket.off('room:created', onRoomCreated);
        socket.off('room:joined', onRoomJoined);
        socket.off('room:player-joined', onPlayerJoined);
        socket.off('room:player-left', onPlayerLeft);
        socket.off('room:error', onRoomError);
        socket.off('room:kicked', onKicked);
        socket.off('room:banned', onBanned);
        socket.off('game:question', onGameQuestion);

        // Quitter la room au démontage
        socket.emit('room:leave');
      }
    };
  }, [socket, isConnected, roomId, currentUserId, currentUserPseudo, isChef]);

  // Fonction pour expulser un joueur (temporaire)
  const handleKickPlayer = async (playerId: string, playerPseudo: string) => {
    if (!socket || !isChef) {
      return;
    }

    if (!confirm(`Expulser ${playerPseudo} du salon ?\n\nIl pourra revenir avec le code.`)) {
      return;
    }

    console.log('🗑️ Kicking player:', playerId);

    socket.emit('room:kick-player', {
      playerId: playerId,
    });
  };

  // Fonction pour bannir un joueur (permanent)
  const handleBanPlayer = async (playerId: string, playerPseudo: string) => {
    if (!socket || !isChef) {
      return;
    }

    if (!confirm(`Bannir définitivement ${playerPseudo} du salon ?\n\nIl ne pourra plus revenir, même avec le code.\n\nCette action est irréversible.`)) {
      return;
    }

    console.log('🚫 Banning player:', playerId);

    socket.emit('room:ban-player', {
      playerId: playerId,
    });
  };

  // Liste des participants avec le chef en premier
  const allParticipants = useMemo(() => {
    if (!room) return [];

    const players = [...room.players];
    
    // Trier pour que le leader soit en premier
    return players.sort((a, b) => {
      if (a.id === room.leaderId) return -1;
      if (b.id === room.leaderId) return 1;
      return 0;
    });
  }, [room]);

  // Émettre un événement pour mettre à jour le bouton "Démarrer"
  useEffect(() => {
    if (room) {
      const event = new CustomEvent('participants-updated', {
        detail: { count: room.players.length },
      });
      window.dispatchEvent(event);
    }
  }, [room?.players.length]);

  if (isLoading) {
    return (
      <div className="lobby-realtime">
        <p className="lobby-realtime__empty">Chargement des joueurs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lobby-realtime">
        <p className="lobby-realtime__error">
          Erreur: {error}
        </p>
      </div>
    );
  }

  if (allParticipants.length === 0) {
    return (
      <div className="lobby-realtime">
        <p className="lobby-realtime__empty">Aucun joueur pour l'instant</p>
      </div>
    );
  }

  return (
    <div className="lobby-realtime">
      <ul className="lobby-realtime__list">
        {allParticipants.map((participant) => {
          const isParticipantLeader = participant.id === room!.leaderId;
          const isCurrentUser = participant.id === currentUserId;

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
                {isParticipantLeader && (
                  <span className="lobby-realtime__player-badge lobby-realtime__player-badge--chef">
                    👑 Chef
                  </span>
                )}
              </div>
              {/* Boutons d'action (chef only, pas sur lui-même) */}
              {isChef && !isParticipantLeader && (
                <div className="lobby-realtime__player-actions">
                  <button
                    className="lobby-realtime__kick-btn"
                    onClick={() => handleKickPlayer(participant.id, participant.pseudo)}
                    title={`Expulser ${participant.pseudo} (peut revenir)`}
                  >
                    ✕ Exclure
                  </button>
                  <button
                    className="lobby-realtime__ban-btn"
                    onClick={() => handleBanPlayer(participant.id, participant.pseudo)}
                    title={`Bannir ${participant.pseudo} (ne peut plus revenir)`}
                  >
                    🚫 Bannir
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
