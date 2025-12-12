import { io, Socket } from 'socket.io-client';

/**
 * URL du serveur Socket.IO
 * Utilise la variable d'environnement ou localhost par défaut
 */
const getSocketUrl = (): string => {
  const envUrl = import.meta.env.VITE_SOCKET_IO_URL;
  if (envUrl) {
    return envUrl;
  }
  // Fallback sur localhost en développement
  return 'http://localhost:3001';
};

/**
 * Crée une connexion Socket.IO
 */
export function createSocketConnection(): Socket {
  const url = getSocketUrl();
  
  const socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ Socket.IO connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.IO disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket.IO connection error:', error);
  });

  return socket;
}

/**
 * Types pour les événements Socket.IO
 */
export interface RoomSettings {
  roomId: string;
  name: string;
  mode: 'db' | 'ai';
  universe?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount: number;
  timerSeconds: number;
  timerEnabled: boolean;
  stepByStepMode: boolean;
  leaderId: string;
  players: Player[];
  bannedPlayers?: string[]; // Liste des IDs de joueurs bannis
}

export interface Player {
  id: string;
  pseudo: string;
  socketId: string;
}

export interface Question {
  id: string;
  question: string;
  choices: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  universe: string;
}

export interface GameQuestionEvent {
  question: {
    id: string;
    question: string;
    choices: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    universe: string;
  };
  questionIndex: number;
  totalQuestions: number;
  timerDuration: number;
}

export interface GameAnswerResult {
  isCorrect: boolean;
  pointsEarned: number;
}

export interface GameScoresUpdate {
  scores: Array<{
    playerId: string;
    pseudo: string;
    score: number;
  }>;
}

export interface GameEnd {
  scores: Array<{
    playerId: string;
    pseudo: string;
    score: number;
    rank: number;
  }>;
}
