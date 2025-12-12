import { useEffect, useState, useMemo } from 'react';
import { useSocketIO } from '../../lib/useSocketIO';
import type { RoomSettings, Player } from '../../lib/socket';
import '../../styles/components/LobbyRealtime.scss';

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

    console.log('🎮 Joining room:', roomId);

    // Rejoindre la room
    socket.emit('room:join', {
      roomId: roomId,
      playerId: currentUserId,
      pseudo: currentUserPseudo,
    });

    // Écouter les événements de room
    const onRoomJoined = (data: { room: RoomSettings }) => {
      console.log('✅ Room joined:', data.room);
      setRoom(data.room);
      setIsLoading(false);
      setError(null);
    };

    const onPlayerJoined = (data: { player: Player; room: RoomSettings }) => {
      console.log('👤 Player joined:', data.player.pseudo);
      setRoom(data.room);
    };

    const onPlayerLeft = (data: { playerId: string; room: RoomSettings }) => {
      console.log('👋 Player left:', data.playerId);
      setRoom(data.room);
    };

    const onRoomError = (data: { message: string }) => {
      console.error('❌ Room error:', data.message);
      setError(data.message);
      setIsLoading(false);
    };

    const onKicked = (data: { roomId: string; reason?: string }) => {
      console.log('👢 Kicked from room:', data.roomId);
      alert('Vous avez été expulsé du salon par le chef.');
      window.location.href = '/';
    };

    socket.on('room:joined', onRoomJoined);
    socket.on('room:player-joined', onPlayerJoined);
    socket.on('room:player-left', onPlayerLeft);
    socket.on('room:error', onRoomError);
    socket.on('room:kicked', onKicked);

    // Cleanup
    return () => {
      if (socket) {
        socket.off('room:joined', onRoomJoined);
        socket.off('room:player-joined', onPlayerJoined);
        socket.off('room:player-left', onPlayerLeft);
        socket.off('room:error', onRoomError);
        socket.off('room:kicked', onKicked);

        // Quitter la room au démontage
        socket.emit('room:leave');
      }
    };
  }, [socket, isConnected, roomId, currentUserId, currentUserPseudo]);

  // Fonction pour expulser un joueur
  const handleKickPlayer = async (playerId: string, playerPseudo: string) => {
    if (!socket || !isChef) {
      return;
    }

    if (!confirm(`Expulser ${playerPseudo} du salon ?`)) {
      return;
    }

    console.log('🗑️ Kicking player:', playerId);

    socket.emit('room:kick-player', {
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
        <p className="lobby-realtime__empty" style={{ color: '#EF4444' }}>
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
              {/* Bouton d'expulsion (chef only, pas sur lui-même) */}
              {isChef && !isParticipantLeader && (
                <button
                  className="lobby-realtime__kick-btn"
                  onClick={() => handleKickPlayer(participant.id, participant.pseudo)}
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
