/**
 * Déclaration de type pour socket.io-client
 * Ce fichier est temporaire si le package n'est pas correctement résolu
 */
declare module 'socket.io-client' {
  import { EventEmitter } from 'events';

  export interface SocketOptions {
    transports?: string[];
    reconnection?: boolean;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
    reconnectionAttempts?: number;
  }

  export interface Socket extends EventEmitter {
    id: string;
    connected: boolean;
    disconnect(): Socket;
    connect(): Socket;
    emit(event: string, ...args: any[]): Socket;
    on(event: string, callback: (...args: any[]) => void): Socket;
    once(event: string, callback: (...args: any[]) => void): Socket;
    off(event: string, callback?: (...args: any[]) => void): Socket;
  }

  export function io(url?: string, options?: SocketOptions): Socket;
}
