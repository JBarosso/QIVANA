import { useState, useEffect } from 'react';
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

    const onGameQuestion = () => {
      // Le jeu a démarré, rediriger vers la page de jeu
      console.log('🎮 Game started, redirecting to play page');
      window.location.href = `/duel/play?room=${roomId}&salon=${salonId}`;
    };

    socket.on('game:question', onGameQuestion);

    return () => {
      socket.off('game:question', onGameQuestion);
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
      // Récupérer les questions depuis Supabase
      const formData = new FormData();
      formData.append('salon_id', salonId);

      const response = await fetch(`/api/duel/start`, {
        method: 'POST',
        body: formData,
      });

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

      // Démarrer le jeu via Socket.IO
      socket.emit('game:start', {
        questions: socketQuestions,
      });
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
          ? 'Démarrage...'
          : `Démarrer le duel (${currentPlayersCount} joueur${currentPlayersCount > 1 ? 's' : ''})`}
      </button>
      {error && (
        <p style={{ color: '#EF4444', marginTop: '0.5rem', fontSize: '0.875rem' }}>
          {error}
        </p>
      )}
      {currentPlayersCount < minPlayers && (
        <p style={{ color: '#FACC15', marginTop: '0.5rem', fontSize: '0.875rem' }}>
          Minimum {minPlayers} joueurs requis
        </p>
      )}
    </div>
  );
}
