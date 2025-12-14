// ============================================
// SHOW ALERT UTILITY - Qivana
// ============================================
// DEPRECATED: Utiliser showToast() à la place
// Ce fichier est conservé pour la compatibilité mais redirige vers Toast

import { showToast, type ToastType } from './toast';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertOptions {
  type?: AlertType;
  message: string;
  dismissible?: boolean;
  duration?: number;
  container?: HTMLElement | string;
}

/**
 * @deprecated Utiliser showToast() à la place
 * Cette fonction redirige maintenant vers le système Toast unifié
 */
export function showAlert(options: AlertOptions): string {
  const { type = 'info', message } = options;
  
  // Mapper les types d'alert vers les types Toast
  const toastType: ToastType = type === 'warning' ? 'info' : type;
  
  showToast({ message, type: toastType });
  
  return `toast-${Date.now()}`;
}

/**
 * @deprecated Plus nécessaire avec le système Toast
 */
export function dismissAlert(_alertId: string): void {
  // Le système Toast gère automatiquement la fermeture
}
