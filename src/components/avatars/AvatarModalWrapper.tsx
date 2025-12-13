// ============================================
// AVATAR MODAL WRAPPER (avec gestion d'état)
// ============================================

import { useState, useEffect } from 'react';
import AvatarModal from './AvatarModal';

interface AvatarModalWrapperProps {
  avatars: string;
  selectedAvatarId: string | null;
}

export default function AvatarModalWrapper({ 
  avatars, 
  selectedAvatarId 
}: AvatarModalWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Écouter l'événement personnalisé pour ouvrir le modal
    const handleOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('open-avatar-modal', handleOpen);

    return () => {
      window.removeEventListener('open-avatar-modal', handleOpen);
    };
  }, []);

  return (
    <AvatarModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      avatars={avatars}
      selectedAvatarId={selectedAvatarId}
    />
  );
}
