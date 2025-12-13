// ============================================
// STRIPE CLIENT & CONFIGURATION
// ============================================

import Stripe from 'stripe';

// Vérification des variables d'environnement
if (!import.meta.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY non définie - mode test Stripe non fonctionnel');
}

// Client Stripe (server-side uniquement)
// Note: Ce fichier est uniquement importé dans les API routes (server-side)
export const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

// ============================================
// CONFIGURATION DES PRIX
// ============================================

// Ces IDs devront être remplacés par les vrais IDs Stripe après création des produits
export const STRIPE_PRICES = {
  premium: {
    monthly: import.meta.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly_test',
    yearly: import.meta.env.STRIPE_PRICE_PREMIUM_YEARLY || 'price_premium_yearly_test',
  },
  'premium+': {
    monthly: import.meta.env.STRIPE_PRICE_PREMIUM_PLUS_MONTHLY || 'price_premium_plus_monthly_test',
    yearly: import.meta.env.STRIPE_PRICE_PREMIUM_PLUS_YEARLY || 'price_premium_plus_yearly_test',
  },
} as const;

// ============================================
// CONFIGURATION DES PLANS
// ============================================

export interface PlanConfig {
  name: string;
  displayName: string;
  description: string;
  features: string[];
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: string;
  popular?: boolean;
}

export const PLANS: Record<string, PlanConfig> = {
  freemium: {
    name: 'freemium',
    displayName: 'Freemium',
    description: 'Parfait pour découvrir Qivana',
    features: [
      'Quiz illimités depuis la base de données',
      'Mode step-by-step',
      'Timer fixe 10 secondes',
      'Badges de base',
      'Accès au leaderboard',
      'Streak quotidien',
    ],
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscount: '',
  },
  premium: {
    name: 'premium',
    displayName: 'Premium',
    description: 'Plus de quiz IA et de flexibilité',
    features: [
      'Tout de Freemium +',
      '5 quiz IA par mois',
      'Mode All-in-One débloqué',
      'Timer personnalisable (5/10/15s)',
      '1 quiz prompt libre (10 questions)',
      'Accès multijoueur classique',
      'Badges Premium',
      'Stats avancées',
    ],
    monthlyPrice: 4.99,
    yearlyPrice: 49,
    yearlyDiscount: '2 mois offerts',
    popular: true,
  },
  'premium+': {
    name: 'premium+',
    displayName: 'Premium+',
    description: 'L\'expérience ultime pour les vrais geeks',
    features: [
      'Tout de Premium +',
      'Quiz IA illimités (~200/mois)',
      'Jusqu\'à 30 questions par quiz',
      'Mode Infini IA',
      'Prompt libre avancé',
      'Création de salons (duels)',
      'Timer custom (3-20s)',
      'Badges exclusifs',
    ],
    monthlyPrice: 7.99,
    yearlyPrice: 79,
    yearlyDiscount: '2 mois offerts',
  },
};

// ============================================
// HELPERS
// ============================================

/**
 * Mappe un Stripe Price ID vers un plan Qivana
 */
export function getPlanFromPriceId(priceId: string): 'premium' | 'premium+' | null {
  if (
    priceId === STRIPE_PRICES.premium.monthly ||
    priceId === STRIPE_PRICES.premium.yearly
  ) {
    return 'premium';
  }
  if (
    priceId === STRIPE_PRICES['premium+'].monthly ||
    priceId === STRIPE_PRICES['premium+'].yearly
  ) {
    return 'premium+';
  }
  return null;
}

/**
 * Vérifie si un plan est payant
 */
export function isPaidPlan(plan: string): boolean {
  return plan === 'premium' || plan === 'premium+';
}
