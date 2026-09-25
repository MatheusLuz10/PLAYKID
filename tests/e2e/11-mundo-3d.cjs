// ECO QUEST · teste de ponta a ponta (11-mundo-3d). Veja tests/e2e/README.md.
// Mundo em 3D com as 5 áreas: navegação por área, marcadores sobre a cena,
// detalhes, câmera, celular/desktop e o mapa 2D como alternativa sem WebGL.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { entrarNaDemonstracao } = require('./conta.cjs');
const { launchOptions } = require('./navegador.cjs');
const OUT = __dirname + '/.saida/11-mundo-3d';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const world = require('../../content/world.json');
const AREAS = world.areas.map((a) => ({ ...a, items: world.items.filter((i) => i.area === a.code) }));

const results = { passed: 0, failed: 0 };

/** Conta de demonstração (sem senha, tudo desbloqueado): o mundo aparece cheio. */
async function openWorld(browser, viewport, init) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1'));
  if (init) await page.addInitScript(init);
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => celebration.getByRole('button', { name: 'Continuar' }).click());
  await entrarNaDemonstracao(page, BASE);
  await page.goto(BASE + '/mundo');
  return { context, page, errors };
}

async function run(browser, label, viewport) {
  const log = (m) => {
    results.passed++;
    console.log(`  [${label}] ✓ ${m}`);
  };
  const { context, page, errors } = await openWorld(browser, viewport);
  const stage = page.locator('.world3d-stage');
  const snap = async (name) => {
    await page.evaluate(() => document.querySelector('.world3d-stage').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${label}-${name}.png`, clip: await stage.boundingBox(), timeout: 120000 });
  };
  const bar = page.getByRole('toolbar', { name: 'Navegar pelo mundo' });
  const focusIs = (f) =>
    page.waitForFunction((v) => document.querySelector('.world3d-stage')?.getAttribute('data-focus') === v, f, { timeout: 20000 });

  await page.locator('canvas.world3d-canvas').waitFor({ timeout: 60000 });
  await bar.getByRole('button', { name: /Visão geral/ }).click();
  await focusIs('overview');
  await page.waitForTimeout(1500);
  const areaPins = await page.locator('.world3d-area-pin').count();
  if (areaPins !== 5) throw new Error('nomes das áreas na visão geral: ' + areaPins);
  await snap('01-visao-geral');
  log('visão geral: as 5 áreas numa paisagem, com o nome e o progresso de cada uma');

  for (const area of AREAS) {
    await bar.getByRole('button', { name: new RegExp(area.name) }).click();
    await focusIs(area.code);
    await page.waitForTimeout(1500);
    const pins = await page.locator('.world3d-hotspot').count();
    if (pins !== area.items.length) throw new Error(`${area.name}: ${pins} marcadores de ${area.items.length}`);
    await snap(`02-${area.code}`);
  }
  log('cada área: a câmera voa até ela e todos os elementos têm marcador (' + AREAS.map((a) => a.items.length).join('+') + ')');

  // marcador sobre a cena abre os detalhes (horta → tomate)
  await bar.getByRole('button', { name: /Horta/ }).click();
  await focusIs('garden');
  await page.waitForTimeout(1500);
  await page.locator('.world3d-hotspot[title="Tomate"]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Tomate').first().waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  log('toque no marcador (Tomate, na horta) abre os detalhes do item');

  // nome da área na visão geral leva até ela
  await bar.getByRole('button', { name: /Visão geral/ }).click();
  await focusIs('overview');
  await page.waitForTimeout(1500);
  await page.locator('.world3d-area-pin', { hasText: 'Área da água' }).click();
  await focusIs('water');
  for (const name of ['Girar para a esquerda', 'Girar para a direita', 'Aproximar', 'Afastar']) await page.getByRole('button', { name }).click();
  const box = await page.locator('canvas.world3d-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  log('nome da área leva até ela; girar, aproximar, afastar e arrastar funcionam');

  // lista acessível: foco pelo teclado leva a câmera até a área do item
  await page.getByRole('button', { name: 'Composteira. Ver detalhes' }).focus();
  await focusIs('garden');
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByText('Composteira').first().waitFor();
  await page.keyboard.press('Escape');
  log('teclado: focar um item da lista leva a câmera até a área dele; Enter abre os detalhes');

  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (extra > 0) throw new Error('rolagem horizontal +' + extra);
  log('sem rolagem horizontal');

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
  try {
    const { context, page } = await openWorld(browser, { width: 375, height: 760 }, () => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return String(type).startsWith('webgl') ? null : original.call(this, type, ...args);
      };
    });
    await page.locator('.world-map').waitFor();
    if (await page.locator('canvas.world3d-canvas').count()) throw new Error('3D sem WebGL');
    await page.goto(BASE + '/mundo/previa-3d');
    await page.waitForURL('**/mundo');
    results.passed++;
    console.log('  [sem WebGL] ✓ o mapa 2D aparece no lugar do 3D; o endereço da prévia antiga leva ao mundo');
    await context.close();
  } catch (e) {
    results.failed++;
    console.error(`  [sem WebGL] FAIL ${e.message.split('\n')[0]}`);
  }
  await browser.close();
  console.log(`\n${results.passed} verificações ok, ${results.failed} falharam`);
  process.exit(results.failed ? 1 : 0);
})();
