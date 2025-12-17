// ============================================
// AI CREDITS HELPER
// ============================================
// Helper centralisé pour la gestion des crédits IA
// Principe: contrôle en temps réel côté application

import type { SupabaseClient } from '@supabase/supabase-js';
import { getMonthlyQuota, planHasAiAccess, type UserPlan } from './ai-credits-config';

export interface CreditCheckResult {
  allowed: boolean;
  creditsRemaining: number;
  source: 'extra' | 'monthly' | 'none';
  error?: 'out_of_credits' | 'plan_not_allowed';
}

export interface AiCreditsStatus {
  monthlyUsed: number;
  monthlyLimit: number;
  extraCredits: number;
  periodResetDate: Date;
  plan: UserPlan;
}

export type AiGenerationMode = 'solo' | 'custom' | 'multiplayer' | 'endless';

/**
 * Vérifie et consomme 1 crédit IA pour un batch de génération
 * 
 * Logique de consommation:
 * 1. Utiliser extra_ai_credits en priorité (si > 0)
 * 2. Sinon, utiliser le quota mensuel (si disponible)
 * 3. Sinon, bloquer avec out_of_credits
 * 
 * @param supabase Client Supabase (doit avoir les permissions nécessaires)
 * @param userId ID de l'utilisateur
 * @param context Contexte de la génération (mode, nombre de questions)
 * @returns Résultat de la vérification avec statut des crédits
 */
export async function checkAndConsumeAiCredit(
  supabase: SupabaseClient,
  userId: string,
  context: {
    mode: AiGenerationMode;
    questionsInBatch: number;
  }
): Promise<CreditCheckResult> {
  // 1. Récupérer le profil avec les crédits
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, extra_ai_credits, ai_quizzes_used_this_month, ai_quota_reset_date')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for credit check:', profileError);
    return {
      allowed: false,
      creditsRemaining: 0,
      source: 'none',
      error: 'plan_not_allowed',
    };
  }

  const plan = profile.plan as UserPlan;

  // 2. Vérifier si le plan a accès à l'IA
  if (!planHasAiAccess(plan)) {
    return {
      allowed: false,
      creditsRemaining: 0,
      source: 'none',
      error: 'plan_not_allowed',
    };
  }

  // 3. Vérifier et effectuer le reset mensuel si nécessaire
  const now = new Date();
  const resetDate = new Date(profile.ai_quota_reset_date);
  
  if (resetDate < now) {
    // Reset mensuel: remettre à zéro l'usage et définir la nouvelle date de reset
    const nextReset = new Date(now);
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    await supabase
      .from('profiles')
      .update({
        ai_quizzes_used_this_month: 0,
        ai_quota_reset_date: nextReset.toISOString(),
      })
      .eq('id', userId);

    // Mettre à jour le profil en mémoire
    profile.ai_quizzes_used_this_month = 0;
    profile.ai_quota_reset_date = nextReset.toISOString();
  }

  // 4. Logique de consommation: extra_credits en priorité
  const extraCredits = profile.extra_ai_credits || 0;
  const monthlyQuota = getMonthlyQuota(plan);
  const monthlyUsed = profile.ai_quizzes_used_this_month || 0;
  const monthlyRemaining = monthlyQuota - monthlyUsed;

  if (extraCredits > 0) {
    // Consommer un crédit extra
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ extra_ai_credits: extraCredits - 1 })
      .eq('id', userId);

    if (updateError) {
      console.error('Error consuming extra credit:', updateError);
      return {
        allowed: false,
        creditsRemaining: extraCredits,
        source: 'extra',
        error: 'out_of_credits',
      };
    }

    return {
      allowed: true,
      creditsRemaining: extraCredits - 1 + monthlyRemaining,
      source: 'extra',
    };
  }

  // 5. Sinon, utiliser le quota mensuel
  if (monthlyRemaining > 0) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ ai_quizzes_used_this_month: monthlyUsed + 1 })
      .eq('id', userId);

    if (updateError) {
      console.error('Error consuming monthly credit:', updateError);
      return {
        allowed: false,
        creditsRemaining: monthlyRemaining,
        source: 'monthly',
        error: 'out_of_credits',
      };
    }

    return {
      allowed: true,
      creditsRemaining: monthlyRemaining - 1,
      source: 'monthly',
    };
  }

  // 6. Aucun crédit disponible
  return {
    allowed: false,
    creditsRemaining: 0,
    source: 'none',
    error: 'out_of_credits',
  };
}

/**
 * Obtient le statut des crédits IA pour l'affichage dans l'UI
 * 
 * @param supabase Client Supabase
 * @param userId ID de l'utilisateur
 * @returns Statut des crédits (utilisé, limite, extra, date de reset)
 */
export async function getAiCreditsStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<AiCreditsStatus | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, extra_ai_credits, ai_quizzes_used_this_month, ai_quota_reset_date')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    console.error('Error fetching credits status:', error);
    return null;
  }

  const plan = profile.plan as UserPlan;
  const monthlyLimit = getMonthlyQuota(plan);
  const monthlyUsed = profile.ai_quizzes_used_this_month || 0;
  const extraCredits = profile.extra_ai_credits || 0;
  const resetDate = new Date(profile.ai_quota_reset_date);

  // Vérifier si un reset est nécessaire
  const now = new Date();
  if (resetDate < now) {
    // Le reset sera fait au prochain checkAndConsumeAiCredit
    // Pour l'UI, on peut afficher 0 utilisé si la date est passée
    return {
      monthlyUsed: 0,
      monthlyLimit,
      extraCredits,
      periodResetDate: resetDate,
      plan,
    };
  }

  return {
    monthlyUsed,
    monthlyLimit,
    extraCredits,
    periodResetDate: resetDate,
    plan,
  };
}
