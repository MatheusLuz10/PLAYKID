/**
 * Mundo virtual: leitura do que o jogador conquistou. O servidor decide o que
 * é desbloqueado e em que estágio o mundo está (sync_world / world_progress em
 * 23_world_system.sql); estas funções explicam isso na interface e são
 * reutilizadas pelo modo demonstração, que espelha as mesmas regras.
 */
import type {
  Category,
  ContentCatalog,
  PlayerState,
  PlayerWorldItem,
  WorldArea,
  WorldItem,
  WorldStage,
  WorldStatus,
} from '../models';
import { formatDate } from './dates';
import { computeStats } from './gamification';

export const worldStatusLabels: Record<WorldStatus, string> = {
  empty: 'Vazio',
  evolving: 'Em evolução',
  developed: 'Desenvolvido',
  rich: 'Rico',
  ecosystem: 'Ecossistema',
};

const FALLBACK_STAGE: WorldStage = {
  number: 1,
  name: 'Terreno',
  icon: '🟫',
  description: null,
  status: 'empty',
  minItems: 0,
  minChallenges: 0,
  minCategories: 0,
};

export interface WorldProgressInfo {
  stage: WorldStage;
  next: WorldStage | null;
  /** 0–100: 50% itens + 30% desafios + 20% categorias. */
  progress: number;
  itemsUnlocked: number;
  itemsTotal: number;
  challengesCompleted: number;
  challengesTotal: number;
  categoriesExplored: number;
  categoriesTotal: number;
  /** O que falta para o próximo estágio (null no último). */
  missing: { items: number; challenges: number; categories: number } | null;
}

const isInitial = (content: ContentCatalog, worldItemId: string) =>
  content.worldItems.find((w) => w.id === worldItemId)?.unlockType === 'initial';

/**
 * calculateWorldStage — mesma regra de public.world_progress: o estágio é o maior
 * cujos mínimos (itens, desafios e categorias) foram atingidos. XP não conta.
 */
export function calculateWorldStage(content: ContentCatalog, player: PlayerState): WorldProgressInfo {
  const stats = computeStats(content, player);
  const itemsTotal = content.worldItems.filter((w) => w.unlockType !== 'initial').length;
  const itemsUnlocked = player.world.items.filter((i) => !isInitial(content, i.worldItemId)).length;
  const challengesCompleted = stats.challengesCompleted;
  const challengesTotal = content.challenges.length;
  const categoriesExplored = stats.categoriesExplored;
  const categoriesTotal = content.categories.length;

  const stages = content.worldStages.length ? content.worldStages : [FALLBACK_STAGE];
  const reached = stages.filter(
    (s) => s.minItems <= itemsUnlocked && s.minChallenges <= challengesCompleted && s.minCategories <= categoriesExplored,
  );
  const stage = reached[reached.length - 1] ?? stages[0];
  const next = stages.find((s) => s.number > stage.number) ?? null;
  const progress = Math.min(
    100,
    Math.round(
      100 *
        (0.5 * (itemsUnlocked / Math.max(itemsTotal, 1)) +
          0.3 * (challengesCompleted / Math.max(challengesTotal, 1)) +
          0.2 * (categoriesExplored / Math.max(categoriesTotal, 1))),
    ),
  );
  return {
    stage,
    next,
    progress,
    itemsUnlocked,
    itemsTotal,
    challengesCompleted,
    challengesTotal,
    categoriesExplored,
    categoriesTotal,
    missing: next
      ? {
          items: Math.max(0, next.minItems - itemsUnlocked),
          challenges: Math.max(0, next.minChallenges - challengesCompleted),
          categories: Math.max(0, next.minCategories - categoriesExplored),
        }
      : null,
  };
}

// ---------- Itens: origem e como desbloquear ----------

const quote = (s: string) => `“${s}”`;

/** "Conquistada através de: …" */
export function itemSourceLabel(content: ContentCatalog, owned: PlayerWorldItem): string {
  switch (owned.sourceType) {
    case 'initial':
      return 'Mundo inicial';
    case 'lesson': {
      const l = content.lessons.find((x) => x.id === owned.sourceId);
      return l ? `Lição ${quote(l.title)}` : 'Uma lição concluída';
    }
    case 'challenge': {
      const c = content.challenges.find((x) => x.id === owned.sourceId);
      return c ? `Desafio ${quote(c.title)}` : 'Um desafio concluído';
    }
    case 'achievement': {
      const a = content.achievements.find((x) => x.id === owned.sourceId);
      return a ? `Conquista ${quote(a.title)}` : 'Uma conquista';
    }
    case 'level': {
      const lv = content.levels.find((x) => x.number === Number(content.worldItems.find((w) => w.id === owned.worldItemId)?.unlockReference));
      return lv ? `Nível ${lv.number} · ${lv.name}` : 'Sua evolução de nível';
    }
  }
}

/** Como liberar um item ainda bloqueado (regras transparentes). */
export function unlockHint(content: ContentCatalog, item: WorldItem): string {
  const ref = item.unlockReference ?? '';
  let hint: string;
  switch (item.unlockType) {
    case 'initial':
      hint = 'Faz parte do mundo inicial.';
      break;
    case 'lesson': {
      const l = content.lessons.find((x) => x.slug === ref);
      hint = l ? `Conclua a lição ${quote(l.title)}.` : 'Conclua a lição indicada.';
      break;
    }
    case 'challenge': {
      const c = content.challenges.find((x) => x.slug === ref);
      hint = c ? `Conclua o desafio ${quote(c.title)}.` : 'Conclua o desafio indicado.';
      break;
    }
    case 'achievement': {
      const a = content.achievements.find((x) => x.slug === ref);
      hint = a ? `Desbloqueie a conquista ${quote(a.title)}: ${a.description.charAt(0).toLowerCase()}${a.description.slice(1)}` : 'Desbloqueie a conquista indicada.';
      break;
    }
    case 'level':
      hint = `Alcance o nível ${ref}.`;
      break;
  }
  if (item.minLevel) hint += ` É preciso também estar no nível ${item.minLevel} ou acima.`;
  return hint;
}

