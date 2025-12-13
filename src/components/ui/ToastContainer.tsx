// ============================================
// TOAST CONTAINER COMPONENT
// ============================================

import { useState, useEffect } from 'react';
import Toast from './Toast';

interface ToastData {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'avatar';
  avatarUrl?: string;
  onClick?: () => void;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    // Écouter les événements de toast personnalisés
    const handleToastEvent = (event: CustomEvent) => {
      const toastData = event.detail;
      const id = `toast-${Date.now()}`;
      
      setToasts((prev) => [...prev, { id, ...toastData }]);
    };

    window.addEventListener('show-toast' as any, handleToastEvent);

    return () => {
      window.removeEventListener('show-toast' as any, handleToastEvent);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          avatarUrl={toast.avatarUrl}
          onClick={toast.onClick}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
