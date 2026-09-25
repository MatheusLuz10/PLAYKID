/**
 * Níveis e conquistas do MODO DEMONSTRAÇÃO, lidos da mesma fonte que gera o SQL
 * (content/gamification.json → supabase/migrations/22_gamification_content.sql).
 */
import content from '../../../content/gamification.json';
import type { Achievement, AchievementCategory, AchievementRequirement, Level } from '../../models';

interface SourceLevel {
  level: number;
  name: string;
  xp_required: number;
  icon: string;
  description: string;
}
interface SourceAchievement {
  id: string;
  slug: string;
  icon: string;
  name: string;
  description: string;
  category: string;
  type: string;
  value?: string;
  count?: number;
  xp_reward: number;
}

const source = content as { levels: SourceLevel[]; achievements: SourceAchievement[] };

export const demoLevels: Level[] = source.levels.map((l) => ({
  number: l.level,
  name: l.name,
  icon: l.icon,
  xpRequired: l.xp_required,
  description: l.description,
}));

export const demoAchievements: Achievement[] = source.achievements.map((a, i) => ({
  id: a.id,
  slug: a.slug,
  icon: a.icon,
  title: a.name,
  description: a.description,
  category: a.category as AchievementCategory,
  xpReward: a.xp_reward,
  requirementType: a.type as AchievementRequirement,
  requirementValue: a.value ?? '',
  requirementCount: a.count ?? 1,
  order: i + 1,
}));
