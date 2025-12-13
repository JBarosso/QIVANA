// ============================================
// BADGE TYPES
// ============================================

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
