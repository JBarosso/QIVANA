// ============================================
// GOOGLE ANALYTICS - ÉVÉNEMENTS CUSTOM
// ============================================
// Utilitaire pour tracker les événements métier

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Vérifie si Google Analytics est disponible
 */
export function isAnalyticsEnabled(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Envoie un événement personnalisé à Google Analytics
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!isAnalyticsEnabled()) return;

  try {
    window.gtag!('event', eventName, params);
  } catch (error) {
    console.warn('Analytics event failed:', error);
  }
}

// ============================================
// ÉVÉNEMENTS MÉTIER PRÉDÉFINIS
// ============================================

/**
 * Quiz terminé (solo ou custom)
 */
export function trackQuizCompleted(params: {
  quiz_type: 'db' | 'ai-predefined' | 'ai-custom-quiz';
  universe: string;
  difficulty: string;
  score: number;
  max_score: number;
  questions_count: number;
}): void {
  trackEvent('quiz_completed', {
    ...params,
    score_percentage: Math.round((params.score / params.max_score) * 100),
  });
}

/**
 * Duel terminé (multijoueur)
 */
export function trackDuelCompleted(params: {
  players_count: number;
  winner_rank: number; // 1 = victoire, 2 = 2ème place, etc.
  total_score: number;
}): void {
  trackEvent('duel_completed', params);
}

/**
 * Upgrade vers Premium
 */
export function trackUpgrade(params: {
  plan: 'premium' | 'premium+';
  billing_period: 'monthly' | 'yearly';
  price_cents: number;
}): void {
  trackEvent('upgrade', params);
}

/**
 * Annulation d'abonnement
 */
export function trackCancellation(params: {
  plan: 'premium' | 'premium+';
}): void {
  trackEvent('subscription_cancelled', params);
}

/**
 * Quiz custom généré
 */
export function trackCustomQuizGenerated(params: {
  prompt_length: number;
  difficulty: string;
  questions_count: number;
  mode: 'quiz' | 'clarify' | 'error';
}): void {
  trackEvent('custom_quiz_generated', params);
}

/**
 * Création de salle de duel
 */
export function trackDuelRoomCreated(params: {
  is_private: boolean;
  universe: string;
  difficulty: string;
}): void {
  trackEvent('duel_room_created', params);
}

/**
 * Inscription utilisateur
 */
export function trackSignUp(): void {
  trackEvent('sign_up');
}

/**
 * Connexion utilisateur
 */
export function trackLogin(): void {
  trackEvent('login');
}
