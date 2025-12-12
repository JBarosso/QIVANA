import { useEffect, useState } from 'react';
import { useSocketIO } from '../../lib/useSocketIO';
import type { RoomSettings } from '../../lib/socket';

interface CreateRoomButtonProps {
  roomId: string;
  salonName: string;
  mode: 'db' | 'ai';
  universe?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount: number;
  timerSeconds: number;
  timerEnabled: boolean;
  stepByStepMode: boolean;
  isPrivate: boolean;
  leaderId: string;
  leaderPseudo: string;
  onRoomCreated?: (room: RoomSettings) => void;
}

export default function CreateRoomButton({
  roomId,
  salonName,
  mode,
  universe,
  difficulty,
  questionCount,
  timerSeconds,
  timerEnabled,
  stepByStepMode,
  isPrivate,
  leaderId,
  leaderPseudo,
  onRoomCreated,
}: CreateRoomButtonProps) {
  const { socket, isConnected } = useSocketIO();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomCreated, setRoomCreated] = useState(false);

  // Créer automatiquement la room au montage
  useEffect(() => {
    if (!socket || !isConnected || roomCreated) {
      return;
    }

    setIsCreating(true);
    setError(null);

    // Écouter la réponse
    const onRoomCreatedHandler = (data: { roomId: string; room: RoomSettings }) => {
      console.log('✅ Room created:', data.room);
      socket.off('room:created', onRoomCreatedHandler);
      socket.off('room:error', onRoomError);
      setIsCreating(false);
      setRoomCreated(true);
      
      // Émettre un événement personnalisé pour notifier que la room est créée
      const event = new CustomEvent('socket-room-created', {
        detail: { roomId: data.roomId, room: data.room },
      });
      window.dispatchEvent(event);
      
      if (onRoomCreated) {
        onRoomCreated(data.room);
      }
    };

    const onRoomError = (data: { message: string }) => {
      console.error('❌ Room creation error:', data.message);
      // Si la room existe déjà, ce n'est pas grave
      if (data.message.includes('existe déjà') || data.message.includes('already exists')) {
        console.log('ℹ️ Room already exists, continuing...');
        setRoomCreated(true);
        setIsCreating(false);
        return;
      }
      socket.off('room:created', onRoomCreatedHandler);
      socket.off('room:error', onRoomError);
      setError(data.message);
      setIsCreating(false);
    };

    socket.once('room:created', onRoomCreatedHandler);
    socket.once('room:error', onRoomError);

    // Créer la room avec le roomId (salon_code de Supabase)
    console.log('📤 Creating Socket.IO room:', roomId);
    socket.emit('room:create', {
      roomId: roomId, // Utiliser le salon_code comme roomId Socket.IO
      name: salonName,
      mode: mode,
      universe: universe,
      difficulty: difficulty,
      questionCount: questionCount,
      timerSeconds: timerSeconds,
      timerEnabled: timerEnabled,
      stepByStepMode: stepByStepMode,
      isPrivate: isPrivate,
      leaderId: leaderId,
      leaderPseudo: leaderPseudo,
    });
  }, [socket, isConnected, roomId, roomCreated, salonName, mode, universe, difficulty, questionCount, timerSeconds, timerEnabled, stepByStepMode, isPrivate, leaderId, leaderPseudo]);

  return null; // Composant silencieux, création automatique
}
