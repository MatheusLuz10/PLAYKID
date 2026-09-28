// Verificações de objetos da casa: integração com as atividades reais (etapas 3 a 5).
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const PHOTO = __dirname + '/fixtures/foto.png';
const TREE = '/missao/plante-uma-arvore';
const C = require('./conteudo.cjs');

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
  const spots = () => page.locator('.place-hotspot');

  // Usuário novo: só a casa inicial
  await page.getByRole('toolbar', { name: 'Navegar pela casa' }).getByRole('button', { name: '🏡 Visão geral' }).click();
  await page.waitForTimeout(900);
  const initial = await spots().count();
  if (initial !== C.placeInitial) throw new Error(`casa inicial deveria ter ${C.placeInitial} objetos: ` + initial);
  await see('Pequena casa');
  await see(`Objetos da casa (${C.placeInitial}/${C.placeItems})`);
  log(label, 'usuário novo: casa inicial (mesa e cadeira), estágio 1 "Pequena casa"');

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

  // Antes de concluir: livro (primeira lição) e quadro (primeira foto) já apareceram; a árvore não.
  await page.goto(BASE + '/meu-lugar');
  await see(`Objetos da casa (${C.placeInitial + 2}/${C.placeItems})`);
  if (await page.getByRole('button', { name: 'Minha Árvore: ver detalhes' }).count()) throw new Error('árvore antes da conclusão');
  log(label, 'lição → livro; primeira foto → quadro; a árvore ainda não (desafio não concluído)');

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

  // Casa depois do desafio
  await page.goto(BASE + '/meu-lugar');
  await see('Sua casa ganhou');
  await see('Minha Árvore');
  await page.getByRole('button', { name: '🏡 Entrar na casa' }).click();
  await page.getByRole('toolbar', { name: 'Navegar pela casa' }).getByRole('button', { name: '🌳 Jardim' }).click();
  await page.waitForTimeout(1000);
  await page.locator('.place-stage').screenshot({ path: `${OUT}/${label}-05-arvore.png` });
  await page.getByRole('button', { name: 'Minha Árvore: ver detalhes' }).click();
  const dialog = page.getByRole('dialog', { name: /Minha Árvore/ });
  await dialog.getByText('Desbloqueado através do desafio “Plante uma árvore”.').waitFor();
  await dialog.getByText('Muda de ipê-amarelo no quintal').waitFor();
  await dialog.getByText('Desbloqueado em').waitFor();
  await page.screenshot({ path: `${OUT}/${label}-06-origem.png` });
  await dialog.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: '✕ Fechar a casa' }).click();
  log(label, 'desafio concluído → Minha Árvore no jardim; toque mostra origem, data e o registro do jogador (diário)');

  // Painel com números reais (conferidos com o que ficou salvo)
  const savedCodes = await page.evaluate((ids) => {
    const owned = new Set(JSON.parse(localStorage.getItem((() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })())).place.map((o) => o.itemId));
    return Object.entries(ids).filter(([, id]) => owned.has(id)).map(([code]) => code);
  }, C.placeIds);
  for (const code of ['book', 'picture', 'my_tree', 'dining_table'])
    if (!savedCodes.includes(code)) throw new Error('faltou na casa: ' + code);
  const earned = savedCodes.length - C.placeInitial;
  const panel = page.locator('.place-panel');
  await panel.getByText('Casa em evolução').waitFor();
  await panel.locator('.stats div', { hasText: 'Objetos desbloqueados' }).getByText(`${earned}/${C.placeEarnable}`).waitFor();
  await panel.locator('.stats div', { hasText: 'Missões realizadas' }).getByText('2', { exact: true }).waitFor();
  await panel.locator('.stats div', { hasText: 'Desafios realizados' }).getByText('1', { exact: true }).waitFor();
  await panel.getByText(`${C.placeProgress(earned)}%`).first().waitFor();
  await page.locator('.place-history').getByText('Plantei').first().waitFor({ state: 'attached' }).catch(() => {});
  log(label, `painel: estágio 2 "Casa em evolução", ${C.placeProgress(earned)}%, ${earned}/${C.placeEarnable} objetos (${savedCodes.filter((c) => !['desk', 'chair'].includes(c)).join(', ')}), 2 missões, 1 desafio`);
  await page.screenshot({ path: `${OUT}/${label}-07-painel.png`, fullPage: true });

  // Persistência e duplicação
  await page.reload();
  await see(`Objetos da casa (${savedCodes.length}/${C.placeItems})`);
  if (await page.getByText('Sua casa ganhou').count()) throw new Error('novidade repetida');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem((() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })())).place.length);
  if (stored !== savedCodes.length) throw new Error('objetos guardados: ' + stored);
  log(label, `recarregar mantém a casa (${stored} objetos), sem duplicar e sem repetir a novidade`);
};
