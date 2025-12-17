// ============================================
// UPGRADE MODAL COMPONENT
// ============================================
// Modal affichée quand un utilisateur atteint sa limite journalière
// ou essaie d'accéder à une fonctionnalité Premium+

import { useState, useEffect } from 'react';
import './UpgradeModal.scss';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  currentCount?: number;
  dailyLimit?: number;
  plan?: string;
  feature?: 'multiplayer' | 'ai-quiz' | 'endless' | 'custom-quiz';
}

export default function UpgradeModal({
  isOpen,
  onClose,
  title = 'Limite atteinte',
  message,
  currentCount,
  dailyLimit,
  plan = 'freemium',
  feature = 'multiplayer',
}: UpgradeModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setTimeout(() => setIsVisible(false), 300);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isVisible) return null;

  const featureLabels: Record<string, string> = {
    multiplayer: 'parties multijoueur',
    'ai-quiz': 'quiz IA',
    endless: 'mode Endless',
    'custom-quiz': 'quiz personnalisés',
  };

  const defaultMessage = dailyLimit
    ? `Tu as atteint ta limite de ${dailyLimit} ${featureLabels[feature]} par jour avec ton abonnement ${plan}.`
    : `Cette fonctionnalité est réservée aux abonnés Premium+.`;

  const benefits = [
    { icon: '🎮', text: 'Parties multijoueur illimitées' },
    { icon: '🤖', text: 'Quiz IA sans limite (fair use)' },
    { icon: '✨', text: 'Création de salons personnalisés' },
    { icon: '🏆', text: 'Mode Endless exclusif' },
    { icon: '⚡', text: 'Timer personnalisable (3-20s)' },
    { icon: '🎖️', text: 'Badges exclusifs' },
  ];

  return (
    <div
      className={`upgrade-modal__overlay ${isOpen ? 'upgrade-modal__overlay--visible' : ''}`}
      onClick={onClose}
    >
      <div
        className={`upgrade-modal ${isOpen ? 'upgrade-modal--visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="upgrade-modal__close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        <div className="upgrade-modal__header">
          <span className="upgrade-modal__icon">🚀</span>
          <h2 className="upgrade-modal__title">{title}</h2>
        </div>

        <div className="upgrade-modal__content">
          <p className="upgrade-modal__message">{message || defaultMessage}</p>

          {currentCount !== undefined && dailyLimit !== undefined && (
            <div className="upgrade-modal__counter">
              <div className="upgrade-modal__counter-bar">
                <div
                  className="upgrade-modal__counter-fill"
                  style={{ width: `${Math.min((currentCount / dailyLimit) * 100, 100)}%` }}
                />
              </div>
              <span className="upgrade-modal__counter-text">
                {currentCount} / {dailyLimit} utilisés aujourd'hui
              </span>
            </div>
          )}

          <div className="upgrade-modal__benefits">
            <h3 className="upgrade-modal__benefits-title">Avec Premium+ :</h3>
            <ul className="upgrade-modal__benefits-list">
              {benefits.map((benefit, index) => (
                <li key={index} className="upgrade-modal__benefit">
                  <span className="upgrade-modal__benefit-icon">{benefit.icon}</span>
                  <span className="upgrade-modal__benefit-text">{benefit.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="upgrade-modal__actions">
          <a href="/pricing?upgrade=multiplayer" className="btn btn--primary btn--block">
            ✨ Passer à Premium+
          </a>
          <button className="btn btn--secondary btn--block" onClick={onClose}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
