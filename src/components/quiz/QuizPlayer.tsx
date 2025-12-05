import { useState, useEffect } from 'react';
import type { Question } from '../../lib/quiz';
import { calculateScore } from '../../lib/quiz';
import './QuizPlayer.scss';

interface QuizPlayerProps {
  sessionId: string;
  questions: Question[];
  currentAnswers: (number | null)[];
}

export default function QuizPlayer({ sessionId, questions, currentAnswers }: QuizPlayerProps) {
  // Trouver la première question non répondue
  const firstUnansweredIndex = currentAnswers.findIndex((a) => a === null);
  const initialQuestionIndex = firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // Timer logic
  useEffect(() => {
    if (isAnswered) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          // Temps écoulé, réponse automatique
          handleAnswer(null, true);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [currentQuestionIndex, isAnswered]);

  const handleAnswer = async (answerIndex: number | null, isTimeout: boolean = false) => {
    if (isAnswered) return;

    setIsAnswered(true);
    setSelectedAnswer(answerIndex);

    // Calculer le score
    const isCorrect = answerIndex === currentQuestion.correct_index;
    const points = calculateScore(isCorrect, Math.max(0, timeRemaining), 10);
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
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      // Question suivante
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTimeRemaining(10);
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
            width: `${(timeRemaining / 10) * 100}%`,
            backgroundColor: timeRemaining > 5 ? 'var(--color-accent)' : 
                           timeRemaining > 2 ? 'var(--color-warning)' : 
                           'var(--color-danger)'
          }}
        />
      </div>
    </div>
  );
}
