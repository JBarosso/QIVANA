import { useState } from 'react';
import '../../styles/components/Badge.scss';

export interface BadgeData {
  id: string;
  code: string;
  name: string;
  description: string;
  icon_url?: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'general' | 'quiz' | 'duel' | 'streak' | 'premium' | 'achievement';
  unlocked_at?: string | null;
}

interface BadgeProps {
  badge: BadgeData;
  isUnlocked?: boolean;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

export default function Badge({ badge, isUnlocked = false, size = 'medium', showTooltip = true }: BadgeProps) {
  const [showTooltipState, setShowTooltipState] = useState(false);

  const rarityColors = {
    common: '#9CA3AF', // Gray
    rare: '#0EA5E9', // Cyan
    epic: '#EC4899', // Pink
    legendary: '#FACC15', // Gold
  };

  const rarityGlow = {
    common: '0 0 8px rgba(156, 163, 175, 0.3)',
    rare: '0 0 12px rgba(14, 165, 233, 0.4)',
    epic: '0 0 16px rgba(236, 72, 153, 0.5)',
    legendary: '0 0 20px rgba(250, 204, 21, 0.6)',
  };

  const sizeClasses = {
    small: 'badge--small',
    medium: 'badge--medium',
    large: 'badge--large',
  };

  return (
    <div
      className={`badge ${sizeClasses[size]} ${isUnlocked ? 'badge--unlocked' : 'badge--locked'}`}
      style={{
        '--badge-color': rarityColors[badge.rarity],
        '--badge-glow': rarityGlow[badge.rarity],
      } as React.CSSProperties}
      onMouseEnter={() => showTooltip && setShowTooltipState(true)}
      onMouseLeave={() => setShowTooltipState(false)}
    >
      <div className="badge__icon">
        {badge.icon_url ? (
          <img src={badge.icon_url} alt={badge.name} className="badge__icon-img" />
        ) : (
          <div className="badge__icon-placeholder">
            {badge.category === 'streak' && '🔥'}
            {badge.category === 'quiz' && '🎯'}
            {badge.category === 'duel' && '🏆'}
            {badge.category === 'premium' && '💎'}
            {badge.category === 'achievement' && '⭐'}
            {badge.category === 'general' && '🎖️'}
          </div>
        )}
        {!isUnlocked && <div className="badge__lock-overlay">🔒</div>}
      </div>
      
      {showTooltip && showTooltipState && (
        <div className="badge__tooltip">
          <div className="badge__tooltip-name">{badge.name}</div>
          <div className="badge__tooltip-description">{badge.description}</div>
          {badge.unlocked_at && (
            <div className="badge__tooltip-date">
              Débloqué le {new Date(badge.unlocked_at).toLocaleDateString('fr-FR')}
            </div>
          )}
          {!isUnlocked && (
            <div className="badge__tooltip-locked">Non débloqué</div>
          )}
        </div>
      )}
    </div>
  );
}
