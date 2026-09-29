// ECO QUEST · teste de ponta a ponta (07-mundo). Veja tests/e2e/README.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const { launchOptions } = require('./navegador.cjs');
const C = require('./conteudo.cjs');
const OUT = __dirname + '/.saida/07-mundo';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(__dirname + '/.saida', { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const PHOTO = __dirname + '/fixtures/foto.png';
const TREE = '/missao/plante-uma-arvore';

const editDemo = (page, src) =>
  page.evaluate((code) => {
    const k = (() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })();
    const db = JSON.parse(localStorage.getItem(k));
    new Function('db', code)(db);
    localStorage.setItem(k, JSON.stringify(db));
  }, src);

async function run(label, viewport) {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  // Etapa 8: as boas-vindas do primeiro acesso são testadas em e2e8; aqui já contam como vistas.
  await page.addInitScript(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n, full = true) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: full });
  const see = (t, timeout = 6000) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout });
  const log = (m) => console.log(`  [${label}] ✓ ${m}`);
  const overflow = [];
  const checkOverflow = async (w) => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) overflow.push(w);
  };
  // Celebrações da Etapa 6 (nível/conquista) são fechadas quando aparecem.
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => {
    await celebration.getByRole('button', { name: 'Continuar' }).click();
  });
  const dialog = page.getByRole('dialog');
  const markStep = async () => {
    const before = await page.locator('.checklist-step.is-done').count();
    await page.getByRole('button', { name: '✓ Marcar como feito' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.checklist-step.is-done').length > n, before);
  };

  // Novo usuário
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.clear();
    // o módulo da demonstração pode iniciar depois da limpeza: a marca de teste precisa continuar
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  await page.goto(BASE);
  await criarConta(page, 'duda_eco');
  await page.getByLabel('Nome', { exact: true }).fill('Duda');
  await page.getByLabel('Nome de usuário').fill('duda_eco');
  await page.getByRole('button', { name: 'Criar perfil' }).click();
  await page.waitForURL('**/inicio');

  // 1-3 · Mundo inicial
  await page.goto(BASE + '/mundo');
  await see('Meu Primeiro Ecossistema');
  await see('Estágio 1 de 7');
  await see('Terreno');
  await see('0% de evolução');
  for (const a of ['Área natural', 'Área da água', 'Horta', 'Jardim dos polinizadores', 'Área comunitária'])
    await page.getByRole('heading', { name: a }).waitFor();
  // mundo em 3D: a cena é desenhada (a lista abaixo dela traz os mesmos itens, acessíveis)
  await page.locator('canvas.world3d-canvas').waitFor();
  await page.waitForTimeout(1200);
  const pixels = await page.locator('.world3d-stage').screenshot({ timeout: 90000 });
  if (new Set(pixels.subarray(200, 60000)).size < 60) throw new Error('cena 3D vazia');
  // (a lista também tem o "Quintal da casa": aqui contam só os itens das 5 áreas do mundo)
  const worldAreas = page.locator('.world3d-area').filter({ hasNot: page.locator('#world3d-area-yard') });
  const itemsBtn = worldAreas.getByRole('button', { name: /Ver detalhes$/ });
  const slots = page.getByRole('button', { name: /^Espaço bloqueado/ });
  if ((await itemsBtn.count()) !== 1 || (await slots.count()) !== C.worldItems - 1) throw new Error(`mundo inicial: ${await itemsBtn.count()} itens, ${await slots.count()} bloqueados`);
  log(`Testes 1-3 · "Meu Primeiro Ecossistema": estágio 1 (Terreno), 0%, 5 áreas, 1 planta e ${C.worldItems - 1} espaços bloqueados`);
  await checkOverflow('mundo-inicial');
  await shot('01-mundo-inicial');

  // Espaço bloqueado explica como liberar (sem hover: clique/toque)
  await page.getByRole('button', { name: 'Espaço bloqueado: Árvore jovem. Ver como desbloquear' }).click();
  await dialog.getByText('Como desbloquear').waitFor();
  await dialog.getByText('Conclua o desafio “Plante uma árvore”.').waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Pequena planta. Ver detalhes' }).click();
  await dialog.getByText('Mundo inicial').waitFor();
  await dialog.getByText('O que representa').waitFor();
  await dialog.getByRole('button', { name: 'Fechar' }).click();
  log('Toque no item/espaço abre a explicação; Esc e "Fechar" fecham');

  // Fluxo completo: aula → quiz → desafio → foto → acompanhamentos → conclusão
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
  for (let i = 0; i < 4; i++) await markStep();
  await page.getByRole('button', { name: '📷 Registrar foto' }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await page.getByRole('button', { name: '📝 Escrever observação' }).click();
  await page.locator('textarea').fill('Plantei um ipê-amarelo no quintal.');
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await see('🌱 Aguardando acompanhamento');

  // Antes de concluir: aprender já fez o mundo brotar, mas a árvore ainda não existe
  await page.goto(BASE + '/mundo');
  await page.getByRole('button', { name: 'Arbusto. Ver detalhes' }).waitFor();
  if (await page.getByRole('button', { name: 'Árvore jovem. Ver detalhes' }).count()) throw new Error('árvore antes da conclusão');
  await see('Primeiras plantas');
  log('Aprender já faz o mundo brotar (arbusto, estágio 2); a árvore ainda não aparece');

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
  await see('Nova árvore desbloqueada');
  await see('“Árvore jovem” já está no seu mundo.');
  await see('“Árvore do Primeiro Passo” já está no seu mundo.');
  log('Teste 4/16 · conclusão → recompensa lista a árvore (e o marco "Árvore do Primeiro Passo")');

  // 6 · Árvore aparece no mundo, com mensagem e animação
  await page.getByRole('link', { name: /Ver meu mundo/ }).first().click();
  await page.waitForURL('**/mundo');
  await see('Seu mundo cresceu!');
  await see('Agora existe uma nova árvore no seu mundo ECO QUEST.');
  const tree = page.getByRole('button', { name: 'Árvore jovem. Ver detalhes' });
  await tree.waitFor();
  // no 3D o item novo cresce na cena e aparece marcado como "Novo!" na lista; a câmera vai até a área dele
  if (!(await tree.evaluate((el) => el.classList.contains('is-new')))) throw new Error('árvore nova sem destaque');
  await tree.getByText('Novo!').waitFor();
  const stage = page.locator('.world3d-stage');
  if ((await stage.getAttribute('data-motion')) !== 'on') throw new Error('cena sem movimento (vento, água)');
  await page.waitForFunction(() => document.querySelector('.world3d-stage')?.getAttribute('data-focus') === 'natural');
  await see('Estágio 3 de 7');
  const worldPct = C.worldProgress(await page.evaluate(() => JSON.parse(localStorage.getItem((() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })())).player.world.items.filter((i) => i.sourceType !== 'initial').length), 1, 1);
  await see(`${worldPct}% de evolução`);
  log(`Teste 6/19 · "Seu mundo cresceu!", a árvore nova cresce na cena 3D (a câmera vai até a área natural); vento e água em movimento; estágio 3 (Ecossistema), ${worldPct}%`);
  await page.waitForTimeout(900);
  await shot('02-arvore');
  await tree.click();
  await dialog.getByText('Desafio “Plante uma árvore”').waitFor();
  await dialog.getByText('Desbloqueado em').waitFor();
  await dialog.getByText('O plantio que você fez no mundo real').waitFor();
  await page.waitForTimeout(450);
  await shot('03-detalhe', false);
  await dialog.getByRole('button', { name: 'Fechar' }).click();
  log('Detalhe da árvore: data, origem ("Desafio “Plante uma árvore”") e significado');

  // Evolução explicada, categorias e história
  await see('Concluiu o desafio “Plante uma árvore”');
  await see('Você concluiu “Plante uma árvore” e surgiu: Árvore jovem.');
  await see('Seu mundo chegou ao estágio 3 · Ecossistema.');
  await page.locator('.stats div', { hasText: 'Itens desbloqueados' }).getByText(`4 / ${C.worldEarnable}`).waitFor();
  await page.locator('.category-progress li', { hasText: 'Natureza' }).getByText(`3/${C.worldEarnableIn('natureza')} elementos`).waitFor();
  await checkOverflow('mundo');
  log(`Por que evoluiu, história (itens e estágios), 4/${C.worldEarnable} itens, categorias no mundo`);

  // 7 · Atualizar mantém os itens (e já não são "novos")
  await page.reload();
  await tree.waitFor();
  if (await page.getByText('Seu mundo cresceu!').count()) throw new Error('mensagem repetida após atualizar');
  if (await page.locator('.world3d-item.is-new').count()) throw new Error('itens ainda marcados como novos');
  if ((await worldAreas.getByRole('button', { name: /Ver detalhes$/ }).count()) !== 5) throw new Error('quantidade de itens mudou');
  log('Teste 7 · atualizar a página mantém os 5 itens, sem repetir a novidade');

  // Teclado: foco chega ao item e Enter abre
  await tree.focus();
  await page.keyboard.press('Enter');
  await dialog.getByText('Conquistado através de').waitFor();
  await page.keyboard.press('Escape');
  log('Teclado: Enter abre o item, Esc fecha');

  // Início: resumo do mundo
  await page.goto(BASE + '/inicio');
  const summary = page.locator('.world-summary');
  await summary.getByText('Meu Primeiro Ecossistema').waitFor();
  await summary.getByText('Estágio 3 · Ecossistema').waitFor();
  await summary.getByText(`${worldPct}%`).waitFor();
  log('Início · resumo do mundo (estágio, evolução e itens)');
  await shot('04-inicio');

  // 20 · Redução de movimento
  const reduced = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const rp = await reduced.newPage();
  await rp.goto(BASE);
  // mesma conta conectada no outro contexto (copia contas, sessão e progresso)
  const state = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  await rp.evaluate((s) => {
    for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v);
  }, state);
  await rp.goto(BASE + '/mundo');
  await rp.locator('canvas.world3d-canvas').waitFor();
  const rm = await rp.locator('.world3d-stage').getAttribute('data-motion');
  if (rm !== 'off') throw new Error('animação ativa com redução de movimento: ' + rm);
  await reduced.close();
  log('Teste 20 · prefers-reduced-motion desliga as animações decorativas');

  console.log(`  [${label}] overflow: ${overflow.length ? overflow.join(',') : 'nenhum'} · erros: ${JSON.stringify(errors)}`);
  await browser.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await run('mobile', { width: 375, height: 760 });
  await run('desktop', { width: 1280, height: 860 });
  console.log('OK');
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
