// ============================================
// TOAST UTILITIES
// ============================================

export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' | 'avatar' = 'info',
  options?: {
    avatarUrl?: string;
    onClick?: () => void;
  }
) {
  const event = new CustomEvent('show-toast', {
    detail: {
      message,
      type,
      avatarUrl: options?.avatarUrl,
      onClick: options?.onClick,
    },
  });

  window.dispatchEvent(event);
}

// Fonction spécifique pour les notifications d'avatars débloqués
export function showAvatarUnlockedToast(avatarName: string, avatarUrl: string) {
  showToast(
    `Nouvel avatar débloqué : ${avatarName} !`,
    'avatar',
    {
      avatarUrl,
      onClick: () => {
        // Ouvrir le modal d'avatars
        const avatarTrigger = document.getElementById('avatar-trigger');
        if (avatarTrigger) {
          avatarTrigger.click();
        }
      },
    }
  );
}
