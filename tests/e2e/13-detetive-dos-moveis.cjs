// ECO QUEST · teste de ponta a ponta (13-detetive-dos-moveis). Veja tests/e2e/README.md.
// Desafio pequeno para crianças sobre os móveis da casa: aula e quiz próprios,
// desafio de 5 etapas (sem foto, sem acompanhamento) e a recompensa na casa 3D.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const { launchOptions } = require('./navegador.cjs');
const OUT = __dirname + '/.saida/13-detetive-dos-moveis';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const MISSAO = '/missao/detetive-dos-moveis';
const quiz = require('../../content/quizzes.json').quizzes.find((q) => q.lesson === 'os-moveis-da-nossa-casa');

const results = { passed: 0, failed: 0 };

async function run(browser, label, viewport) {
  const log = (m) => {
    results.passed++;
    console.log(`  [${label}] ✓ ${m}`);
  };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const welcome = page.getByRole('dialog', { name: 'Bem-vindo ao ECO QUEST' });
  await page.addLocatorHandler(welcome, async () => welcome.getByRole('button', { name: 'Começar' }).click());
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => celebration.getByRole('button', { name: 'Continuar' }).click().catch(() => {}));
  const see = (t) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout: 8000 });

  await page.goto(BASE);
  await criarConta(page, 'moveis_' + label);
  await page.getByLabel('Nome', { exact: true }).fill('Lia');
  await page.getByLabel('Nome de usuário').fill('moveis_' + label);
  await page.getByRole('button', { name: 'Criar perfil' }).click();
  await page.waitForURL('**/inicio');

  // Próximo passo: "Pular por agora" manda a missão para o fim da fila
  await page.getByRole('heading', { name: '🌱 Sua primeira missão' }).waitFor();
  await page.getByRole('button', { name: /Pular “Plante uma árvore” por agora/ }).click();
  await page.locator('.next-step', { hasText: 'Próxima atividade' }).getByText('Cultive uma flor').waitFor();
  await page.getByRole('button', { name: /Pular “Cultive uma flor” por agora/ }).click();
  await page.locator('.next-step').getByText('Crie uma pequena horta').waitFor();
  await page.reload();
  await page.locator('.next-step').getByText('Crie uma pequena horta').waitFor();
  if (await page.getByRole('heading', { name: '🌱 Sua primeira missão' }).count()) throw new Error('missão pulada voltou ao topo');
  log('"Pular por agora": a missão vai para o fim da fila, a próxima aparece e a ordem continua depois de recarregar');

  // Aparece entre os desafios de Comunidade
  await page.goto(BASE + '/desafios?categoria=comunidade');
  await page.locator('.challenge-card', { hasText: 'Detetive dos móveis' }).waitFor();
  log('"Detetive dos móveis" aparece nos desafios de Comunidade');

  // Aula (3 partes, com a pergunta de escolha) e quiz (4 perguntas)
  await page.goto(BASE + '/aula/os-moveis-da-nossa-casa');
  await see('1 de 3');
  await see('Para que servem os móveis?');
  await page.getByRole('button', { name: /Guarda-roupa/ }).click();
  await see('O guarda-roupa guarda roupas');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
  await see('Nunca suba em móveis');
  await page.getByRole('button', { name: 'Concluir aula' }).click();
  await see('+20 XP de conhecimento');
  log('aula "Os móveis da nossa casa": 3 partes, escolha com retorno e dica de segurança');
  await page.getByRole('link', { name: 'Fazer quiz' }).click();
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  for (const [i, q] of quiz.questions.entries()) {
    const right = q.options.find((o) => o.correct).text;
    await page.locator('.option', { hasText: right }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.locator('.feedback').waitFor();
    await page.getByRole('button', { name: i === quiz.questions.length - 1 ? 'Ver resultado' : 'Continuar →' }).click();
  }
  await see('✅ APROVADO');
  log('quiz de 4 perguntas aprovado');

  // Desafio: 4 etapas simples + registro escrito, sem foto e sem acompanhamento
  await page.goto(BASE + MISSAO + '/desafio');
  for (const t of ['Não suba em móveis', 'Um pano seco', 'Encontrar 3 móveis']) await see(t);
  await page.getByRole('button', { name: 'Aceitar desafio' }).click();
  await page.waitForURL('**' + MISSAO + '/comprovar');
  for (let i = 0; i < 4; i++) {
    const before = await page.locator('.checklist-step.is-done').count();
    await page.getByRole('button', { name: '✓ Marcar como feito' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.checklist-step.is-done').length > n, before);
  }
  await page.getByRole('button', { name: '📝 Escrever observação' }).click();
  await page.locator('textarea').fill('Achei o sofá (sentar, tecido), a mesa (apoiar, madeira) e a estante (guardar, madeira). Tirei a poeira da mesa.');
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await see('Checklist concluído!');
  await page.getByRole('button', { name: '🏆 Concluir desafio' }).click();
  await page.waitForURL('**' + MISSAO + '/recompensa');
  await see('+35 XP');
  log('desafio com 5 etapas (sem foto, sem acompanhamento) concluído: +35 XP');

  // Recompensa na casa: a cadeirinha de madeira aparece na sala
  await page.goto(BASE + '/mundo?casa=1');
  await page.locator('.place-room', { hasText: 'Sala' }).waitFor({ timeout: 30000 });
  await page.getByRole('toolbar', { name: 'Navegar pela casa' }).getByRole('button', { name: '🛋️ Sala' }).click();
  await page.waitForTimeout(1000);
  await page.locator('.place-stage').getByRole('button', { name: 'Cadeirinha de madeira: ver detalhes' }).click({ timeout: 15000 });
  await page.getByRole('dialog').getByText('Desbloqueado através do desafio “Detetive dos móveis”.').waitFor();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${OUT}/${label}-cadeirinha.png`, clip: await page.locator('.place-stage').boundingBox() });
  log('recompensa: "Cadeirinha de madeira" na sala da casa, com a origem do desafio');

  console.log(`  [${label}] erros no console: ${JSON.stringify(errors)}`);
  if (errors.length) results.failed++;
  await context.close();
}

(async () => {
  const browser = await chromium.launch(launchOptions);
  for (const [label, viewport] of [
    ['mobile', { width: 390, height: 844 }],
    ['desktop', { width: 1280, height: 900 }],
  ]) {
    try {
      await run(browser, label, viewport);
    } catch (e) {
      results.failed++;
      console.error(`  [${label}] FAIL ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  console.log(`\n${results.passed} verificações ok, ${results.failed} falharam`);
  process.exit(results.failed ? 1 : 0);
})();
