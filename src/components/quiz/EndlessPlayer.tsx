// ============================================
// ENDLESS PLAYER - Mode Duel vs Machine
// ============================================
// Gameplay avec progression de difficulté et système de vies

import { useState, useEffect, useCallback } from 'react';

interface EndlessPlayerProps {
  userId: string;
  userPseudo: string;
}

interface Question {
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
}

type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'intro' | 'playing' | 'loading' | 'gameover';

const INITIAL_LIVES = 10;
const DIFFICULTY_THRESHOLDS = {
  easy: 0,    // Questions 1-5
  medium: 5,  // Questions 6-10
  hard: 10,   // Questions 11+
};

export default function EndlessPlayer({ userId, userPseudo }: EndlessPlayerProps) {
  // États du jeu
  const [gameState, setGameState] = useState<GameState>('intro');
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [score, setScore] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>('easy');
  
  // Question actuelle
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [timerActive, setTimerActive] = useState(false);

  // Highscore
  const [highScore, setHighScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Charger le meilleur score
  useEffect(() => {
    fetchHighScore();
  }, []);

  const fetchHighScore = async () => {
    try {
      const response = await fetch(`/api/quiz/endless-highscore?userId=${userId}`);
      const data = await response.json();
      if (data.highScore) {
        setHighScore(data.highScore);
      }
    } catch (error) {
      console.error('Error fetching highscore:', error);
    }
  };

  // Timer
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, timeRemaining]);

  // Calculer la difficulté en fonction du nombre de questions
  const calculateDifficulty = useCallback((questionsCount: number): Difficulty => {
    if (questionsCount >= DIFFICULTY_THRESHOLDS.hard) return 'hard';
    if (questionsCount >= DIFFICULTY_THRESHOLDS.medium) return 'medium';
    return 'easy';
  }, []);

  // Charger une nouvelle question
  const loadNextQuestion = async () => {
    setGameState('loading');
    setSelectedAnswer(null);
    setShowResult(false);

    const newDifficulty = calculateDifficulty(questionsAnswered);
    setCurrentDifficulty(newDifficulty);

    try {
      const response = await fetch('/api/quiz/endless-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          difficulty: newDifficulty,
          questionNumber: questionsAnswered + 1, // Pour le système de batch
        }),
      });

      const data = await response.json();

      if (data.question) {
        setCurrentQuestion(data.question);
        setTimeRemaining(15);
        setTimerActive(true);
        setGameState('playing');
      } else {
        throw new Error('No question received');
      }
    } catch (error) {
      console.error('Error loading question:', error);
      // Réessayer après 2 secondes
      setTimeout(loadNextQuestion, 2000);
    }
  };

  // Gérer la sélection d'une réponse
  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(index);
    setTimerActive(false);
    setShowResult(true);

    const isCorrect = index === currentQuestion.correct_index;

    if (isCorrect) {
      // Bonus de points basé sur le temps et la difficulté
      const difficultyMultiplier = { easy: 1, medium: 1.5, hard: 2 }[currentDifficulty];
      const timeBonus = Math.floor(timeRemaining * difficultyMultiplier);
      const basePoints = { easy: 10, medium: 15, hard: 25 }[currentDifficulty];
      setScore((prev) => prev + basePoints + timeBonus);
    } else {
      // Perdre une vie
      setLives((prev) => prev - 1);
    }

    setQuestionsAnswered((prev) => prev + 1);
  };

  // Gérer le timeout
  const handleTimeOut = () => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(-1); // Marquer comme non répondu
    setTimerActive(false);
    setShowResult(true);
    setLives((prev) => prev - 1);
    setQuestionsAnswered((prev) => prev + 1);
  };

  // Passer à la question suivante
  const handleNextQuestion = () => {
    if (lives <= 0) {
      endGame();
    } else {
      loadNextQuestion();
    }
  };

  // Terminer la partie
  const endGame = async () => {
    setGameState('gameover');

    // Vérifier si c'est un nouveau record
    if (score > highScore) {
      setIsNewHighScore(true);
      setHighScore(score);
    }

    // Sauvegarder le score
    try {
      await fetch('/api/quiz/endless-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          questionsAnswered,
          maxDifficulty: currentDifficulty,
          livesRemaining: lives,
        }),
      });
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  // Démarrer une nouvelle partie
  const startGame = () => {
    setLives(INITIAL_LIVES);
    setScore(0);
    setQuestionsAnswered(0);
    setCurrentDifficulty('easy');
    setIsNewHighScore(false);
    loadNextQuestion();
  };

  // Affichage des vies (coeurs)
  const renderLives = () => {
    return (
      <div className="endless-lives">
        {Array.from({ length: INITIAL_LIVES }).map((_, i) => (
          <span key={i} className={`endless-lives__heart ${i < lives ? '' : 'endless-lives__heart--lost'}`}>
            {i < lives ? '❤️' : '🖤'}
          </span>
        ))}
      </div>
    );
  };

  // Écran d'intro
  if (gameState === 'intro') {
    return (
      <div className="endless-container">
        <div className="endless-intro">
          <div className="endless-intro__icon">⚔️</div>
          <h1 className="endless-intro__title">Mode Endless</h1>
          <p className="endless-intro__subtitle">Affronte la machine dans un duel sans fin !</p>
          
          <div className="endless-intro__rules">
            <h3>Règles du jeu</h3>
            <ul>
              <li>Tu commences avec <strong>10 vies</strong> ❤️</li>
              <li>Chaque mauvaise réponse = <strong>-1 vie</strong></li>
              <li>La difficulté augmente progressivement</li>
              <li>Plus tu réponds vite, plus tu gagnes de points</li>
              <li>Combien de questions peux-tu enchaîner ?</li>
            </ul>
          </div>

          {highScore > 0 && (
            <div className="endless-intro__highscore">
              🏆 Ton meilleur score : <strong>{highScore} points</strong>
            </div>
          )}

          <button className="btn btn--primary btn--lg" onClick={startGame}>
            🚀 Commencer
          </button>
        </div>
      </div>
    );
  }

  // Écran de chargement
  if (gameState === 'loading') {
    return (
      <div className="endless-container">
        <div className="endless-loading">
          <div className="endless-loading__spinner"></div>
          <p>Chargement de la question...</p>
        </div>
      </div>
    );
  }

  // Écran de game over
  if (gameState === 'gameover') {
    return (
      <div className="endless-container">
        <div className="endless-gameover">
          <div className="endless-gameover__icon">💀</div>
          <h1 className="endless-gameover__title">Game Over !</h1>
          
          {isNewHighScore && (
            <div className="endless-gameover__newhigh">
              🎉 Nouveau record personnel !
            </div>
          )}

          <div className="endless-gameover__stats">
            <div className="endless-gameover__stat">
              <span className="endless-gameover__stat-value">{score}</span>
              <span className="endless-gameover__stat-label">Points</span>
            </div>
            <div className="endless-gameover__stat">
              <span className="endless-gameover__stat-value">{questionsAnswered}</span>
              <span className="endless-gameover__stat-label">Questions</span>
            </div>
            <div className="endless-gameover__stat">
              <span className="endless-gameover__stat-value">{currentDifficulty}</span>
              <span className="endless-gameover__stat-label">Difficulté max</span>
            </div>
          </div>

          <div className="endless-gameover__actions">
            <button className="btn btn--primary" onClick={startGame}>
              🔄 Rejouer
            </button>
            <a href="/leaderboard/endless" className="btn btn--secondary">
              🏆 Leaderboard
            </a>
            <a href="/" className="btn btn--outline">
              🏠 Accueil
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Écran de jeu
  return (
    <div className="endless-container">
      {/* Header avec stats */}
      <div className="endless-header">
        <div className="endless-header__score">
          <span className="endless-header__label">Score</span>
          <span className="endless-header__value">{score}</span>
        </div>
        {renderLives()}
        <div className="endless-header__question">
          <span className="endless-header__label">Question</span>
          <span className="endless-header__value">{questionsAnswered + 1}</span>
        </div>
      </div>

      {/* Indicateur de difficulté */}
      <div className={`endless-difficulty endless-difficulty--${currentDifficulty}`}>
        {currentDifficulty === 'easy' && '🟢 Facile'}
        {currentDifficulty === 'medium' && '🟡 Moyen'}
        {currentDifficulty === 'hard' && '🔴 Difficile'}
      </div>

      {/* Timer */}
      <div className={`endless-timer ${timeRemaining <= 5 ? 'endless-timer--danger' : ''}`}>
        <div 
          className="endless-timer__bar" 
          style={{ width: `${(timeRemaining / 15) * 100}%` }}
        />
        <span className="endless-timer__value">{timeRemaining}s</span>
      </div>

      {/* Question */}
      {currentQuestion && (
        <div className="endless-question">
          <h2 className="endless-question__text">{currentQuestion.question}</h2>

          <div className="endless-choices">
            {currentQuestion.choices.map((choice, index) => {
              let choiceClass = 'endless-choice';
              if (showResult) {
                if (index === currentQuestion.correct_index) {
                  choiceClass += ' endless-choice--correct';
                } else if (index === selectedAnswer && selectedAnswer !== currentQuestion.correct_index) {
                  choiceClass += ' endless-choice--wrong';
                }
              } else if (selectedAnswer === index) {
                choiceClass += ' endless-choice--selected';
              }

              return (
                <button
                  key={index}
                  className={choiceClass}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showResult}
                >
                  <span className="endless-choice__letter">{String.fromCharCode(65 + index)}</span>
                  <span className="endless-choice__text">{choice}</span>
                </button>
              );
            })}
          </div>

          {/* Explication après réponse */}
          {showResult && (
            <div className="endless-result">
              <p className={`endless-result__status ${selectedAnswer === currentQuestion.correct_index ? 'endless-result__status--correct' : 'endless-result__status--wrong'}`}>
                {selectedAnswer === currentQuestion.correct_index ? '✅ Correct !' : selectedAnswer === -1 ? '⏰ Temps écoulé !' : '❌ Faux !'}
              </p>
              <p className="endless-result__explanation">{currentQuestion.explanation}</p>
              
              <button 
                className="btn btn--primary btn--block" 
                onClick={handleNextQuestion}
              >
                {lives <= 0 ? 'Voir les résultats' : 'Question suivante →'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
