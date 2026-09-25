// ECO QUEST · teste de ponta a ponta (06-gamificacao). Veja tests/e2e/README.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const C = require('./conteudo.cjs');
const OUT = __dirname + '/.saida/06-gamificacao';
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
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  // Etapa 8: as boas-vindas do primeiro acesso são testadas em e2e8; aqui já contam como vistas.
  await page.addInitScript(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: true });
  const see = (t, timeout = 6000) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout });
  const log = (m) => console.log(`  [${label}] ✓ ${m}`);
  const overflow = [];
  const checkOverflow = async (w) => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) overflow.push(w);
  };
  const dialog = page.getByRole('dialog');
  /** Confere a celebração e fecha com "Continuar". */
  const celebrate = async (texts, shotName) => {
    await dialog.waitFor({ timeout: 6000 });
    for (const t of texts) await dialog.getByText(t, { exact: false }).first().waitFor({ timeout: 3000 });
    if (shotName) {
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${OUT}/${label}-${shotName}.png` });
    }
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.waitFor({ state: 'detached' });
  };
  const doQuiz = async (letters) => {
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
    for (let i = 0; i < letters.length; i++) {
      await page.locator('.option', { has: page.locator('.option__letter', { hasText: letters[i] }) }).click();
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();
      await page.locator('.feedback').waitFor();
      await page.getByRole('button', { name: i === letters.length - 1 ? 'Ver resultado' : 'Continuar →' }).click();
    }
  };
  const readLesson = async (slug, parts) => {
    await page.goto(BASE + '/aula/' + slug);
    await see(`1 de ${parts}`);
    for (let i = 0; i < parts - 1; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.getByRole('button', { name: 'Concluir aula' }).click();
  };
  const markStep = async () => {
    const before = await page.locator('.checklist-step.is-done').count();
    await page.getByRole('button', { name: '✓ Marcar como feito' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.checklist-step.is-done').length > n, before);
  };
  const xpOnDashboard = async (text) => {
    await page.goto(BASE + '/inicio');
    await page.locator('.evolution-card').getByText(text, { exact: false }).first().waitFor({ timeout: 6000 });
  };

  // Perfil novo
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
  const evo = page.locator('.evolution-card');
  await evo.getByText('Nível 1').waitFor();
  await evo.getByText('Explorador').waitFor();
  await evo.getByText('/ 100 XP').waitFor();
  await evo.getByText('para o nível 2').waitFor();
  const bar0 = await evo.getByRole('progressbar').getAttribute('aria-valuetext');
  if (!bar0.startsWith('0 de 100 XP')) throw new Error('barra inicial: ' + bar0);
  log('Início · "Sua evolução": nível 1 Explorador, 0 / 100 XP, barra 0 de 100');
  await checkOverflow('inicio');

  // Galeria antes de tudo
  await page.goto(BASE + '/conquistas');
  await see(`0 de ${C.achievementsTotal} desbloqueadas`);
  const curioso = page.locator('.achievement', { hasText: 'Curioso' });
  await curioso.getByText('0 / 5 lições').waitFor();
  await curioso.getByText('Conclua mais 5 lições.').waitFor();
  log('Conquistas · 18 cadastradas, bloqueadas com progresso e dica ("0 / 5 lições")');

  // 1) Lição → XP + "Primeiro Aprendizado"
  await readLesson('por-que-as-arvores-sao-importantes', 5);
  await celebrate(['Conquista desbloqueada', 'Primeiro Aprendizado', '+10 XP'], '01-conquista');
  const focusOk = true;
  log('Lição concluída → celebração "Primeiro Aprendizado" (+10 XP)');
  await see('+20 XP');

  // 2) Quiz → XP + "Primeiro Conhecimento" (fecha com Esc)
  await page.getByRole('link', { name: 'Fazer quiz' }).click();
  await doQuiz(['B', 'C', 'A', 'D', 'B']);
  await dialog.getByText('Primeiro Conhecimento').waitFor();
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  if (focused !== 'Continuar') throw new Error('foco não está no botão: ' + focused);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  log('Quiz aprovado → "Primeiro Conhecimento"; foco no "Continuar" e Esc fecha');
  await xpOnDashboard('70');

  // 3) Aceitar → +5 XP (aviso)
  await page.goto(BASE + TREE + '/desafio');
  await page.getByRole('button', { name: 'Aceitar desafio' }).click();
  await see('Desafio iniciado');
  await see('+5 XP');
  log('Desafio aceito → aviso "+5 XP · Desafio iniciado"');

  // 4) Checklist: etapas com evidência dão +5
  await page.waitForURL('**' + TREE + '/comprovar');
  for (let i = 0; i < 4; i++) await markStep();
  await page.getByRole('button', { name: '📷 Registrar foto' }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await see('Etapa concluída');
  await page.getByRole('button', { name: '📝 Escrever observação' }).click();
  await page.locator('textarea').fill('Plantei um ipê-amarelo no quintal.');
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await see('🌱 Aguardando acompanhamento');
  await xpOnDashboard('85');
  log('Etapas com foto/observação → +5 XP cada (85 XP)');

  // 5) Acompanhamentos (tempo simulado) → subida para o nível 2
  await editDemo(page, `for (const uc of Object.values(db.player.challenges)) for (const f of uc.followups) f.scheduledFor = new Date(Date.now() - 86400000).toISOString();`);
  await page.goto(BASE + TREE + '/acompanhar');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '📷 Registrar acompanhamento' }).first().click();
    await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
    await page.getByRole('button', { name: 'Registrar acompanhamento' }).last().click();
    await page.waitForFunction((n) => document.querySelectorAll('.timeline__item.is-done').length >= n + 2, i);
    if (i === 0) {
      await celebrate(['Você subiu de nível!', 'Nível 2', 'Aprendiz da Natureza', 'novo nível desbloqueado'], '02-nivel');
      log('1º acompanhamento (105 XP) → "Você subiu de nível! · Nível 2 · Aprendiz da Natureza"');
    }
  }

  // 6) Conclusão → +100, conquistas na recompensa, nível 3 na celebração
  await page.getByRole('button', { name: '🏆 Concluir desafio' }).click();
  await page.waitForURL('**' + TREE + '/recompensa');
  await celebrate(['Nível 3', 'Observador']);
  await see('+100 XP');
  await see('“Primeiro Passo”');
  await see('“Primeira Árvore”');
  await see('Nova árvore desbloqueada');
  await checkOverflow('recompensa');
  log('Desafio concluído → +100 XP, "Primeiro Passo" + "Primeira Árvore", nível 3 (Observador), árvore no Mundo');
  await page.reload();
  await see('Desafio concluído');
  if (await dialog.count()) throw new Error('celebração repetida após atualizar');

  // 7) Mundo → "Primeiro Ciclo Completo"
  await page.goto(BASE + '/mundo');
  await celebrate(['Primeiro Ciclo Completo', '+30 XP']);
  await see('Seu mundo cresceu!');
  log('Mundo → "Primeiro Ciclo Completo" (+30 XP)');

  // 8) Início: 375 / 450 XP e última conquista
  await xpOnDashboard('375');
  await evo.getByText('/ 450 XP').waitFor();
  await evo.getByText('75 XP').waitFor();
  await evo.getByText('Primeiro Ciclo Completo').waitFor();
  const bar = await evo.getByRole('progressbar').getAttribute('aria-valuetext');
  if (!bar.startsWith('125 de 200 XP')) throw new Error('barra: ' + bar);
  log('Início · 375 / 450 XP, faltam 75, barra 125 de 200 (só a faixa do nível 3), última conquista');
  await shot('03-inicio');

  // 9) Minha evolução
  await page.getByRole('link', { name: 'Ver detalhes →' }).click();
  await page.waitForURL('**/perfil/evolucao');
  const bd = page.locator('.xp-breakdown');
  for (const [k, v] of [['XP total', '375 XP'], ['Conhecimento', '50 XP'], ['Ações', '175 XP'], ['Conquistas', '150 XP']]) {
    await bd.locator('div', { hasText: k }).getByText(v).first().waitFor();
  }
  await page.locator('.my-actions__item', { hasText: 'Natureza' }).getByText('4').waitFor();
  await see('Total: 4 ações realizadas');
  await page.locator('.category-progress li', { hasText: 'Natureza' }).getByText(`1/${C.challengesIn('natureza')} desafios`).waitFor();
  const firstRow = page.locator('.xp-history__row').first();
  await firstRow.getByText('Conquista desbloqueada').waitFor();
  await firstRow.getByText('Primeiro Ciclo Completo').waitFor();
  await page.locator('.xp-history__row', { hasText: 'Desafio concluído' }).getByText('Plante uma árvore').first().waitFor();
  await checkOverflow('evolucao');
  await shot('04-evolucao');
  log('Minha evolução · XP 375 = 50 conhecimento + 175 ações + 150 conquistas; Natureza 4 ações; histórico (mais recente primeiro)');

  // 10) Galeria
  await page.goto(BASE + '/conquistas');
  await see(`5 de ${C.achievementsTotal} desbloqueadas`);
  const guard = page.locator('.achievement', { hasText: 'Guardião das Plantas' });
  await guard.getByText('4 / 5 ações').waitFor();
  await guard.getByText('Realize mais 1 ação de Natureza.').waitFor();
  await page.locator('.achievement.is-unlocked', { hasText: 'Primeira Árvore' }).getByText('Desbloqueada em').waitFor();
  await page.getByRole('group', { name: 'Filtrar conquistas por categoria' }).getByRole('button', { name: /Água/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('.achievement').length === 1);
  await page.getByRole('group', { name: 'Filtrar conquistas por categoria' }).getByRole('button', { name: 'Todas' }).click();
  await checkOverflow('conquistas');
  await shot('05-conquistas');
  log('Galeria · 5 de 18, "Guardião das Plantas 4 / 5 ações", filtro por categoria');

  // 11) Perfil
  await page.goto(BASE + '/perfil');
  const pc = page.locator('.profile-card');
  await pc.getByText('Nível 3').waitFor();
  await pc.getByText('Observador').waitFor();
  await pc.getByText('Duda').waitFor();
  await page.locator('.stats div', { hasText: 'Ações realizadas' }).getByText('4').waitFor();
  await page.locator('.stats div', { hasText: 'Conquistas' }).getByText(`5/${C.achievementsTotal}`).waitFor();
  await checkOverflow('perfil');
  await shot('06-perfil');
  log('Perfil · avatar, nome, nível 3 Observador, barra e números da jornada');

  // 12) Vários níveis de uma vez → uma única tela
  await editDemo(page, `db.player.profile.level = 1;`);
  await page.goto(BASE + '/inicio');
  await readLesson('por-que-precisamos-economizar-agua', 3);
  await celebrate(['Você subiu de nível!', 'Níveis alcançados: 2, 3', '2 novos níveis desbloqueados'], '07-varios-niveis');
  if (await dialog.count()) throw new Error('mais de uma tela de nível');
  log('Vários níveis de uma vez → uma única tela ("Níveis alcançados: 2, 3")');

  // 13) Voltar à recompensa e atualizar não gera XP
  await xpOnDashboard('395');
  await page.goto(BASE + TREE + '/recompensa');
  await see('Desafio concluído');
  await page.reload();
  await see('Desafio concluído');
  if (await dialog.count()) throw new Error('celebração repetida');
  await xpOnDashboard('395');
  log('Reabrir/atualizar a recompensa não gera XP nem celebração (395)');

  console.log(`  [${label}] overflow: ${overflow.length ? overflow.join(',') : 'nenhum'} · erros: ${JSON.stringify(errors)}`);
  await browser.close();
  return focusOk;
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
