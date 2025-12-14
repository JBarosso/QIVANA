// ============================================
// RATING MODAL - Notation post-quiz
// ============================================
// Modal optionnel pour noter un quiz après l'avoir terminé

import { useState, useEffect } from 'react';

interface RatingModalProps {
  sessionId: string;
  quizType: 'db' | 'ai-predefined' | 'ai-custom-quiz' | 'duel';
  theme?: string;
  promptUsed?: string;
}

export default function RatingModal({ sessionId, quizType, theme, promptUsed }: RatingModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Afficher le modal après un délai (pour laisser le temps de voir les résultats)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    if (rating === 0) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/quiz/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          quizType,
          theme,
          rating,
          comment: comment.trim() || undefined,
          promptUsed,
        }),
      });

      if (response.ok) {
        setHasSubmitted(true);
        // Fermer après 1.5s
        setTimeout(() => setIsVisible(false), 1500);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="rating-modal-overlay">
      <div className="rating-modal">
        {hasSubmitted ? (
          <div className="rating-modal__success">
            <div className="rating-modal__success-icon">✨</div>
            <p className="rating-modal__success-text">Merci pour ton avis !</p>
          </div>
        ) : (
          <>
            <div className="rating-modal__header">
              <h3 className="rating-modal__title">Qu'as-tu pensé de ce quiz ?</h3>
              <p className="rating-modal__subtitle">Ton avis nous aide à améliorer les quiz</p>
            </div>

            <div className="rating-modal__stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`rating-modal__star ${
                    star <= (hoveredRating || rating) ? 'rating-modal__star--active' : ''
                  }`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>

            {rating > 0 && (
              <div className="rating-modal__comment">
                <textarea
                  placeholder="Un commentaire ? (optionnel)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="rating-modal__textarea"
                />
              </div>
            )}

            <div className="rating-modal__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleSkip}
                disabled={isSubmitting}
              >
                Passer
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
              >
                {isSubmitting ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
