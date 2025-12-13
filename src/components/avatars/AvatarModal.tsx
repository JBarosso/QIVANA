// ============================================
// AVATAR MODAL COMPONENT
// ============================================

import { useState, useEffect } from 'react';
import AvatarSelector from './AvatarSelector';
import './AvatarModal.scss';

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatars: string;
  selectedAvatarId: string | null;
}

export default function AvatarModal({ 
  isOpen, 
  onClose, 
  avatars, 
  selectedAvatarId 
}: AvatarModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setTimeout(() => setIsVisible(false), 300);
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div 
      className={`avatar-modal-overlay ${isOpen ? 'avatar-modal-overlay--open' : ''}`}
      onClick={onClose}
    >
      <div 
        className={`avatar-modal ${isOpen ? 'avatar-modal--open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="avatar-modal__header">
          <h2 className="avatar-modal__title">Choisir un avatar</h2>
          <button 
            className="avatar-modal__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="avatar-modal__content">
          <AvatarSelector 
            avatars={avatars}
            selectedAvatarId={selectedAvatarId}
            onSelect={() => {
              // Le composant AvatarSelector recharge déjà la page
              // On ferme juste le modal
            }}
          />
        </div>
      </div>
    </div>
  );
}
