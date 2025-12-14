// ============================================
// UPGRADE MODAL COMPONENT
// ============================================
// Affiche un popup quand l'utilisateur atteint une limite Freemium

import { useState, useEffect } from 'react';

interface UpgradeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  feature?: string; // La fonctionnalité bloquée
  requiredPlan?: 'premium' | 'premium+';
}

export default function UpgradeModal({
  isOpen: propIsOpen,
  onClose,
  feature = 'cette fonctionnalité',
  requiredPlan = 'premium',
}: UpgradeModalProps) {
  const [isOpen, setIsOpen] = useState(propIsOpen || false);

  // Écouter les événements globaux pour ouvrir le modal
  useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      if (event.detail?.feature) {
        // On pourrait stocker feature et requiredPlan ici
      }
      setIsOpen(true);
    };

    window.addEventListener('show-upgrade-modal', handleOpen as EventListener);
    return () => {
      window.removeEventListener('show-upgrade-modal', handleOpen as EventListener);
    };
  }, []);

  // Synchroniser avec la prop
  useEffect(() => {
    if (propIsOpen !== undefined) {
      setIsOpen(propIsOpen);
    }
  }, [propIsOpen]);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleUpgrade = () => {
    window.location.href = '/pricing';
  };

  if (!isOpen) return null;

  const planName = requiredPlan === 'premium+' ? 'Premium+' : 'Premium';

  return (
    <div className="upgrade-modal-overlay" onClick={handleClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button className="upgrade-modal__close" onClick={handleClose}>
          ✕
        </button>

        <div className="upgrade-modal__icon">🔒</div>

        <h2 className="upgrade-modal__title">
          Fonctionnalité {planName}
        </h2>

        <p className="upgrade-modal__message">
          Pour accéder à {feature}, passez à <strong>{planName}</strong> et débloquez 
          toutes les fonctionnalités avancées !
        </p>

        <div className="upgrade-modal__features">
          {requiredPlan === 'premium' ? (
            <>
              <div className="upgrade-modal__feature">✓ 5 quiz personnalisés par mois</div>
              <div className="upgrade-modal__feature">✓ Mode All-in-One</div>
              <div className="upgrade-modal__feature">✓ Timer personnalisable</div>
              <div className="upgrade-modal__feature">✓ Accès multijoueur</div>
            </>
          ) : (
            <>
              <div className="upgrade-modal__feature">✓ Quiz personnalisés illimités</div>
              <div className="upgrade-modal__feature">✓ Mode Infini</div>
              <div className="upgrade-modal__feature">✓ Création de salons</div>
              <div className="upgrade-modal__feature">✓ Timer custom (3-20s)</div>
            </>
          )}
        </div>

        <div className="upgrade-modal__price">
          <span className="upgrade-modal__price-amount">
            {requiredPlan === 'premium+' ? '7,99€' : '4,99€'}
          </span>
          <span className="upgrade-modal__price-period">/mois</span>
        </div>

        <div className="upgrade-modal__actions">
          <button className="btn btn--primary btn--full" onClick={handleUpgrade}>
            🚀 Passer à {planName}
          </button>
          <button className="btn btn--outline btn--full" onClick={handleClose}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