// ---------- Áreas e categorias ----------

export interface AreaView {
  area: WorldArea;
  items: WorldItem[];
  owned: Map<string, PlayerWorldItem>;
  unlocked: number;
}

export function buildAreas(content: ContentCatalog, player: PlayerState): AreaView[] {
  const owned = new Map(player.world.items.map((i) => [i.worldItemId, i]));
  return content.worldAreas.map((area) => {
    const items = content.worldItems.filter((w) => w.area === area.code);
    const mine = new Map(items.filter((w) => owned.has(w.id)).map((w) => [w.id, owned.get(w.id)!]));
    return { area, items, owned: mine, unlocked: mine.size };
  });
}

export interface WorldCategoryView {
  category: Category;
  unlocked: number;
  total: number;
}

/** Itens conquistados por categoria (sem os do mundo inicial). */
export function worldCategories(content: ContentCatalog, player: PlayerState): WorldCategoryView[] {
  const owned = new Set(player.world.items.map((i) => i.worldItemId));
  return content.categories.map((category) => {
    const items = content.worldItems.filter((w) => w.categoryId === category.id && w.unlockType !== 'initial');
    return { category, unlocked: items.filter((w) => owned.has(w.id)).length, total: items.length };
  });
}

// ---------- Por que evoluiu / história ----------

/** Frases a partir das ações reais registradas. */
export function whyEvolved(content: ContentCatalog, player: PlayerState): { icon: string; text: string }[] {
  const lines: { icon: string; text: string }[] = [];
  for (const c of content.challenges) {
    if (player.challenges[c.id]?.status === 'completed') lines.push({ icon: c.icon, text: `Concluiu o desafio ${quote(c.title)}` });
  }
  const stats = computeStats(content, player);
  if (stats.followupsCompleted > 0)
    lines.push({ icon: '📅', text: `Registrou ${stats.followupsCompleted} ${stats.followupsCompleted === 1 ? 'acompanhamento' : 'acompanhamentos'} das suas ações` });
  const learned = stats.byCategory.filter((c) => c.lessonsCompleted > 0);
  if (learned.length)
    lines.push({
      icon: '📚',
      text: `Aprendeu ${stats.lessonsCompleted} ${stats.lessonsCompleted === 1 ? 'lição' : 'lições'} (${learned.map((c) => c.category.name).join(', ')})`,
    });
  if (stats.achievementsUnlocked > 0)
    lines.push({ icon: '🏆', text: `Desbloqueou ${stats.achievementsUnlocked} ${stats.achievementsUnlocked === 1 ? 'conquista' : 'conquistas'}` });
  return lines;
}

export interface HistoryEntry {
  key: string;
  date: string;
  icon: string;
  text: string;
}

export function worldHistory(content: ContentCatalog, player: PlayerState): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const owned of player.world.items) {
    const item = content.worldItems.find((w) => w.id === owned.worldItemId);
    if (!item) continue;
    let text: string;
    switch (owned.sourceType) {
      case 'initial':
        text = `Seu mundo começou: ${player.world.name}.`;
        break;
      case 'challenge': {
        const c = content.challenges.find((x) => x.id === owned.sourceId);
        text = `Você concluiu ${c ? quote(c.title) : 'um desafio'} e surgiu: ${item.name}.`;
        break;
      }
      case 'achievement': {
        const a = content.achievements.find((x) => x.id === owned.sourceId);
        text = `Conquista ${a ? quote(a.title) : ''} desbloqueada e surgiu: ${item.name}.`;
        break;
      }
      case 'lesson': {
        const l = content.lessons.find((x) => x.id === owned.sourceId);
        text = `Você aprendeu ${l ? quote(l.title) : 'uma lição'} e surgiu: ${item.name}.`;
        break;
      }
      case 'level':
        text = `Você chegou ao nível ${item.unlockReference} e surgiu: ${item.name}.`;
        break;
    }
    entries.push({ key: owned.id, date: owned.unlockedAt, icon: item.icon, text });
  }
  for (const h of player.world.stageHistory) {
    const stage = content.worldStages.find((s) => s.number === h.stage);
    if (stage)
      entries.push({ key: `stage-${h.stage}`, date: h.reachedAt, icon: stage.icon, text: `Seu mundo chegou ao estágio ${stage.number} · ${stage.name}.` });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));
}

/** "Hoje", "Ontem", "3 dias atrás"… (datas do calendário local). */
export function relativeDay(iso: string, nowValue: Date | number): string {
  const d = new Date(iso);
  const now = new Date(nowValue);
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 30) return `${diff} dias atrás`;
  return formatDate(iso);
}

/** Mensagem para os itens que acabaram de surgir (o mais marcante primeiro). */
export function growthMessage(items: WorldItem[]): { icon: string; title: string; message: string } {
  const featured =
    items.find((i) => i.unlockTitle && i.unlockType === 'challenge') ?? items.find((i) => i.unlockTitle) ?? null;
  if (featured) return { icon: featured.icon, title: featured.unlockTitle!, message: featured.unlockMessage ?? '' };
  return {
    icon: '🌎',
    title: 'Seu mundo evoluiu!',
    message: 'O que você aprendeu e fez no mundo real acabou de transformar o seu mundo.',
  };
}
