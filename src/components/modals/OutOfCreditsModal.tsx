// ============================================
// OUT OF CREDITS MODAL
// ============================================
// Modal affichée quand l'utilisateur n'a plus de crédits IA

import { useEffect } from 'react';

interface OutOfCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'endless' | 'custom' | 'multiplayer' | 'solo';
  creditsRemaining?: number;
}

export default function OutOfCreditsModal({ 
  isOpen, 
  onClose, 
  mode = 'solo',
  creditsRemaining = 0 
}: OutOfCreditsModalProps) {
  // Empêcher le scroll du body quand la modal est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getModeMessage = () => {
    switch (mode) {
      case 'endless':
        return "Tu as épuisé tes crédits IA pour ce mois ! Le mode Endless nécessite de la génération en continu.";
      case 'custom':
        return "Tu as épuisé tes crédits IA pour ce mois ! Impossible de générer un quiz custom sans crédits.";
      case 'multiplayer':
        return "Tu as épuisé tes crédits IA pour ce mois ! Impossible de créer un duel custom sans crédits.";
      default:
        return "Tu as épuisé tes crédits IA pour ce mois !";
    }
  };

  const handleBuyCredits = () => {
    window.location.href = '/pricing#credits';
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="out-of-credits-modal">
      <div className="out-of-credits-modal__overlay" onClick={onClose} />
      <div className="out-of-credits-modal__content">
        <button 
          className="out-of-credits-modal__close" 
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>

        <div className="out-of-credits-modal__icon">
          🪫
        </div>

        <h2 className="out-of-credits-modal__title">
          Crédits IA épuisés !
        </h2>

        <p className="out-of-credits-modal__message">
          {getModeMessage()}
        </p>

        <div className="out-of-credits-modal__info">
          <div className="out-of-credits-modal__info-item">
            <span className="out-of-credits-modal__info-label">Crédits restants :</span>
            <span className="out-of-credits-modal__info-value">{creditsRemaining}</span>
          </div>
          <div className="out-of-credits-modal__info-item">
            <span className="out-of-credits-modal__info-label">Renouvellement :</span>
            <span className="out-of-credits-modal__info-value">
              {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long'
              })}
            </span>
          </div>
        </div>

        <div className="out-of-credits-modal__actions">
          <button 
            className="out-of-credits-modal__btn out-of-credits-modal__btn--primary"
            onClick={handleBuyCredits}
          >
            ✨ Acheter des crédits
          </button>
          <button 
            className="out-of-credits-modal__btn out-of-credits-modal__btn--secondary"
            onClick={handleGoHome}
          >
            Retour à l'accueil
          </button>
        </div>

        <p className="out-of-credits-modal__note">
          💡 Les crédits IA bonus ne se périment jamais et s'utilisent avant ton quota mensuel
        </p>
      </div>
    </div>
  );
}
