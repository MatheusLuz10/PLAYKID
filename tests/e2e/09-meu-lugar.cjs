// ECO QUEST · teste de ponta a ponta (09-meu-lugar). Veja tests/e2e/README.md.
// Casa 3D: abre no celular e no desktop, desenha a cena, controles, navegação por
// cômodos, versão sem WebGL e (a partir da etapa 2+) objetos, origem e evolução.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const OUT = __dirname + '/.saida/09-meu-lugar';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const STAGE = Number(process.env.PLACE_STAGE || 5);

const results = { passed: 0, failed: 0 };
const log = (label, m) => {
  results.passed++;
  console.log(`  [${label}] ✓ ${m}`);
};

async function createProfile(page) {
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
}

/** A cena desenhou algo de verdade? (variedade de cores no canvas) */
async function canvasColors(page) {
  const shot = await page.locator('.place-stage').screenshot();
  // PNG: conta bytes distintos como aproximação barata de "não está vazio"
  return new Set(shot.subarray(200, 60000)).size;
}

async function run(browser, label, viewport, extra) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => {
    await celebration.getByRole('button', { name: 'Continuar' }).click();
  });
  await createProfile(page);

  await page.goto(BASE + '/meu-lugar');
  await page.waitForURL('**/mundo?casa=1'); // o endereço antigo leva à casa dentro do Meu Mundo
  await page.getByRole('heading', { name: '🏡 Minha casa' }).waitFor();
  await page.locator('canvas.place-canvas').waitFor();
  await page.waitForTimeout(600);
  const colors = await canvasColors(page);
  if (colors < 40) throw new Error('cena vazia: ' + colors);
  log(label, `cena 3D desenhada (casa, terreno, jardim) — ${viewport.width}px`);
  await page.locator('.place-stage').screenshot({ path: `${OUT}/${label}-01-casa.png` });

  // prévia: a roda do mouse / o dedo sobre a cena rolam a página (a cena não prende)
  const stageBox = await page.locator('.place-stage').boundingBox();
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 500);
  await page.waitForFunction((y) => window.scrollY > y, before, { timeout: 5000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '🏡 Entrar na casa' }).click();
  await page.locator('.immersive.is-active').waitFor();
  await page.getByRole('button', { name: '✕ Sair da casa' }).waitFor();
  log(label, 'casa dentro do Meu Mundo; prévia não prende a página (a roda rola a tela); "Entrar na casa" abre em tela cheia com "Sair da casa" sempre à vista');

  // controles
  const inside = page.getByRole('button', { name: '🔍 Ver por dentro' });
  await inside.click();
  await page.getByRole('button', { name: '🏠 Ver telhado' }).waitFor();
  await page.waitForTimeout(300);
  await page.locator('.place-stage').screenshot({ path: `${OUT}/${label}-02-por-dentro.png` });
  await page.getByRole('button', { name: '🏠 Ver telhado' }).click();
  for (const name of ['Girar para a esquerda', 'Girar para a direita', 'Aproximar', 'Afastar']) {
    await page.getByRole('button', { name }).click();
  }
  await page.getByRole('toolbar', { name: 'Navegar pela casa' }).getByRole('button', { name: '🛋️ Sala' }).click();
  await page.waitForTimeout(900);
  await page.locator('.place-stage').screenshot({ path: `${OUT}/${label}-03-sala.png` });
  await page.getByRole('toolbar', { name: 'Navegar pela casa' }).getByRole('button', { name: '🌳 Jardim' }).click();
  await page.waitForTimeout(900);
  // arrastar (mouse/toque) gira a câmera sem erro
  const box = await page.locator('canvas.place-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -300);
  log(label, 'controles: ver por dentro, girar, aproximar/afastar, cômodos, jardim, arrastar e roda do mouse');
  // "Sair da casa" (tela cheia) volta para o mapa do mundo, na visão geral
  await page.getByRole('button', { name: '✕ Sair da casa' }).click();
  await page.waitForURL('**/mundo?tela=cheia');
  await page.getByRole('button', { name: '✕ Sair do mundo' }).waitFor();
  await page.waitForFunction(() => document.querySelector('.world3d-stage')?.getAttribute('data-focus') === 'overview');
  await page.getByRole('button', { name: '✕ Sair do mundo' }).click();
  if (await page.evaluate(() => document.body.style.overflow === 'hidden')) throw new Error('página continuou travada');
  // o botão "Sair da casa" do topo (fora da tela cheia) também volta para o mapa
  await page.getByRole('button', { name: /Minha casa/ }).click();
  await page.getByRole('heading', { name: '🏡 Minha casa' }).waitFor();
  await page.getByRole('button', { name: '🚪 Sair da casa' }).click();
  await page.locator('canvas.world3d-canvas').waitFor();
  if (page.url().includes('casa=')) throw new Error('continuou na casa');
  log(label, '"Sair da casa" volta para o mapa do mundo na visão geral (e a página volta a rolar)');
  await page.goto(BASE + '/meu-lugar');
  await page.getByRole('button', { name: '🏡 Entrar na casa' }).click();

  if (STAGE >= 2 && extra) await extra(page, label, log);

  // rolagem horizontal
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (o > 0) throw new Error('rolagem horizontal +' + o);
  console.log(`  [${label}] erros no console: ${JSON.stringify(errors)}`);
  if (errors.length) results.failed++;
  await context.close();
}

async function noWebGL(browser) {
  const context = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).startsWith('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  await createProfile(page);
  await page.goto(BASE + '/meu-lugar');
  await page.getByText('Seu aparelho não conseguiu abrir a visualização em 3D.').waitFor();
  if (await page.locator('canvas.place-canvas').count()) throw new Error('canvas sem WebGL');
  log('sem WebGL', 'aviso amigável no lugar da cena (sem tela quebrada)');
  if (STAGE >= 2) {
    await page.getByRole('heading', { name: /Objetos da casa/ }).waitFor();
    log('sem WebGL', 'a lista de objetos continua disponível como alternativa');
  }
  await context.close();
}

module.exports = { run, noWebGL, results, log, createProfile, BASE, OUT };

if (require.main === module) {
  (async () => {
    const browser = await chromium.launch();
    const extra = require('./09-meu-lugar.objetos.cjs');
    await run(browser, 'mobile', { width: 375, height: 760 }, extra);
    await run(browser, 'desktop', { width: 1280, height: 860 }, extra);
    await noWebGL(browser);
    await browser.close();
    console.log(`\n${results.passed} verificações ok, ${results.failed} falharam`);
    process.exit(results.failed ? 1 : 0);
  })().catch((e) => {
    console.error('FAIL', e.message);
    process.exit(1);
  });
}
