import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocketConnection } from './socket';

/**
 * Instance partagée du socket (réutilisée par tous les composants)
 */
let globalSocketInstance: Socket | null = null;

/**
 * Hook React pour gérer la connexion Socket.IO
 * ⚠️ IMPORTANT : Utilise une instance partagée pour tous les composants
 */
export function useSocketIO() {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    // Utiliser l'instance partagée ou en créer une nouvelle
    if (!globalSocketInstance) {
      globalSocketInstance = createSocketConnection();
    }

    const socket = globalSocketInstance;

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

    // Si déjà connecté, mettre à jour l'état immédiatement
    if (socket.connected) {
      onConnect();
    }

    // Cleanup : ne pas déconnecter, juste retirer les listeners de ce composant
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return {
    socket: globalSocketInstance,
    isConnected,
    socketId,
  };
}
