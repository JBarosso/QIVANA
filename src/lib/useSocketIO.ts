import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createSocketConnection } from './socket';

/**
 * Hook React pour gérer la connexion Socket.IO
 */
export function useSocketIO() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    // Créer la connexion
    const socket = createSocketConnection();
    socketRef.current = socket;

    // Gérer les événements de connexion
    const onConnect = () => {
      setIsConnected(true);
      setSocketId(socket.id || null);
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setSocketId(null);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Si déjà connecté
    if (socket.connected) {
      onConnect();
    }

    // Cleanup
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    socketId,
  };
}
