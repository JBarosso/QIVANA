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
  salonName: string;
  currentUserId: string;
  currentUserPseudo: string;
  isChef: boolean;
}

export default function DuelPlayerSocketIO({
  roomId,
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Rejoindre la room au montage
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('⏳ Waiting for Socket.IO connection...');
      return;
    }

    console.log('🎮 Joining room for game:', roomId);

    // Rejoindre la room
    socket.emit('room:join', {
      roomId: roomId,
      playerId: currentUserId,
      pseudo: currentUserPseudo,
    });

    // Écouter les événements de jeu
    const onQuestion = (data: GameQuestionEvent) => {
      console.log('❓ New question received:', data);
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setIsCorrect(false);
      setTimeRemaining(data.timerDuration);
      setPointsEarned(0);
      
      // Démarrer le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
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
    };

    const onScoresUpdate = (data: GameScoresUpdate) => {
      console.log('🏆 Scores updated:', data.scores);
      setScores(data.scores);
    };

    const onAllAnswered = () => {
      console.log('✅ All players answered');
    };

    const onGameEnd = (data: GameEnd) => {
      console.log('🎉 Game ended:', data);
      // Rediriger vers les résultats
      window.location.href = `/duel/results?room=${roomId}`;
    };

    const onGameError = (data: { message: string }) => {
      console.error('❌ Game error:', data.message);
      alert(`Erreur: ${data.message}`);
    };

    socket.on('game:question', onQuestion);
    socket.on('game:answer-result', onAnswerResult);
    socket.on('game:scores-update', onScoresUpdate);
    socket.on('game:all-answered', onAllAnswered);
    socket.on('game:end', onGameEnd);
    socket.on('game:error', onGameError);

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
      if (isAnswered || !currentQuestion || !socket) return;

      console.log('📤 Sending answer:', answerIndex);

      socket.emit('game:answer', {
        questionIndex: currentQuestion.questionIndex,
        selectedIndex: answerIndex,
        timeRemaining: timeRemaining,
      });

      setSelectedAnswer(answerIndex);
    },
    [isAnswered, currentQuestion, timeRemaining, socket]
  );

  // Passer à la question suivante (chef only)
  const handleNextQuestion = useCallback(() => {
    if (!isChef || !socket) return;

    console.log('➡️ Next question');
    socket.emit('game:next-question');
  }, [isChef, socket]);

  if (!isConnected) {
    return (
      <div className="duel-player">
        <p className="duel-player__error">Connexion au serveur en cours...</p>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="duel-player">
        <p className="duel-player__error">En attente de la première question...</p>
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
          >
            Question Suivante ➡️
          </button>
        </div>
      )}
    </div>
  );
}
