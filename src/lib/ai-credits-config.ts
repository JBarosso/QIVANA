// ============================================
// AI CREDITS CONFIGURATION
// ============================================
// Centralise la configuration des quotas et packs de crédits IA

export type UserPlan = 'freemium' | 'premium' | 'premium+';
export type CreditPackType = 'starter' | 'standard' | 'pro';

/**
 * Quotas mensuels par plan (en batches/appels API)
 * 1 batch = 1 appel à l'API OpenAI (peut générer plusieurs questions)
 */
export function getMonthlyQuota(plan: UserPlan): number {
  const quotas: Record<UserPlan, number> = {
    freemium: parseInt(process.env.AI_QUOTA_FREEMIUM || '0', 10),
    premium: parseInt(process.env.AI_QUOTA_PREMIUM || '15', 10),
    'premium+': parseInt(process.env.AI_QUOTA_PREMIUM_PLUS || '200', 10),
  };
  return quotas[plan];
}

/**
 * Crédits fournis par chaque pack de crédits (en batches)
 */
export function getCreditsForPack(packType: CreditPackType): number {
  const credits: Record<CreditPackType, number> = {
    starter: parseInt(process.env.AI_PACK_STARTER_CREDITS || '6', 10),
    standard: parseInt(process.env.AI_PACK_STANDARD_CREDITS || '18', 10),
    pro: parseInt(process.env.AI_PACK_PRO_CREDITS || '45', 10),
  };
  return credits[packType];
}

/**
 * Vérifie si un plan a accès à la génération IA
 */
export function planHasAiAccess(plan: UserPlan): boolean {
  return getMonthlyQuota(plan) > 0 || plan === 'premium' || plan === 'premium+';
}
