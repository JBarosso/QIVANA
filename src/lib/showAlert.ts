// ============================================
// SHOW ALERT UTILITY - Qivana
// ============================================
// Fonction helper pour afficher des alertes dynamiquement

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertOptions {
  type?: AlertType;
  message: string;
  dismissible?: boolean;
  duration?: number; // En millisecondes (0 = pas d'auto-dismiss)
  container?: HTMLElement | string; // Où afficher l'alerte
}

/**
 * Affiche une alerte dynamiquement dans la page
 */
export function showAlert(options: AlertOptions): string {
  const {
    type = 'info',
    message,
    dismissible = true,
    duration = type === 'success' || type === 'info' ? 5000 : 0,
    container = 'body',
  } = options;

  // Trouver le conteneur
  const containerEl =
    typeof container === 'string'
      ? document.querySelector(container) || document.body
      : container;

  // Créer l'alerte
  const alertId = `alert-${Math.random().toString(36).substr(2, 9)}`;
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const alertEl = document.createElement('div');
  alertEl.className = `alert alert--${type}`;
  alertEl.id = alertId;
  alertEl.setAttribute('role', 'alert');
  alertEl.innerHTML = `
    <div class="alert__content">
      <span class="alert__icon" aria-hidden="true">${icons[type]}</span>
      <p class="alert__message">${message}</p>
    </div>
    ${
      dismissible
        ? `<button class="alert__close" aria-label="Fermer" data-alert-id="${alertId}">
            <span aria-hidden="true">×</span>
          </button>`
        : ''
    }
  `;

  // Styles inline (temporaires, seront remplacés par le CSS du composant)
  alertEl.style.cssText = `
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    transition: all 0.3s ease;
    animation: slideIn 0.3s ease-out;
    ${
      type === 'success'
        ? 'background: hsl(142, 76%, 95%); border: 1px solid hsl(142, 76%, 60%); color: hsl(142, 76%, 20%);'
        : type === 'error'
        ? 'background: hsl(0, 84%, 95%); border: 1px solid hsl(0, 84%, 60%); color: hsl(0, 84%, 20%);'
        : type === 'warning'
        ? 'background: hsl(45, 100%, 95%); border: 1px solid hsl(45, 100%, 60%); color: hsl(45, 100%, 20%);'
        : 'background: hsl(217, 91%, 95%); border: 1px solid hsl(217, 91%, 60%); color: hsl(217, 91%, 20%);'
    }
  `;

  // Ajouter les styles pour l'animation si pas déjà présents
  if (!document.getElementById('alert-styles')) {
    const style = document.createElement('style');
    style.id = 'alert-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .alert__content {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        flex: 1;
      }
      .alert__icon {
        font-size: 1.25rem;
        flex-shrink: 0;
        line-height: 1;
      }
      .alert__message {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.5;
        flex: 1;
      }
      .alert__close {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: currentColor;
        cursor: pointer;
        padding: 0.25rem;
        line-height: 1;
        opacity: 0.7;
        transition: opacity 0.2s;
        flex-shrink: 0;
      }
      .alert__close:hover {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  // Insérer l'alerte
  containerEl.insertBefore(alertEl, containerEl.firstChild);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissAlert(alertId);
    }, duration);
  }

  // Bouton de fermeture
  if (dismissible) {
    const closeBtn = alertEl.querySelector('.alert__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dismissAlert(alertId);
      });
    }
  }

  return alertId;
}

/**
 * Ferme une alerte par son ID
 */
export function dismissAlert(alertId: string): void {
  const alert = document.getElementById(alertId);
  if (alert) {
    alert.style.opacity = '0';
    alert.style.transform = 'translateY(-10px)';
    setTimeout(() => alert.remove(), 300);
  }
}
