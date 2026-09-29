// ECO QUEST · teste de ponta a ponta (14-visitas). Veja tests/e2e/README.md.
// Visitar o mundo e a casa de outro jogador pelo @usuário (só olhar), e a casa completa:
// Bia cria a conta e o perfil; Caio cria outra conta, visita Bia, entra na casa dela e volta.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const { launchOptions } = require('./navegador.cjs');
const C = require('./conteudo.cjs');
const OUT = __dirname + '/.saida/14-visitas';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';

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
  const see = (t) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout: 15000 });
  const bia = `bia_${label}`;
  const caio = `caio_${label}`;
  const profile = async (name, user) => {
    await page.getByLabel('Nome', { exact: true }).fill(name);
    await page.getByLabel('Nome de usuário').fill(user);
    await page.getByRole('button', { name: 'Criar perfil' }).click();
    await page.waitForURL('**/inicio');
  };

  // Bia: conta nova já tem a casa completa
  await page.goto(BASE);
  await criarConta(page, bia);
  await profile('Bia', bia);
  await page.goto(BASE + '/mundo?casa=1');
  await page.locator('.place-room', { hasText: 'Sala' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  if ((await page.locator('.place-stage .place-hotspot').count()) < 1) throw new Error('casa vazia');
  await page.getByRole('button', { name: '✕ Sair da casa' }).click();
  log('casa completa: conta nova já entra numa casa mobiliada');
  await page.goto(BASE + '/mundo');
  await see(`Seu @usuário para os amigos visitarem você: @${bia}`);
  log('Meu Mundo mostra o próprio @usuário para os amigos visitarem');

  // Caio: outra conta no mesmo aparelho
  await page.goto(BASE + '/perfil');
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(BASE + '/');
  await criarConta(page, caio);
  await profile('Caio', caio);

  // @usuário que não existe
  await page.goto(BASE + '/mundo');
  await page.getByLabel('@usuário do amigo').fill('@ninguem_aqui');
  await page.getByRole('button', { name: 'Visitar', exact: true }).click();
  await see('Não encontramos ninguém com esse @usuário');
  log('@usuário inexistente: mensagem clara, sem quebrar');

  // Visita a Bia (com @ e maiúsculas)
  await page.goto(BASE + '/mundo');
  await page.getByLabel('@usuário do amigo').fill('@' + bia.toUpperCase());
  await page.getByRole('button', { name: 'Visitar', exact: true }).click();
  await page.waitForURL(`**/mundo/visitar/${bia}`);
  await page.getByRole('heading', { name: '🌎 Mundo de Bia' }).waitFor();
  await see('Você está visitando');
  await see('Visita só para olhar');
  await page.locator('canvas.world3d-canvas').waitFor({ timeout: 60000 });
  if (await page.getByText(/@|e-mail|XP/).filter({ hasText: 'x.com' }).count()) throw new Error('dado privado na visita');
  log('visita pelo @usuário: mundo 3D da Bia, com nome, avatar e nível (nada de fotos, diário ou e-mail)');

  // Casa da Bia: pelo botão e pelo mapa (tela cheia, andando)
  await page.getByRole('button', { name: '🏡 Entrar na casa de Bia' }).click();
  await page.getByRole('heading', { name: '🏡 Casa de Bia' }).waitFor();
  await page.locator('.place-room', { hasText: 'Sala' }).waitFor({ timeout: 30000 });
  // a casa visitada tem o mesmo visual e controles da própria casa (tela cheia + joystick)
  await page.locator('.immersive.is-active .place-stage').waitFor();
  await page.getByRole('application', { name: /Controle para andar pela casa/ }).waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${label}-casa-da-bia.png` });
  const spots = await page.locator('.place-stage .place-hotspot').count();
  if (spots < 1) throw new Error('casa visitada sem objetos');
  await page.getByRole('button', { name: '✕ Sair da casa' }).click();
  await page.getByRole('heading', { name: '🌎 Mundo de Bia' }).waitFor();
  log('entra na casa da Bia andando pelos cômodos; "Sair da casa" volta ao mundo dela');

  // Voltar para o próprio mundo
  await page.getByRole('link', { name: '← Voltar para o meu mundo' }).click();
  await page.waitForURL('**/mundo');
  // o mundo 3D volta a carregar: no computador de teste isso pode passar de 15 s
  await page.getByText('Seu @usuário para os amigos visitarem você: @' + caio).waitFor({ timeout: 45000 });
  log('"Voltar para o meu mundo" leva de volta ao Meu Mundo do Caio');

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
