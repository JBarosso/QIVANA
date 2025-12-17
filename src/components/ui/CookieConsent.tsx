// ============================================
// COOKIE CONSENT MODAL
// ============================================
// Popin de consentement RGPD pour Google Analytics

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './CookieConsent.scss';

const CONSENT_COOKIE_NAME = 'qivana_cookie_consent';
const CONSENT_EXPIRY_DAYS = 365;

interface ConsentData {
  analytics: boolean;
  timestamp: number;
}

// Fonctions utilitaires
function getStoredConsent(): ConsentData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(CONSENT_COOKIE_NAME);
    if (!stored) return null;
    
    const consent: ConsentData = JSON.parse(stored);
    const expiryDate = consent.timestamp + (CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    if (Date.now() > expiryDate) {
      localStorage.removeItem(CONSENT_COOKIE_NAME);
      return null;
    }
    
    return consent;
  } catch {
    return null;
  }
}

function loadGoogleAnalytics() {
  if (typeof window === 'undefined') return;
  
  const GA_MEASUREMENT_ID = import.meta.env.PUBLIC_GA_MEASUREMENT_ID;
  if (!GA_MEASUREMENT_ID) {
    return;
  }

  if (window.gtag) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  }
  window.gtag = gtag;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    page_title: document.title,
    page_location: window.location.href,
  });

  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    gtag('config', GA_MEASUREMENT_ID, {
      page_title: document.title,
      page_location: window.location.href,
    });
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    gtag('config', GA_MEASUREMENT_ID, {
      page_title: document.title,
      page_location: window.location.href,
    });
  };

  window.addEventListener('popstate', () => {
    gtag('config', GA_MEASUREMENT_ID, {
      page_title: document.title,
      page_location: window.location.href,
    });
  });
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    
    if (!consent) {
      // Afficher après 1 seconde
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (consent.analytics) {
      loadGoogleAnalytics();
    }
  }, []);

  // Pas de blocage du scroll pour un bandeau

  const saveConsent = (analytics: boolean) => {
    if (typeof window === 'undefined') return;
    
    const consent: ConsentData = {
      analytics,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(CONSENT_COOKIE_NAME, JSON.stringify(consent));
    
    if (analytics) {
      loadGoogleAnalytics();
    }
    
    setOpen(false);
  };

  const handleAccept = () => {
    saveConsent(true);
  };

  const handleReject = () => {
    saveConsent(false);
  };

  // Ne pas rendre si fermé
  if (!open) return null;

  const modalContent = (
    <div
      className="cookie-consent__banner"
      role="dialog"
      aria-label="Gestion des cookies"
    >
      <div className="cookie-consent__content">
        <p className="cookie-consent__text">
          Nous utilisons des cookies pour améliorer votre expérience.
          <a
            href="/confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="cookie-consent__link"
          >
            En savoir plus
          </a>
        </p>

        <div className="cookie-consent__actions">
          <button
            className="btn btn--secondary"
            onClick={handleReject}
            aria-label="Refuser tous les cookies"
          >
            Refuser
          </button>
          <button
            className="btn btn--primary"
            onClick={handleAccept}
            aria-label="Accepter tous les cookies"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );

  // Render dans portal
  const modalRoot = typeof document !== 'undefined' ? document.getElementById('modal-root') : null;
  
  if (!modalRoot) return null;
  
  return createPortal(modalContent, modalRoot);
}

// Déclaration TypeScript pour window.gtag
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
