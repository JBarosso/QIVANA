// ============================================
// AI USAGE GAUGE COMPONENT
// ============================================
// Affiche la jauge d'utilisation des crédits IA

import { useEffect, useState } from 'react';
import type { AiCreditsStatus } from '@/lib/ai-credits';

interface AiUsageGaugeProps {
  userId: string;
}

export default function AiUsageGauge({ userId }: AiUsageGaugeProps) {
  const [status, setStatus] = useState<AiCreditsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCreditsStatus() {
      try {
        const response = await fetch('/api/profile/ai-credits-status');
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Error fetching AI credits status:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCreditsStatus();
  }, [userId]);

  if (loading || !status) {
    return (
      <div className="ai-usage-gauge">
        <div className="ai-usage-gauge__loading">Chargement...</div>
      </div>
    );
  }

  const monthlyPercentage = status.monthlyLimit > 0 
    ? Math.min((status.monthlyUsed / status.monthlyLimit) * 100, 100)
    : 0;

  const isNearLimit = monthlyPercentage >= 80;
  const isAtLimit = monthlyPercentage >= 100;

  return (
    <div className="ai-usage-gauge">
      <div className="ai-usage-gauge__header">
        <h3 className="ai-usage-gauge__title">Crédits IA ce mois</h3>
        <span className="ai-usage-gauge__reset">
          Renouvellement: {new Date(status.periodResetDate).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long'
          })}
        </span>
      </div>

      <div className="ai-usage-gauge__progress">
        <div className="ai-usage-gauge__progress-bar">
          <div
            className={`ai-usage-gauge__progress-fill ${
              isAtLimit ? 'ai-usage-gauge__progress-fill--limit' :
              isNearLimit ? 'ai-usage-gauge__progress-fill--warning' :
              ''
            }`}
            style={{ width: `${monthlyPercentage}%` }}
          />
        </div>
        <div className="ai-usage-gauge__stats">
          <span className="ai-usage-gauge__used">{status.monthlyUsed}</span>
          <span className="ai-usage-gauge__separator">/</span>
          <span className="ai-usage-gauge__limit">{status.monthlyLimit}</span>
          <span className="ai-usage-gauge__unit">batches</span>
        </div>
      </div>

      {status.extraCredits > 0 && (
        <div className="ai-usage-gauge__extra">
          <span className="ai-usage-gauge__extra-icon">✨</span>
          <span className="ai-usage-gauge__extra-text">
            {status.extraCredits} crédit{status.extraCredits > 1 ? 's' : ''} bonus disponible{status.extraCredits > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {isAtLimit && status.extraCredits === 0 && (
        <div className="ai-usage-gauge__warning">
          <p>Vos crédits mensuels sont épuisés. Achetez un pack de crédits pour continuer !</p>
          <a href="/pricing" className="ai-usage-gauge__cta">
            Acheter des crédits
          </a>
        </div>
      )}
    </div>
  );
}
