// ============================================
// DUEL PLAYER BATTLE ROYAL - Mode compétitif avec vies
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketIO } from '../../lib/useSocketIO';
import type {
  GameQuestionEvent,
  GameAnswerResult,
  GameScoresUpdate,
} from '../../lib/socket';

interface DuelPlayerBattleRoyalProps {
  roomId: string;
  salonId?: string;
  salonName: string;
  currentUserId: string;
  currentUserPseudo: string;
  isChef: boolean;
  initialLives?: number; // Nombre de vies initiales (défaut: 10)
}

interface PlayerLives {
  [userId: string]: {
    lives: number;
    pseudo: string;
    eliminated_at?: string;
    rank?: number;
  };
}

interface Target {
  userId: string;
  pseudo: string;
  lives: number;
}

export default function DuelPlayerBattleRoyal({
  roomId,
  salonId,
  salonName,
  currentUserId,
  currentUserPseudo,
  isChef,
  initialLives = 10,
}: DuelPlayerBattleRoyalProps) {
  const { socket, isConnected } = useSocketIO();
  
  // États du jeu classique
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestionEvent | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [scores, setScores] = useState<GameScoresUpdate['scores']>([]);
  const [isWaitingForQuestion, setIsWaitingForQuestion] = useState(true);
  const [canAdvance, setCanAdvance] = useState(false);
  const [questionExplanation, setQuestionExplanation] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnsweredRef = useRef(false);

  // États Battle Royal spécifiques
  const [playerLives, setPlayerLives] = useState<PlayerLives>({});
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<1 | 2 | 3 | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [availableTargets, setAvailableTargets] = useState<Target[]>([]);
  const [eliminatedPlayers, setEliminatedPlayers] = useState<string[]>([]);
  const [isEliminated, setIsEliminated] = useState(false);
  const [isHealQuestion, setIsHealQuestion] = useState(false);
  const [damageAnimation, setDamageAnimation] = useState<{targetId: string; damage: number} | null>(null);
  const [healAnimation, setHealAnimation] = useState<{targetId: string; amount: number} | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Rejoindre la room au montage
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('⏳ Waiting for Socket.IO connection...');
      return;
    }

    console.log('🎮 Joining room for Battle Royal:', roomId);

    // Écouter les événements Battle Royal
    const onChooseDifficultyPrompt = () => {
      console.log('⚔️ Choose difficulty prompt received');
      setShowDifficultyModal(true);
      setSelectedDifficulty(null);
    };

    const onChooseTargetPrompt = (data: { targets: Target[] }) => {
      console.log('🎯 Choose target prompt received:', data);
      if (isCorrect && !isEliminated) {
        setAvailableTargets(data.targets);
        setShowTargetModal(true);
      }
    };

    const onLivesUpdate = (data: { playerLives: PlayerLives }) => {
      console.log('❤️ Lives update received:', data.playerLives);
      setPlayerLives(data.playerLives);
      
      // Vérifier si le joueur actuel est éliminé
      const currentPlayer = data.playerLives[currentUserId];
      if (currentPlayer && currentPlayer.lives <= 0 && !isEliminated) {
        setIsEliminated(true);
        console.log('💀 Player eliminated');
      }
    };

    const onDamageDealt = (data: { attackerId: string; targetId: string; damage: number }) => {
      console.log('⚔️ Damage dealt:', data);
      setDamageAnimation({ targetId: data.targetId, damage: data.damage });
      setTimeout(() => setDamageAnimation(null), 1000);
    };

    const onPlayerEliminated = (data: { userId: string; rank: number }) => {
      console.log('💀 Player eliminated:', data);
      setEliminatedPlayers((prev) => [...prev, data.userId]);
    };

    const onHealQuestion = (data: { questionIndex: number }) => {
      console.log('💚 Heal question:', data);
      setIsHealQuestion(true);
    };

    const onHealAnimation = (data: { targetId: string; amount: number }) => {
      console.log('💚 Heal animation:', data);
      setHealAnimation({ targetId: data.targetId, amount: data.amount });
      setTimeout(() => setHealAnimation(null), 1000);
    };

    const onGameOver = (data: { rankings: Array<{playerId: string; rank: number; pseudo: string; lives: number}> }) => {
      console.log('🏁 Battle Royal game over:', data);
      // Rediriger vers les résultats
      const resultsUrl = salonId 
        ? `/duel/results?salon=${salonId}`
        : `/duel/results?room=${roomId}`;
      window.location.href = resultsUrl;
    };

    // Écouter les événements de jeu classiques
    const onQuestion = (data: GameQuestionEvent) => {
      console.log('❓ New question received:', data);
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setIsCorrect(false);
      setTimeRemaining(data.timerDuration);
      setPointsEarned(0);
      setIsWaitingForQuestion(false);
      setCanAdvance(false);
      setQuestionExplanation(data.question.explanation || null);
      isAnsweredRef.current = false;
      setCurrentQuestionIndex(data.questionIndex);
      setSelectedDifficulty(null); // Réinitialiser pour forcer le choix avant la nouvelle question
      setShowTargetModal(false); // Fermer le modal de cible si ouvert
      
      // Vérifier si c'est une question de soin (toutes les 3 questions, à partir de la 3e)
      // Questions 2, 5, 8... (index 2, 5, 8...)
      if (data.questionIndex > 0 && (data.questionIndex + 1) % 3 === 0) {
        setIsHealQuestion(true);
      } else {
        setIsHealQuestion(false);
      }
      
      // Démarrer le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      const currentQuestionIndex = data.questionIndex;
      
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            if (!isAnsweredRef.current && socket) {
              console.log('⏱️ Timer expired, sending automatic answer with 0 points');
              isAnsweredRef.current = true;
              setIsAnswered(true);
              setIsCorrect(false);
              setPointsEarned(0);
              
              socket.emit('game:answer', {
                questionIndex: currentQuestionIndex,
                selectedIndex: -1,
                timeRemaining: 0,
              });
              
              // Note: La perte de PV est gérée automatiquement par le serveur
              
              if (isChef) {
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
      
      // Note: La perte de PV est gérée automatiquement par le serveur
      // Le serveur émet deathmatch:lives-update après avoir traité la réponse
    };

    const onScoresUpdate = (data: GameScoresUpdate) => {
      console.log('🏆 Scores updated:', data.scores);
      setScores(data.scores);
    };

    const onAllAnswered = () => {
      console.log('✅ All players answered or timer expired');
      setCanAdvance(true);
    };

    const onGameError = (data: { message: string }) => {
      console.error('❌ Game error:', data.message);
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: `Erreur: ${data.message}`, type: 'error' } 
      }));
    };

    // Configurer tous les listeners
    socket.on('deathmatch:choose-difficulty-prompt', onChooseDifficultyPrompt);
    socket.on('deathmatch:choose-target-prompt', onChooseTargetPrompt);
    socket.on('deathmatch:lives-update', onLivesUpdate);
    socket.on('deathmatch:damage-dealt', onDamageDealt);
    socket.on('deathmatch:player-eliminated', onPlayerEliminated);
    socket.on('deathmatch:heal-question', onHealQuestion);
    socket.on('deathmatch:heal-animation', onHealAnimation);
    socket.on('deathmatch:game-over', onGameOver);
    socket.on('game:question', onQuestion);
    socket.on('game:answer-result', onAnswerResult);
    socket.on('game:scores-update', onScoresUpdate);
    socket.on('game:all-answered', onAllAnswered);
    socket.on('game:error', onGameError);

    // Rejoindre la room
    socket.emit('room:join', {
      roomId: roomId,
      playerId: currentUserId,
      pseudo: currentUserPseudo,
    });

    // Cleanup
    return () => {
      if (socket) {
        socket.off('deathmatch:choose-difficulty-prompt', onChooseDifficultyPrompt);
        socket.off('deathmatch:choose-target-prompt', onChooseTargetPrompt);
        socket.off('deathmatch:lives-update', onLivesUpdate);
        socket.off('deathmatch:damage-dealt', onDamageDealt);
        socket.off('deathmatch:player-eliminated', onPlayerEliminated);
        socket.off('deathmatch:heal-question', onHealQuestion);
        socket.off('deathmatch:heal-animation', onHealAnimation);
        socket.off('deathmatch:game-over', onGameOver);
        socket.off('game:question', onQuestion);
        socket.off('game:answer-result', onAnswerResult);
        socket.off('game:scores-update', onScoresUpdate);
        socket.off('game:all-answered', onAllAnswered);
        socket.off('game:error', onGameError);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [socket, isConnected, roomId, currentUserId, currentUserPseudo, isChef, selectedDifficulty, isCorrect, isEliminated, salonId]);

  // Gérer le choix de difficulté
  const handleDifficultySelect = useCallback((difficulty: 1 | 2 | 3) => {
    if (!socket) return;
    
    setSelectedDifficulty(difficulty);
    setShowDifficultyModal(false);
    
    socket.emit('deathmatch:choose-difficulty', {
      difficulty,
    });
    
    console.log('⚔️ Difficulty selected:', difficulty);
  }, [socket]);

  // Gérer la réponse
  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (isAnswered || isAnsweredRef.current || !currentQuestion || !socket || isEliminated) return;
      
      // En Battle Royal, le serveur gère le choix de difficulté via le modal
      // On ne bloque plus ici car le modal doit être affiché AVANT la question
      // Si le joueur n'a pas choisi, c'est que le modal n'a pas été affiché correctement
      
      isAnsweredRef.current = true;
      setIsAnswered(true);

      console.log('📤 Sending answer:', answerIndex, 'with difficulty:', selectedDifficulty);

      socket.emit('game:answer', {
        questionIndex: currentQuestion.questionIndex,
        selectedIndex: answerIndex,
        timeRemaining: timeRemaining,
      });

      setSelectedAnswer(answerIndex);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    [isAnswered, currentQuestion, timeRemaining, socket, selectedDifficulty, isEliminated]
  );

  // Gérer l'attaque d'un joueur
  const handleAttack = useCallback((targetId: string) => {
    if (!socket || !selectedDifficulty) return;
    
    console.log('⚔️ Attacking player:', targetId, 'with damage:', selectedDifficulty);
    
    socket.emit('deathmatch:attack-player', {
      targetId,
      damage: selectedDifficulty,
    });
    
    setShowTargetModal(false);
    setSelectedDifficulty(null); // Reset pour la prochaine question
  }, [socket, selectedDifficulty]);

  // Passer à la question suivante (chef only)
  const handleNextQuestion = useCallback(() => {
    if (!isChef || !socket) return;

    console.log('➡️ Next question requested');
    socket.emit('game:next-question');
    setSelectedDifficulty(null); // Reset pour la prochaine question
  }, [isChef, socket]);

  if (!isConnected) {
    return (
      <div className="duel-player">
        <p className="duel-player__error">Connexion au serveur en cours...</p>
      </div>
    );
  }

  // État de chargement
  if (isWaitingForQuestion || !currentQuestion) {
    return (
      <div className="duel-player">
        <div className="duel-player__loading">
          <p>⏳ En attente de la première question...</p>
          <p className="duel-player__waiting-hint">
            Le jeu va démarrer dans quelques instants.
          </p>
        </div>
      </div>
    );
  }

  const showResult = isAnswered;
  const alivePlayers = Object.entries(playerLives).filter(([userId, data]) => data.lives > 0);

  return (
    <div className="duel-player duel-player--battle-royal">
      {/* Barre de vies de tous les joueurs */}
      <div className="battle-royal__lives-bar">
        <h3 className="battle-royal__lives-title">❤️ Vies des joueurs</h3>
        <div className="battle-royal__lives-list">
          {Object.entries(playerLives).map(([userId, data]) => {
            const isCurrentUser = userId === currentUserId;
            const isEliminatedPlayer = data.lives <= 0;
            const isDamaged = damageAnimation?.targetId === userId;
            const isHealed = healAnimation?.targetId === userId;
            
            return (
              <div
                key={userId}
                className={`battle-royal__life-item ${
                  isCurrentUser ? 'battle-royal__life-item--current' : ''
                } ${isEliminatedPlayer ? 'battle-royal__life-item--eliminated' : ''} ${
                  isDamaged ? 'battle-royal__life-item--damaged' : ''
                } ${isHealed ? 'battle-royal__life-item--healed' : ''}`}
              >
                <div className="battle-royal__life-header">
                  <span className="battle-royal__life-name">
                    {data.pseudo} {isCurrentUser ? '(Vous)' : ''}
                  </span>
                  <span className="battle-royal__life-count">
                    {Math.max(0, data.lives)} / {initialLives}
                  </span>
                </div>
                <div className="battle-royal__life-bar">
                  <div
                    className="battle-royal__life-fill"
                    style={{
                      width: `${(Math.max(0, data.lives) / initialLives) * 100}%`,
                    }}
                  />
                </div>
                {isDamaged && (
                  <div className="battle-royal__damage-indicator">
                    -{damageAnimation?.damage}
                  </div>
                )}
                {isHealed && (
                  <div className="battle-royal__heal-indicator">
                    +{healAnimation?.amount}
                  </div>
                )}
                {isEliminatedPlayer && (
                  <div className="battle-royal__eliminated-badge">💀 Éliminé</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode spectateur si éliminé */}
      {isEliminated && (
        <div className="battle-royal__spectator-mode">
          <div className="battle-royal__spectator-message">
            <h2>💀 Tu es éliminé !</h2>
            <p>Tu peux continuer à regarder la partie jusqu'à la fin.</p>
          </div>
        </div>
      )}

      {/* Modal choix difficulté */}
      {showDifficultyModal && !isEliminated && (
        <div className="battle-royal__modal-overlay">
          <div className="battle-royal__modal battle-royal__modal--difficulty">
            <h3 className="battle-royal__modal-title">Choisis ta difficulté</h3>
            <p className="battle-royal__modal-subtitle">
              Plus la difficulté est élevée, plus tu peux infliger de dégâts, mais tu risques aussi d'en perdre plus !
            </p>
            <div className="battle-royal__difficulty-options">
              <button
                className="battle-royal__difficulty-btn battle-royal__difficulty-btn--easy"
                onClick={() => handleDifficultySelect(1)}
              >
                <span className="battle-royal__difficulty-label">+1</span>
                <span className="battle-royal__difficulty-desc">Facile</span>
                <span className="battle-royal__difficulty-risk">Risque: -1 PV</span>
              </button>
              <button
                className="battle-royal__difficulty-btn battle-royal__difficulty-btn--medium"
                onClick={() => handleDifficultySelect(2)}
              >
                <span className="battle-royal__difficulty-label">+2</span>
                <span className="battle-royal__difficulty-desc">Moyen</span>
                <span className="battle-royal__difficulty-risk">Risque: -2 PV</span>
              </button>
              <button
                className="battle-royal__difficulty-btn battle-royal__difficulty-btn--hard"
                onClick={() => handleDifficultySelect(3)}
              >
                <span className="battle-royal__difficulty-label">+3</span>
                <span className="battle-royal__difficulty-desc">Difficile</span>
                <span className="battle-royal__difficulty-risk">Risque: -3 PV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sélection cible */}
      {showTargetModal && !isEliminated && (
        <div className="battle-royal__modal-overlay">
          <div className="battle-royal__modal battle-royal__modal--target">
            <h3 className="battle-royal__modal-title">Choisis ta cible</h3>
            <p className="battle-royal__modal-subtitle">
              Qui veux-tu attaquer ? Tu infligeras {selectedDifficulty} dégâts.
            </p>
            <div className="battle-royal__target-list">
              {availableTargets.map((target) => (
                <button
                  key={target.userId}
                  className="battle-royal__target-btn"
                  onClick={() => handleAttack(target.userId)}
                >
                  <span className="battle-royal__target-name">{target.pseudo}</span>
                  <span className="battle-royal__target-lives">❤️ {target.lives} PV</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Indicateur question de soin */}
      {isHealQuestion && (
        <div className="battle-royal__heal-banner">
          💚 Question bonus de soin ! Réponds correctement pour regagner +5 PV
        </div>
      )}

      <header className="duel-player__header">
        <div className="duel-player__header-top">
          <h1 className="duel-player__title">{salonName}</h1>
          <span className="duel-player__mode-badge">⚔️ Battle Royal</span>
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
              disabled={isAnswered || isEliminated}
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
          {isCorrect && isHealQuestion && (
            <p className="duel-player__result-heal">💚 +5 PV regagnés !</p>
          )}
          {questionExplanation && (
            <div className="duel-player__result-explanation">
              <strong>💡 Explication :</strong>
              <p>{questionExplanation}</p>
            </div>
          )}
        </div>
      )}

      {isChef && isAnswered && (
        <div className="duel-player__actions">
          <button
            className="duel-player__next-btn"
            onClick={handleNextQuestion}
            disabled={!canAdvance}
            title={!canAdvance ? 'En attente : tous les joueurs doivent répondre ou le timer doit être terminé' : ''}
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
