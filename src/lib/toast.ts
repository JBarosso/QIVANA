// ============================================
// TOAST UTILITY
// Helper pour afficher des notifications toast
// ============================================

export type ToastType = 'success' | 'error' | 'info' | 'avatar';

interface ToastOptions {
  message: string;
  type?: ToastType;
  avatarUrl?: string;
  onClick?: () => void;
}

/**
 * Affiche un toast de notification
 * Peut être utilisé dans les composants React ou les scripts Astro
 */
export function showToast(options: ToastOptions | string): void {
  const toastData = typeof options === 'string' 
    ? { message: options, type: 'info' as ToastType }
    : options;
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('show-toast', { detail: toastData })
    );
  }
}

/**
 * Raccourcis pour les types de toast courants
 */
export const toast = {
  success: (message: string) => showToast({ message, type: 'success' }),
  error: (message: string) => showToast({ message, type: 'error' }),
  info: (message: string) => showToast({ message, type: 'info' }),
};
