import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketIO } from '../../lib/useSocketIO';
import type {
  GameQuestionEvent,
  GameAnswerResult,
  GameScoresUpdate,
  GameEnd,
} from '../../lib/socket';
import '../../styles/components/DuelPlayer.scss';

interface DuelPlayerSocketIOProps {
  roomId: string;
  salonId?: string; // ID du salon Supabase pour la redirection vers results
  salonName: string;
  currentUserId: string;
  currentUserPseudo: string;
  isChef: boolean;
}

export default function DuelPlayerSocketIO({
  roomId,
  salonId,
  salonName,
  currentUserId,
  currentUserPseudo,
  isChef,
}: DuelPlayerSocketIOProps) {
  const { socket, isConnected } = useSocketIO();
  
  // État du jeu
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestionEvent | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [scores, setScores] = useState<GameScoresUpdate['scores']>([]);
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);
  const [isWaitingForQuestion, setIsWaitingForQuestion] = useState(true);
  const [canAdvance, setCanAdvance] = useState(false); // Peut-on passer à la question suivante ?
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnsweredRef = useRef(false); // Ref pour suivre si on a répondu (pour le timer)

  // Rejoindre la room au montage
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('⏳ Waiting for Socket.IO connection...');
      return;
    }

    console.log('🎮 Joining room for game:', roomId);

    // ⚠️ IMPORTANT : Configurer TOUS les listeners AVANT de rejoindre la room
    // pour ne pas manquer les événements qui arrivent immédiatement
    
    // Écouter les événements de jeu
    const onQuestion = (data: GameQuestionEvent) => {
      console.log('❓ New question received:', data);
      console.log('📋 Question details:', {
        id: data.question.id,
        question: data.question.question.substring(0, 50) + '...',
        choicesCount: data.question.choices.length,
        questionIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
      });
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setIsCorrect(false);
      setTimeRemaining(data.timerDuration);
      setPointsEarned(0);
      setIsWaitingForQuestion(false);
      setCanAdvance(false); // Reset : on ne peut pas avancer tant que tous n'ont pas répondu ou que le timer n'est pas terminé
      isAnsweredRef.current = false; // Reset la ref
      
      console.log('📋 New question received, canAdvance reset to false');
      
      // Démarrer le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Stocker la questionIndex dans une variable locale pour le timer
      const currentQuestionIndex = data.questionIndex;
      
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            // ⚠️ IMPORTANT : Si le timer expire et que le joueur n'a pas répondu, envoyer automatiquement 0 point
            if (!isAnsweredRef.current && socket) {
              console.log('⏱️ Timer expired, sending automatic answer with 0 points');
              isAnsweredRef.current = true;
              setIsAnswered(true);
              setIsCorrect(false);
              setPointsEarned(0);
              
              // Envoyer une réponse automatique avec l'index -1 (pas de réponse)
              socket.emit('game:answer', {
                questionIndex: currentQuestionIndex,
                selectedIndex: -1, // -1 = pas de réponse
                timeRemaining: 0,
              });
              
              // ⚠️ IMPORTANT : Si on est le chef, vérifier si on peut avancer (timer terminé pour tous)
              // Le serveur vérifiera aussi, mais on peut activer le bouton côté client
              if (isChef) {
                // Attendre un peu pour que tous les joueurs aient envoyé leur réponse (timer expiré)
                setTimeout(() => {
                  setCanAdvance(true);
                }, 1000);
              }
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const onAnswerResult = (data: GameAnswerResult) => {
      console.log('📊 Answer result:', data);
      setIsCorrect(data.isCorrect);
      setPointsEarned(data.pointsEarned);
      setIsAnswered(true);
      
      // Si on est le chef et qu'on a répondu, on peut potentiellement avancer
      // (mais on attend que tous les autres aient répondu ou que le timer soit terminé)
      if (isChef) {
        console.log('👑 Chef answered, waiting for all players or timer expiration');
      }
    };

    const onScoresUpdate = (data: GameScoresUpdate) => {
      console.log('🏆 Scores updated:', data.scores);
      setScores(data.scores);
    };

    const onAllAnswered = (data?: { message?: string }) => {
      console.log('✅ All players answered or timer expired:', data?.message || '');
      // Tous les joueurs ont répondu OU le timer est terminé, on peut avancer
      setCanAdvance(true);
      console.log('✅ canAdvance set to true');
    };

    const onGameEnd = (data: GameEnd) => {
      console.log('🎉 Game ended:', data);
      // Rediriger vers les résultats avec salonId si disponible, sinon roomId
      const resultsUrl = salonId 
        ? `/duel/results?salon=${salonId}`
        : `/duel/results?room=${roomId}`;
      window.location.href = resultsUrl;
    };

    const onGameError = (data: { message: string }) => {
      console.error('❌ Game error:', data.message);
      alert(`Erreur: ${data.message}`);
    };

    // Écouter room:joined pour savoir quand on a rejoint
    const onRoomJoined = (data: { room: any }) => {
      console.log('✅ Room joined for game:', data.room);
      // Si un jeu est en cours, le serveur devrait envoyer game:question automatiquement
    };

    // ⚠️ CRITIQUE : Configurer TOUS les listeners AVANT de rejoindre la room
    socket.on('game:question', onQuestion);
    socket.on('game:answer-result', onAnswerResult);
    socket.on('game:scores-update', onScoresUpdate);
    socket.on('game:all-answered', onAllAnswered);
    socket.on('game:end', onGameEnd);
    socket.on('game:error', onGameError);
    socket.once('room:joined', onRoomJoined);

    // Maintenant qu'on a configuré TOUS les listeners, rejoindre la room
    socket.emit('room:join', {
      roomId: roomId,
      playerId: currentUserId,
      pseudo: currentUserPseudo,
    });

    // Cleanup
    return () => {
      if (socket) {
        socket.off('game:question', onQuestion);
        socket.off('game:answer-result', onAnswerResult);
        socket.off('game:scores-update', onScoresUpdate);
        socket.off('game:all-answered', onAllAnswered);
        socket.off('game:end', onGameEnd);
        socket.off('game:error', onGameError);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [socket, isConnected, roomId, currentUserId, currentUserPseudo]);

  // Gérer la réponse
  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (isAnswered || isAnsweredRef.current || !currentQuestion || !socket) return;
      
      // Désactiver immédiatement pour éviter les double-clics
      isAnsweredRef.current = true;
      setIsAnswered(true);

      console.log('📤 Sending answer:', answerIndex);

      socket.emit('game:answer', {
        questionIndex: currentQuestion.questionIndex,
        selectedIndex: answerIndex,
        timeRemaining: timeRemaining,
      });

      setSelectedAnswer(answerIndex);
      
      // Arrêter le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    [isAnswered, currentQuestion, timeRemaining, socket]
  );

  // Passer à la question suivante (chef only)
  const handleNextQuestion = useCallback(() => {
    if (!isChef || !socket) {
      console.log('❌ Cannot advance: isChef=', isChef, 'socket=', !!socket);
      return;
    }

    // ⚠️ IMPORTANT : Si canAdvance est false, on essaie quand même d'envoyer l'événement
    // Le serveur vérifiera de toute façon si on peut avancer
    // Cela permet de gérer le cas où l'événement game:all-answered n'a pas été reçu
    if (!canAdvance) {
      console.log('⚠️ canAdvance is false, but trying anyway (server will validate)');
    }

    console.log('➡️ Next question requested');
    socket.emit('game:next-question');
  }, [isChef, socket, canAdvance]);

  if (!isConnected) {
    return (
      <div className="duel-player">
        <p className="duel-player__error">Connexion au serveur en cours...</p>
      </div>
    );
  }

  // État de chargement : attendre la première question
  if (isWaitingForQuestion || !currentQuestion) {
    return (
      <div className="duel-player">
        <div className="duel-player__loading">
          <p>⏳ En attente de la première question...</p>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginTop: '0.5rem' }}>
            Le jeu va démarrer dans quelques instants.
          </p>
        </div>
      </div>
    );
  }

  const showResult = isAnswered;

  return (
    <div className="duel-player">
      <header className="duel-player__header">
        <div className="duel-player__header-top">
          <h1 className="duel-player__title">{salonName}</h1>
          {isChef && (
            <button
              className="duel-player__players-btn"
              onClick={() => setShowPlayersPanel(!showPlayersPanel)}
              title="Voir les participants"
            >
              👥 {scores.length}
            </button>
          )}
        </div>
        <div className="duel-player__progress">
          <span className="duel-player__progress-text">
            Question {currentQuestion.questionIndex + 1} / {currentQuestion.totalQuestions}
          </span>
          <div className="duel-player__progress-bar">
            <div
              className="duel-player__progress-fill"
              style={{
                width: `${((currentQuestion.questionIndex + 1) / currentQuestion.totalQuestions) * 100}%`,
              }}
            />
          </div>
        </div>
      </header>

      {/* Panneau des scores (chef uniquement) */}
      {isChef && showPlayersPanel && (
        <div className="duel-player__players-panel">
          <h3 className="duel-player__players-panel-title">Classement</h3>
          <ul className="duel-player__players-list">
            {scores.map((score, index) => (
              <li key={score.playerId} className="duel-player__player-item">
                <span className="duel-player__player-name">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`} {score.pseudo}
                </span>
                <span className="duel-player__player-status">{score.score.toFixed(2)} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="duel-player__question">
        <div className="duel-player__question-header">
          <span className="duel-player__question-difficulty">
            {currentQuestion.question.difficulty}
          </span>
          <span className="duel-player__question-universe">
            {currentQuestion.question.universe}
          </span>
          <span className="duel-player__question-timer">
            ⏱️ {timeRemaining}s
          </span>
        </div>
        <h2 className="duel-player__question-text">{currentQuestion.question.question}</h2>
      </div>

      <div className="duel-player__answers">
        {currentQuestion.question.choices.map((choice, index) => {
          const isSelected = selectedAnswer === index;
          const showCorrect = showResult && isSelected;
          
          return (
            <button
              key={index}
              className={`duel-player__answer ${
                isSelected ? 'duel-player__answer--selected' : ''
              } ${showCorrect ? (isCorrect ? 'duel-player__answer--correct' : 'duel-player__answer--incorrect') : ''}`}
              onClick={() => handleAnswer(index)}
              disabled={isAnswered}
            >
              <span className="duel-player__answer-letter">
                {String.fromCharCode(65 + index)}.
              </span>
              <span className="duel-player__answer-text">{choice}</span>
            </button>
          );
        })}
      </div>

      {showResult && (
        <div className="duel-player__result">
          <p className="duel-player__result-text">
            {isCorrect ? '✅ Correct !' : '❌ Incorrect'}
          </p>
          <p className="duel-player__result-points">
            +{pointsEarned.toFixed(2)} points
          </p>
        </div>
      )}

      {isChef && isAnswered && (
        <div className="duel-player__actions">
          <button
            className="duel-player__next-btn"
            onClick={handleNextQuestion}
            // Ne pas désactiver le bouton : le serveur validera de toute façon
            // disabled={!canAdvance}
            title={!canAdvance ? 'En attente : tous les joueurs doivent répondre ou le timer doit être terminé (le serveur validera)' : ''}
            style={!canAdvance ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            {currentQuestion && currentQuestion.questionIndex < currentQuestion.totalQuestions - 1
              ? 'Question Suivante ➡️'
              : 'Voir les résultats 🎯'}
          </button>
        </div>
      )}
    </div>
  );
}
