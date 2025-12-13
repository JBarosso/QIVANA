// ============================================
// AVATAR SELECTOR COMPONENT
// ============================================

import { useState, useEffect } from 'react';
import './AvatarSelector.scss';

export interface Avatar {
  id: string;
  code: string;
  name: string;
  description: string;
  image_url: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
}

interface AvatarSelectorProps {
  avatars: string; // JSON string des avatars
  selectedAvatarId: string | null;
  onSelect?: (avatarId: string) => void;
}

export default function AvatarSelector({ 
  avatars: avatarsJson, 
  selectedAvatarId: initialSelectedId,
  onSelect 
}: AvatarSelectorProps) {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [filter, setFilter] = useState<'all' | 'common' | 'rare' | 'epic' | 'legendary'>('all');

  useEffect(() => {
    try {
      const parsed = JSON.parse(avatarsJson);
      setAvatars(parsed);
    } catch (err) {
      console.error('Error parsing avatars:', err);
    }
  }, [avatarsJson]);

  const handleSelect = async (avatarId: string) => {
    setSelectedId(avatarId);
    
    // Sauvegarder la sélection
    try {
      const response = await fetch('/api/profile/select-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId }),
      });

      if (!response.ok) {
        throw new Error('Failed to save avatar selection');
      }

      if (onSelect) {
        onSelect(avatarId);
      }

      // Recharger la page pour mettre à jour l'avatar
      window.location.reload();
    } catch (error) {
      console.error('Error saving avatar:', error);
      alert('Erreur lors de la sauvegarde de l\'avatar');
    }
  };

  const filteredAvatars = filter === 'all' 
    ? avatars 
    : avatars.filter(a => a.rarity === filter);

  const rarityColors = {
    common: '#94A3B8',
    rare: '#3B82F6',
    epic: '#A855F7',
    legendary: '#F59E0B',
  };

  const rarityLabels = {
    common: 'Commun',
    rare: 'Rare',
    epic: 'Épique',
    legendary: 'Légendaire',
  };

  return (
    <div className="avatar-selector">
      <div className="avatar-selector__filters">
        <button
          className={`avatar-filter ${filter === 'all' ? 'avatar-filter--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tous
        </button>
        {(['common', 'rare', 'epic', 'legendary'] as const).map((rarity) => (
          <button
            key={rarity}
            className={`avatar-filter avatar-filter--${rarity} ${filter === rarity ? 'avatar-filter--active' : ''}`}
            onClick={() => setFilter(rarity)}
          >
            {rarityLabels[rarity]}
          </button>
        ))}
      </div>

      <div className="avatar-grid">
        {filteredAvatars.map((avatar) => (
          <div
            key={avatar.id}
            className={`avatar-card avatar-card--${avatar.rarity} ${
              selectedId === avatar.id ? 'avatar-card--selected' : ''
            } ${!avatar.unlocked ? 'avatar-card--locked' : ''}`}
            onClick={() => avatar.unlocked && handleSelect(avatar.id)}
          >
            {!avatar.unlocked && (
              <div className="avatar-card__lock">
                <span className="avatar-card__lock-icon">🔒</span>
              </div>
            )}
            
            <div className="avatar-card__image">
              <img src={avatar.image_url} alt={avatar.name} />
            </div>

            <div className="avatar-card__info">
              <div className="avatar-card__name">{avatar.name}</div>
              <div 
                className="avatar-card__rarity"
                style={{ color: rarityColors[avatar.rarity] }}
              >
                {rarityLabels[avatar.rarity]}
              </div>
              {!avatar.unlocked && (
                <div className="avatar-card__description">{avatar.description}</div>
              )}
            </div>

            {selectedId === avatar.id && (
              <div className="avatar-card__selected-badge">
                <span>✓ Sélectionné</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredAvatars.length === 0 && (
        <div className="avatar-selector__empty">
          Aucun avatar dans cette catégorie.
        </div>
      )}
    </div>
  );
}
