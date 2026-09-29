// Verificações de objetos da casa: integração com as atividades reais (etapas 3 a 5).
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const PHOTO = __dirname + '/fixtures/foto.png';
const TREE = '/missao/plante-uma-arvore';
const C = require('./conteudo.cjs');
const PLACE = require('../../content/place.json');
// dentro da cena da casa ficam só os objetos da casa; o quintal fica no Meu Mundo
const INDOOR = PLACE.items.filter((i) => ['sala', 'quarto', 'cozinha', 'estudos'].includes(i.location)).length;

const editDemo = (page, src) =>
  page.evaluate((code) => {
    const k = (() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })();
    const db = JSON.parse(localStorage.getItem(k));
    new Function('db', code)(db);
    localStorage.setItem(k, JSON.stringify(db));
  }, src);

module.exports = async function objetos(page, label, log) {
  const OUT = `${__dirname}/.saida/09-meu-lugar`;
  const see = (t) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout: 8000 });
  const enterHouse = async () => {
    await page.goto(BASE + '/mundo?casa=1');
    await page.locator('.place-room', { hasText: 'Sala' }).waitFor({ timeout: 30000 });
  };
  // quintal: fica no próprio mundo; a lista acessível do mapa abre os detalhes
  const yardDetails = async (name) => {
    await page.goto(BASE + '/mundo');
    await page.getByRole('button', { name: `${name}. Ver detalhes` }).click();
    return page.getByRole('dialog', { name: new RegExp(name) });
  };

  // Usuário novo: casa completa — dentro da casa, os objetos da casa
  await enterHouse();
  const houseBar = page.getByRole('toolbar', { name: 'Navegar pela casa' });
  // andando, só aparecem os objetos por perto e à vista: conta os diferentes vistos em cada cômodo
  const names = new Set();
  for (const room of ['🛋️ Sala', '🛏️ Quarto', '🍳 Cozinha', '📚 Estudos']) {
    await houseBar.getByRole('button', { name: room }).click();
    await page.waitForTimeout(700);
    for (const n of await page.locator('.place-stage .place-hotspot').evaluateAll((els) => els.map((e) => e.title))) names.add(n);
  }
  const seen = names.size;
  if (seen < 8) throw new Error(`poucos objetos vistos dentro da casa: ${seen} de ${INDOOR}`);
  if (await page.locator('.place-stage').getByRole('button', { name: 'Minha Árvore: ver detalhes' }).count()) throw new Error('árvore dentro da casa');
  log(label, `usuário novo: casa completa — ${INDOOR} objetos dentro da casa (${seen} vistos andando pelos cômodos); o quintal fica no Meu Mundo`);

  // Desafio real: aula → quiz → aceitar → etapas com foto e observação → acompanhamentos → concluir
  await page.goto(BASE + '/aula/por-que-as-arvores-sao-importantes');
  await see('1 de 5');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Concluir aula' }).click();
  await page.getByRole('link', { name: 'Fazer quiz' }).click();
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  for (const [i, l] of ['B', 'C', 'A', 'D', 'B'].entries()) {
    await page.locator('.option', { has: page.locator('.option__letter', { hasText: l }) }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.locator('.feedback').waitFor();
    await page.getByRole('button', { name: i === 4 ? 'Ver resultado' : 'Continuar →' }).click();
  }
  await page.getByRole('link', { name: 'Ir para o desafio' }).click();
  await page.getByRole('button', { name: 'Aceitar desafio' }).click();
  await page.waitForURL('**' + TREE + '/comprovar');
  for (let i = 0; i < 4; i++) {
    const before = await page.locator('.checklist-step.is-done').count();
    await page.getByRole('button', { name: '✓ Marcar como feito' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.checklist-step.is-done').length > n, before);
  }
  await page.getByRole('button', { name: '📷 Registrar foto' }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
  await page.locator('textarea').fill('Muda de ipê-amarelo no quintal');
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await page.getByRole('button', { name: '📝 Escrever observação' }).click();
  await page.locator('textarea').fill('Plantei um ipê-amarelo com a minha avó.');
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await see('🌱 Aguardando acompanhamento');

  // Antes de concluir: a árvore já está no quintal (no mundo), como parte da casa completa
  let dialog = await yardDetails('Minha Árvore');
  await dialog.getByText('Faz parte da sua casa completa.').waitFor();
  await dialog.getByRole('button', { name: 'Fechar' }).click();
  await dialog.waitFor({ state: 'detached' });
  // o quadro (dentro da casa) já guarda a origem real: a primeira foto
  const quadro = await page.evaluate((id) => {
    const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}');
    const k = !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session;
    return JSON.parse(localStorage.getItem(k)).place.find((o) => o.itemId === id);
  }, C.placeIds.picture);
  if (!quadro || quadro.sourceType !== 'evidence' || !quadro.evidenceId) throw new Error('quadro sem a origem da foto: ' + JSON.stringify(quadro));
  log(label, 'casa completa: a árvore já está no quintal do mundo; a primeira foto já registra a origem real do quadro');

  await editDemo(page, `for (const uc of Object.values(db.player.challenges)) for (const f of uc.followups) f.scheduledFor = new Date(Date.now() - 86400000).toISOString();`);
  await page.goto(BASE + TREE + '/acompanhar');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '📷 Registrar acompanhamento' }).first().click();
    await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
    await page.getByRole('button', { name: 'Registrar acompanhamento' }).last().click();
    await page.waitForFunction((n) => document.querySelectorAll('.timeline__item.is-done').length >= n + 2, i);
  }
  await page.getByRole('button', { name: '🏆 Concluir desafio' }).click();
  await page.waitForURL('**' + TREE + '/recompensa');
  await page.reload(); // clique repetido / atualização não pode duplicar nada

  // Depois do desafio: a árvore do quintal mostra a origem real e o diário
  dialog = await yardDetails('Minha Árvore');
  await dialog.getByText('Desbloqueado através do desafio “Plante uma árvore”.').waitFor();
  await dialog.getByText('Muda de ipê-amarelo no quintal').waitFor();
  await dialog.getByText('Desbloqueado em').waitFor();
  await page.screenshot({ path: `${OUT}/${label}-06-origem.png` });
  await dialog.getByRole('button', { name: 'Fechar' }).click();
  await dialog.waitFor({ state: 'detached' });
  log(label, 'desafio concluído → a árvore do quintal (no mundo) mostra a origem real, a data e o registro do jogador (diário)');

  // O que ficou salvo: casa completa, sem duplicar
  const storedCodes = () =>
    page.evaluate((ids) => {
      const owned = JSON.parse(localStorage.getItem((() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })())).place.map((o) => o.itemId);
      return { total: owned.length, codes: Object.entries(ids).filter(([, id]) => owned.includes(id)).map(([code]) => code) };
    }, C.placeIds);
  const saved = await storedCodes();
  for (const code of ['book', 'picture', 'my_tree', 'dining_table']) if (!saved.codes.includes(code)) throw new Error('faltou na casa: ' + code);
  if (saved.codes.length !== C.placeItems) throw new Error('casa incompleta: ' + saved.codes.length);
  await enterHouse();
  await page.reload();
  await page.locator('.place-room', { hasText: 'Sala' }).waitFor({ timeout: 30000 });
  const again = await storedCodes();
  if (again.total !== C.placeItems) throw new Error('objetos guardados: ' + again.total);
  log(label, `casa completa guardada (${again.total} objetos); recarregar não duplica nada`);
  await page.getByRole('button', { name: '✕ Sair da casa' }).click();
};
