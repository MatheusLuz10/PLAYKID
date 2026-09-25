// Quantidades calculadas a partir de content/*.json: os roteiros não quebram quando
// o conteúdo cresce (novas lições, desafios, itens do mundo ou objetos da casa).
const path = require('path');
const read = (f) => require(path.join(__dirname, '../../content', f));

const lessons = read('lessons.json').lessons;
const challenges = read('challenges.json').challenges;
const gamification = read('gamification.json');
const world = read('world.json');
const place = read('place.json');

const worldEarnable = world.items.filter((i) => i.unlock_type !== 'initial').length;
const placeInitial = place.items.filter((i) => i.unlock_type === 'initial').length;
const placeEarnable = place.items.length - placeInitial;

module.exports = {
  lessonsTotal: lessons.length,
  lessonsIn: (category) => lessons.filter((l) => l.category === category).length,
  challengesTotal: challenges.length,
  challengesIn: (category) => challenges.filter((c) => c.category === category).length,
  achievementsTotal: gamification.achievements.length,
  worldItems: world.items.length,
  worldEarnable,
  worldEarnableIn: (category) => world.items.filter((i) => i.category === category && i.unlock_type !== 'initial').length,
  /** Progresso do mundo (mesma fórmula do servidor): 50% itens + 30% desafios + 20% categorias. */
  worldProgress: (items, challengesDone, categories) =>
    Math.min(100, Math.round(100 * (0.5 * (items / worldEarnable) + 0.3 * (challengesDone / challenges.length) + 0.2 * (categories / 6)))),
  placeItems: place.items.length,
  /** código → id dos objetos da casa */
  placeIds: Object.fromEntries(place.items.map((i) => [i.code, i.id])),
  placeInitial,
  placeEarnable,
  placeProgress: (items) => Math.round((100 * items) / placeEarnable),
};
