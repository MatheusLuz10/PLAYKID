// ECO QUEST · teste de ponta a ponta (15-reserva-florestal). Veja tests/e2e/README.md.
// Reserva Florestal da Amazônia no Meu Mundo: uma conta nova abre a reserva, lê a aula
// "Por que preservar a floresta?", faz o quiz (aprovada) e a reserva mostra o ✅.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const { launchOptions } = require('./navegador.cjs');
const OUT = __dirname + '/.saida/15-reserva-florestal';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const SLUG = 'por-que-preservar-a-floresta';
const quiz = require('../../content/quizzes.json').quizzes.find((q) => q.lesson === SLUG);
const lesson = require('../../content/lessons.json').lessons.find((l) => l.slug === SLUG);

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
  await page.addLocatorHandler(welcome, async () => welcome.getByRole('button', { name: 'Começar' }).click().catch(() => {}));
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => celebration.getByRole('button', { name: 'Continuar' }).click().catch(() => {}));
  const see = (t) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout: 15000 });

  await page.goto(BASE);
  await criarConta(page, 'reserva_' + label);
  await page.getByLabel('Nome', { exact: true }).fill('Iara');
  await page.getByLabel('Nome de usuário').fill('reserva_' + label);
  await page.getByRole('button', { name: 'Criar perfil' }).click();
  await page.waitForURL('**/inicio');

  // Abre a reserva pelo Meu Mundo (lista acessível do mapa)
  const openReserve = async () => {
    await page.goto(BASE + '/mundo');
    await page.getByRole('button', { name: 'Reserva Florestal da Amazônia. Explorar e fazer os quizzes' }).click();
    return page.getByRole('dialog', { name: /Reserva Florestal da Amazônia/ });
  };
  let dialog = await openReserve();
  await dialog.getByText('Leia a aula curtinha e depois faça o quiz').first().waitFor();
  await page.screenshot({ path: `${OUT}/${label}-01-reserva.png` });
  log('conta nova: a reserva mostra fauna, flora, reflorestamento e os quizzes para começar');

  // Aula → quiz
  await dialog.getByRole('link', { name: `Aprender: ${lesson.title}` }).click();
  await page.waitForURL(`**/aula/${SLUG}`);
  await see(`1 de ${lesson.sections.length}`);
  for (let i = 1; i < lesson.sections.length; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Concluir aula' }).click();
  await see('+20 XP de conhecimento');
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
  log(`aula "${lesson.title}" e quiz de ${quiz.questions.length} perguntas aprovado`);

  // De volta à reserva: aprovado
  dialog = await openReserve();
  await dialog.locator('.reserve__quiz', { hasText: lesson.title }).getByText('✅ Quiz aprovado').waitFor();
  await dialog.getByRole('link', { name: 'Aprender: Área de reflorestamento' }).waitFor();
  log('a reserva mostra ✅ no quiz aprovado e os próximos para fazer');

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
