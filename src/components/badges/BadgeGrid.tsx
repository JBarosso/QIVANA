import Badge, { BadgeData } from './Badge';
import '../../styles/components/BadgeGrid.scss';

interface BadgeGridProps {
  badges: string; // JSON string from Astro
  unlockedBadgeIds?: string; // JSON string array from Astro
  category?: BadgeData['category'];
  showLocked?: boolean;
}

export default function BadgeGrid({ 
  badges: badgesJson, 
  unlockedBadgeIds: unlockedIdsJson, 
  category,
  showLocked = true 
}: BadgeGridProps) {
  // Parse JSON props from Astro
  const badges: BadgeData[] = JSON.parse(badgesJson || '[]');
  const unlockedIdsArray: string[] = JSON.parse(unlockedIdsJson || '[]');
  const unlockedBadgeIds = new Set(unlockedIdsArray);

  // Filtrer par catégorie si spécifiée
  const filteredBadges = category 
    ? badges.filter(b => b.category === category)
    : badges;

  // Trier : débloqués en premier, puis par rareté (legendary > epic > rare > common)
  const sortedBadges = [...filteredBadges].sort((a, b) => {
    const aUnlocked = unlockedBadgeIds.has(a.id);
    const bUnlocked = unlockedBadgeIds.has(b.id);
    
    if (aUnlocked !== bUnlocked) {
      return aUnlocked ? -1 : 1;
    }
    
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    return rarityOrder[a.rarity] - rarityOrder[b.rarity];
  });

  // Filtrer les badges verrouillés si showLocked est false
  const displayBadges = showLocked 
    ? sortedBadges 
    : sortedBadges.filter(b => unlockedBadgeIds.has(b.id));

  if (displayBadges.length === 0) {
    return (
      <div className="badge-grid badge-grid--empty">
        <p className="badge-grid__empty-message">
          {category ? `Aucun badge ${category} disponible` : 'Aucun badge disponible'}
        </p>
      </div>
    );
  }

  return (
    <div className="badge-grid">
      {displayBadges.map((badge) => (
        <Badge
          key={badge.id}
          badge={badge}
          isUnlocked={unlockedBadgeIds.has(badge.id)}
          size="medium"
          showTooltip={true}
        />
      ))}
    </div>
  );
}
