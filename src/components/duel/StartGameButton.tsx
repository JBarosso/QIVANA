import { useState, useEffect, useRef } from 'react';
import { useSocketIO } from '../../lib/useSocketIO';
import type { Question as SocketQuestion } from '../../lib/socket';
import type { Question as AstroQuestion } from '../../types';

interface StartGameButtonProps {
  roomId: string;
  salonId: string;
  questionsCount: number;
  universe: string;
  difficulty: 'easy' | 'medium' | 'hard';
  minPlayers: number;
  currentPlayersCount: number;
}

export default function StartGameButton({
  roomId,
  salonId,
  questionsCount,
  universe,
  difficulty,
  minPlayers,
  currentPlayersCount: initialCount,
}: StartGameButtonProps) {
  const { socket, isConnected } = useSocketIO();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayersCount, setCurrentPlayersCount] = useState(initialCount);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Écouter les mises à jour de participants
  useEffect(() => {
    const handleParticipantsUpdate = (event: CustomEvent) => {
      const count = event.detail?.count || 0;
      setCurrentPlayersCount(count);
    };

    window.addEventListener('participants-updated', handleParticipantsUpdate as EventListener);

    return () => {
      window.removeEventListener('participants-updated', handleParticipantsUpdate as EventListener);
    };
  }, []);

  // Écouter la redirection vers le jeu
  useEffect(() => {
    if (!socket) return;

    const onGameQuestion = (data: any) => {
      // Le jeu a démarré, rediriger vers la page de jeu
      console.log('🎮 Game started, received question:', data);
      
      // Nettoyer le timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // ⚠️ IMPORTANT : Garder isLoading à true jusqu'à la redirection pour que le loader reste visible
      // La redirection se fera automatiquement, mais on garde le loader visible pendant la transition
      setTimeout(() => {
        setIsLoading(false);
        window.location.href = `/duel/play?room=${roomId}&salon=${salonId}`;
      }, 100); // Petit délai pour s'assurer que le loader est visible
    };

    socket.on('game:question', onGameQuestion);

    return () => {
      socket.off('game:question', onGameQuestion);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [socket, roomId, salonId]);

  const handleStart = async () => {
    if (!socket || !isConnected) {
      setError('Connexion au serveur en cours...');
      return;
    }

    if (currentPlayersCount < minPlayers) {
      setError(`Il faut au moins ${minPlayers} joueurs pour démarrer`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Vérifier que le socket est dans la room avant de continuer
      console.log('🔍 Verifying socket is in room before starting game...');
      
      // Attendre un peu pour s'assurer que la room est bien créée et que le socket est dedans
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Récupérer les questions depuis Supabase
      // ⚠️ IMPORTANT : Cette étape peut prendre du temps si génération IA nécessaire
      console.log('⏳ Fetching questions from /api/duel/start...');
      const formData = new FormData();
      formData.append('salon_id', salonId);

      const response = await fetch(`/api/duel/start`, {
        method: 'POST',
        body: formData,
      });
      
      console.log('📥 Response received from /api/duel/start:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la récupération des questions');
      }

      const data = await response.json();

      // L'API start retourne les questions complètes
      const astroQuestions: AstroQuestion[] = data.questions || [];

      if (astroQuestions.length === 0) {
        throw new Error('Aucune question disponible');
      }

      // Convertir les questions au format Socket.IO
      const socketQuestions: SocketQuestion[] = astroQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        choices: q.choices,
        correctIndex: q.correct_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
        universe: q.universe,
      }));

      console.log('📤 Starting game with', socketQuestions.length, 'questions');
      console.log('📋 First question sample:', {
        id: socketQuestions[0]?.id,
        question: socketQuestions[0]?.question.substring(0, 50) + '...',
        choicesCount: socketQuestions[0]?.choices.length,
        correctIndex: socketQuestions[0]?.correctIndex,
        choices: socketQuestions[0]?.choices,
      });
      
      // ⚠️ DEBUG : Vérifier que toutes les questions ont un correctIndex valide
      const invalidQuestions = socketQuestions.filter(q => q.correctIndex === undefined || q.correctIndex === null);
      if (invalidQuestions.length > 0) {
        console.error('❌ Questions invalides (pas de correctIndex):', invalidQuestions);
      }

      // Écouter les erreurs de jeu
      const onGameError = (data: { message: string }) => {
        console.error('❌ Game error:', data.message);
        setError(data.message);
        setIsLoading(false);
        socket.off('game:error', onGameError);
      };

      socket.once('game:error', onGameError);

      // Démarrer le jeu via Socket.IO
      // Note: isLoading restera true jusqu'à ce que game:question soit reçu (redirection)
      console.log('📤 Emitting game:start to server...');
      console.log('🔍 Socket ID:', socket.id, 'Room ID:', roomId);
      
      socket.emit('game:start', {
        questions: socketQuestions,
        salonId: salonId, // Passer aussi le salonId pour que le serveur puisse mettre à jour Supabase
      });
      
      console.log('✅ game:start emitted, waiting for game:question...');
      
      // Nettoyer le timeout précédent s'il existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Timeout de sécurité : si aucune question n'arrive dans les 5 secondes, afficher une erreur
      timeoutRef.current = setTimeout(() => {
        setIsLoading((prevLoading) => {
          if (prevLoading) {
            console.error('⏱️ Timeout: No game:question received after 5 seconds');
            setError('Le serveur ne répond pas. Vérifiez votre connexion.');
            return false;
          }
          return prevLoading;
        });
      }, 5000);
    } catch (error) {
      console.error('❌ Error starting game:', error);
      setError(error instanceof Error ? error.message : 'Erreur inconnue');
      setIsLoading(false);
    }
  };

  const isDisabled = !isConnected || isLoading || currentPlayersCount < minPlayers;

  return (
    <div>
      <button
        className="btn btn--primary btn--block"
        onClick={handleStart}
        disabled={isDisabled}
      >
        {isLoading
          ? '⏳ Démarrage...'
          : `Démarrer le duel (${currentPlayersCount} joueur${currentPlayersCount > 1 ? 's' : ''})`}
      </button>
      {isLoading && (
        <div style={{ 
          marginTop: '0.5rem', 
          padding: '0.75rem', 
          background: '#F3F4F6', 
          borderRadius: '4px', 
          fontSize: '0.875rem', 
          color: '#6B7280',
          textAlign: 'center',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}>
          ⏳ Récupération des questions... (Génération IA si nécessaire)
          <br />
          <small style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Cette opération peut prendre quelques secondes...
          </small>
        </div>
      )}
      {error && (
        <p style={{ color: '#EF4444', marginTop: '0.5rem', fontSize: '0.875rem' }}>
          {error}
        </p>
      )}
      {currentPlayersCount < minPlayers && !isLoading && (
        <p style={{ color: '#FACC15', marginTop: '0.5rem', fontSize: '0.875rem' }}>
          Minimum {minPlayers} joueurs requis
        </p>
      )}
    </div>
  );
}
