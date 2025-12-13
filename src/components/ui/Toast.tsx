// ============================================
// TOAST NOTIFICATION COMPONENT
// ============================================

import { useEffect, useState } from 'react';
import './Toast.scss';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'avatar';
  duration?: number;
  onClose?: () => void;
  onClick?: () => void;
  avatarUrl?: string;
}

export default function Toast({ 
  message, 
  type = 'info', 
  duration = 5000, 
  onClose,
  onClick,
  avatarUrl
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Petit délai pour l'animation d'entrée
    setTimeout(() => setIsVisible(true), 100);

    // Auto-close après la durée spécifiée
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
      handleClose();
    }
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ️',
    avatar: '🎉',
  };

  return (
    <div 
      className={`toast toast--${type} ${isVisible ? 'toast--visible' : ''} ${onClick ? 'toast--clickable' : ''}`}
      onClick={onClick ? handleClick : undefined}
    >
      {type === 'avatar' && avatarUrl ? (
        <div className="toast__avatar">
          <img src={avatarUrl} alt="Nouvel avatar" />
        </div>
      ) : (
        <div className="toast__icon">{icons[type]}</div>
      )}
      
      <div className="toast__content">
        <p className="toast__message">{message}</p>
        {onClick && (
          <span className="toast__cta">Cliquer pour voir →</span>
        )}
      </div>

      <button 
        className="toast__close"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  );
}
