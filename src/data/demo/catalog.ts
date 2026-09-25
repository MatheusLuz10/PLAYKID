/**
 * Catálogo do MODO DEMONSTRAÇÃO (sem Supabase configurado).
 * Espelha o seed do banco (13_seed.sql e o conteúdo gerado de content/) — mesmos IDs —
 * para que os dois modos se comportem igual.
 */
import type { ContentCatalog } from '../../models';
import { demoChallenges } from './challenges';
import { demoAchievements, demoLevels } from './gamification';
import { demoLessons } from './lessons';
import { demoQuizzes } from './quizzes';
import { demoWorldAreas, demoWorldItems, demoWorldStages } from './world';

const NATUREZA = '10000000-0000-4000-8000-000000000001';


export const demoCatalog: ContentCatalog = {
  categories: [
    {
      id: NATUREZA,
      slug: 'natureza',
      name: 'Natureza',
      icon: '🌳',
      color: '#3f7f4c',
      description: 'Árvores, plantas e o solo que sustenta a vida.',
      imageUrl: null,
      topics: ['Árvores', 'Flores', 'Plantas', 'Solo', 'Florestas', 'Hortas'],
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      slug: 'agua',
      name: 'Água',
      icon: '💧',
      color: '#2f7fae',
      description: 'Cuidar de cada gota, dos rios à torneira de casa.',
      imageUrl: null,
      topics: ['Economia de água', 'Reutilização', 'Chuva', 'Rios', 'Preservação'],
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      slug: 'residuos',
      name: 'Resíduos',
      icon: '♻️',
      color: '#5f8a3a',
      description: 'Reduzir, reutilizar e dar o destino certo ao lixo.',
      imageUrl: null,
      topics: ['Reciclagem', 'Reutilização', 'Compostagem', 'Redução de resíduos', 'Plásticos'],
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      slug: 'energia',
      name: 'Energia',
      icon: '⚡',
      color: '#d0921f',
      description: 'Usar energia com consciência e conhecer fontes limpas.',
      imageUrl: null,
      topics: ['Economia de energia', 'Consumo consciente', 'Energia solar', 'Fontes renováveis'],
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      slug: 'biodiversidade',
      name: 'Biodiversidade',
      icon: '🐝',
      color: '#b7791f',
      description: 'A enorme variedade de vida que compartilha o planeta.',
      imageUrl: null,
      topics: ['Abelhas', 'Borboletas', 'Aves', 'Insetos', 'Animais', 'Ecossistemas'],
    },
    {
      id: '10000000-0000-4000-8000-000000000006',
      slug: 'comunidade',
      name: 'Comunidade',
      icon: '🌎',
      color: '#3b6fa0',
      description: 'Transformações que acontecem quando agimos juntos.',
      imageUrl: null,
      topics: ['Limpeza', 'Hortas comunitárias', 'Projetos ambientais', 'Educação ambiental', 'Ações coletivas'],
    },
  ],

  // Aulas: content/lessons.json (mesma fonte do SQL).
  lessons: demoLessons,

  // Quizzes: content/quizzes.json (mesma fonte do SQL).
  quizzes: demoQuizzes,

  // Desafios e itens do mundo: content/challenges.json (mesma fonte do SQL).
  challenges: demoChallenges,

  // Níveis e conquistas: content/gamification.json (mesma fonte do SQL).
  achievements: demoAchievements,
  levels: demoLevels,

  // Mundo: content/world.json (mesma fonte do SQL).
  worldItems: demoWorldItems,
  worldAreas: demoWorldAreas,
  worldStages: demoWorldStages,
};
