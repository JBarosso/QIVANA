import { createSocketConnection } from './socket';
import type { RoomSettings } from './socket';

/**
 * Types pour les événements Socket.IO de création de room
 */
interface RoomCreatedEvent {
  room: RoomSettings;
}

interface RoomErrorEvent {
  message: string;
}

/**
 * Crée une room Socket.IO depuis le frontend
 * Note: Normalement, la room devrait être créée côté serveur,
 * mais pour l'instant on la crée depuis le client pour simplifier
 */
export async function createSocketRoom(
  roomId: string,
  settings: {
    name: string;
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
  }
): Promise<{ success: boolean; room?: RoomSettings; error?: string }> {
  return new Promise((resolve) => {
    const socket = createSocketConnection();

    socket.on('connect', () => {
      socket.emit('room:create', {
        name: settings.name,
        mode: settings.mode,
        universe: settings.universe,
        difficulty: settings.difficulty,
        questionCount: settings.questionCount,
        timerSeconds: settings.timerSeconds,
        timerEnabled: settings.timerEnabled,
        stepByStepMode: settings.stepByStepMode,
        isPrivate: settings.isPrivate,
        leaderId: settings.leaderId,
        leaderPseudo: settings.leaderPseudo,
      });
    });

    socket.on('room:created', (data: RoomCreatedEvent) => {
      socket.disconnect();
      resolve({ success: true, room: data.room });
    });

    socket.on('room:error', (error: RoomErrorEvent) => {
      socket.disconnect();
      resolve({ success: false, error: error.message });
    });

    // Timeout après 5 secondes
    setTimeout(() => {
      socket.disconnect();
      resolve({ success: false, error: 'Timeout lors de la création de la room' });
    }, 5000);
  });
}
