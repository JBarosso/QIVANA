import { useState, useEffect, useCallback, useRef } from 'react';
import type { Question } from '../../lib/quiz';
import { calculateScore } from '../../lib/quiz';

interface QuizPlayerProps {
  sessionId: string;
  questions: Question[];
  currentAnswers: (number | null)[];
  timerSeconds?: number; // Timer en secondes (défaut: 10)
}

export default function QuizPlayer({ sessionId, questions, currentAnswers, timerSeconds = 10 }: QuizPlayerProps) {
  // Valider timerSeconds
  const validatedTimerSeconds = timerSeconds && timerSeconds > 0 ? timerSeconds : 10;
  console.log('🎮 QuizPlayer monté avec timerSeconds:', validatedTimerSeconds, '(prop:', timerSeconds, ')');
  
  // Trouver la première question non répondue
  const firstUnansweredIndex = currentAnswers.findIndex((a) => a === null);
  const initialQuestionIndex = firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  // Vérifier si la question actuelle est déjà répondue
  const currentAnswer = currentAnswers[currentQuestionIndex];
  const [isAnswered, setIsAnswered] = useState(currentAnswer !== null && currentAnswer !== undefined);
  const [timeRemaining, setTimeRemaining] = useState(validatedTimerSeconds);
  const [isLoading, setIsLoading] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  
  // Ref pour stocker handleAnswer et éviter les problèmes de dépendances dans useEffect
  const handleAnswerRef = useRef<((answerIndex: number | null, isTimeout: boolean) => Promise<void>) | null>(null);

  // ⚠️ PROTECTION : Vérifier si la session est complétée au chargement
  useEffect(() => {
    const checkSessionStatus = async () => {
      try {
        const response = await fetch(`/api/quiz/session-status?session=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.completed) {
            // Session terminée, rediriger vers les résultats
            setIsSessionCompleted(true);
            window.location.href = `/quiz/results?session=${sessionId}`;
          }
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    };

    checkSessionStatus();
  }, [sessionId]);

  // Si la session est complétée, ne rien afficher (redirection en cours)
  if (isSessionCompleted) {
    return null;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const handleAnswer = useCallback(async (answerIndex: number | null, isTimeout: boolean = false) => {
    if (isAnswered) return;

    setIsAnswered(true);
    setSelectedAnswer(answerIndex);

    // Calculer le score
    const isCorrect = answerIndex === currentQuestion.correct_index;
    const points = calculateScore(isCorrect, Math.max(0, timeRemaining), validatedTimerSeconds);
    setPointsEarned(points);

    // Sauvegarder la réponse
    setIsLoading(true);
    try {
      const response = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionIndex: currentQuestionIndex,
          answer: answerIndex,
          pointsEarned: points,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving answer:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentQuestionIndex, timeRemaining, validatedTimerSeconds, isAnswered, currentQuestion]);

  // Mettre à jour la ref à chaque changement de handleAnswer
  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  // Timer logic - Démarrer le timer pour chaque question
  useEffect(() => {
    // Vérifier si la question actuelle est déjà répondue
    const currentAnswer = currentAnswers[currentQuestionIndex];
    const questionIsAnswered = currentAnswer !== null && currentAnswer !== undefined;
    
    // Si la question est déjà répondue, ne pas démarrer le timer
    if (questionIsAnswered) {
      setIsAnswered(true);
      setSelectedAnswer(currentAnswer);
      setTimeRemaining(0); // Timer à 0 pour les questions déjà répondues
      return;
    }

    // Réinitialiser l'état pour la nouvelle question
    setIsAnswered(false);
    setSelectedAnswer(null);
    setTimeRemaining(validatedTimerSeconds);

    console.log(`⏱️ Timer démarré pour question ${currentQuestionIndex + 1}: ${validatedTimerSeconds}s`);

    // Démarrer le timer immédiatement
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        // Vérifier si la question a été répondue entre-temps
        const stillUnanswered = currentAnswers[currentQuestionIndex] === null || currentAnswers[currentQuestionIndex] === undefined;
        if (!stillUnanswered) {
          clearInterval(timer);
          return prev; // Garder la valeur actuelle
        }

        if (prev <= 0.1) {
          // Temps écoulé, réponse automatique
          clearInterval(timer);
          // Utiliser la ref pour appeler handleAnswer
          if (handleAnswerRef.current) {
            handleAnswerRef.current(null, true);
          }
          return 0;
        }
        return Math.max(0, prev - 0.1);
      });
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [currentQuestionIndex, validatedTimerSeconds, currentAnswers]); // Utiliser validatedTimerSeconds

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      // Question suivante
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTimeRemaining(validatedTimerSeconds);
      setPointsEarned(0);
    } else {
      // Quiz terminé, rediriger vers résultats
      window.location.href = `/quiz/results?session=${sessionId}`;
    }
  };

  const getAnswerClass = (index: number) => {
    if (!isAnswered) return 'quiz-answer';
    
    if (index === currentQuestion.correct_index) {
      return 'quiz-answer quiz-answer--correct';
    }
    
    if (index === selectedAnswer && index !== currentQuestion.correct_index) {
      return 'quiz-answer quiz-answer--wrong';
    }
    
    return 'quiz-answer quiz-answer--disabled';
  };

  return (
    <div className="quiz-player">
      {/* Header avec progression */}
      <div className="quiz-player__header">
        <div className="quiz-player__progress-bar">
          <div 
            className="quiz-player__progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="quiz-player__meta">
          <span className="quiz-player__question-count">
            Question {currentQuestionIndex + 1} / {totalQuestions}
          </span>
          <span className="quiz-player__timer">
            ⏱️ {Math.ceil(timeRemaining)}s
          </span>
        </div>
      </div>

      {/* Question Card */}
      <div className="quiz-card-container">
        <div className="quiz-question-card">
          <div className="quiz-question-card__header">
            <span className="quiz-question-card__difficulty">
              {currentQuestion.difficulty === 'easy' ? '🟢 Facile' : 
               currentQuestion.difficulty === 'medium' ? '🟡 Moyen' : 
               '🔴 Difficile'}
            </span>
            <span className="quiz-question-card__universe">
              {currentQuestion.universe}
            </span>
          </div>
          
          <h2 className="quiz-question-card__question">
            {currentQuestion.question}
          </h2>

          {/* Réponses */}
          <div className="quiz-answers">
            {currentQuestion.choices.map((choice, index) => (
              <button
                key={index}
                className={getAnswerClass(index)}
                onClick={() => handleAnswer(index)}
                disabled={isAnswered}
              >
                <span className="quiz-answer__letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="quiz-answer__text">{choice}</span>
                {isAnswered && index === currentQuestion.correct_index && (
                  <span className="quiz-answer__icon">✓</span>
                )}
                {isAnswered && index === selectedAnswer && index !== currentQuestion.correct_index && (
                  <span className="quiz-answer__icon">✗</span>
                )}
              </button>
            ))}
          </div>

          {/* Feedback après réponse */}
          {isAnswered && (
            <div className="quiz-feedback">
              <div className={`quiz-feedback__result ${selectedAnswer === currentQuestion.correct_index ? 'quiz-feedback__result--correct' : 'quiz-feedback__result--wrong'}`}>
                {selectedAnswer === currentQuestion.correct_index ? (
                  <>
                    <span className="quiz-feedback__emoji">🎉</span>
                    <span className="quiz-feedback__title">Bonne réponse !</span>
                    <span className="quiz-feedback__points">+{pointsEarned.toFixed(2)} points</span>
                  </>
                ) : (
                  <>
                    <span className="quiz-feedback__emoji">😔</span>
                    <span className="quiz-feedback__title">
                      {selectedAnswer === null ? 'Temps écoulé !' : 'Mauvaise réponse'}
                    </span>
                    <span className="quiz-feedback__points">+0 points</span>
                  </>
                )}
              </div>

              <div className="quiz-feedback__explanation">
                <strong>💡 Explication :</strong>
                <p>{currentQuestion.explanation}</p>
              </div>

              <button
                className="btn btn--primary btn--block"
                onClick={handleNext}
                disabled={isLoading}
              >
                {currentQuestionIndex < totalQuestions - 1 ? 'Question suivante →' : 'Voir les résultats 🎯'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timer bar visuel */}
      <div className="quiz-timer-bar">
        <div 
          className="quiz-timer-bar__fill" 
          style={{ 
            width: `${(timeRemaining / validatedTimerSeconds) * 100}%`,
            backgroundColor: timeRemaining > 5 ? 'var(--color-accent)' : 
                           timeRemaining > 2 ? 'var(--color-warning)' : 
                           'var(--color-danger)'
          }}
        />
      </div>
    </div>
  );
}
