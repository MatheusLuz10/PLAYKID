// ECO QUEST · teste de ponta a ponta (08-integracao-final). Veja tests/e2e/README.md.
// Etapa 8 · páginas públicas, primeiro acesso, admin, exclusão de conta,
// offline, responsividade (320–1920), acessibilidade (axe) e CSP de produção.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const { launchOptions } = require('./navegador.cjs');
const C = require('./conteudo.cjs');
const OUT = __dirname + '/.saida/08-integracao-final';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(__dirname + '/.saida', { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const AXE = fs.readFileSync(require.resolve(process.env.AXE_MODULE || 'axe-core/axe.min.js'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(__dirname + '/../../vercel.json', 'utf8'));
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

const results = { passed: 0, failed: 0 };
const log = (label, m) => {
  results.passed++;
  console.log(`  [${label}] ✓ ${m}`);
};

async function newPage(browser, viewport, opts = {}) {
  const context = await browser.newContext({ viewport, ...opts });
  const page = await context.newPage();
  // Demonstração sem conclusão automática: os roteiros começam como usuário novo.
  await page.addInitScript(() => localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // Mesmos cabeçalhos de segurança da produção (vercel.json), para pegar violações de CSP.
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } });
  });
  return { context, page, errors };
}

const createProfile = async (page) => {
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
};
const editDemo = (page, src) =>
  page.evaluate((code) => {
    const k = (() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })();
    const db = JSON.parse(localStorage.getItem(k));
    new Function('db', code)(db);
    localStorage.setItem(k, JSON.stringify(db));
  }, src);

async function flow(browser, label, viewport) {
  const { page, errors, context } = await newPage(browser, viewport);
  const see = (t) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout: 6000 });
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: true });

  // Páginas públicas
  for (const [path, heading, title] of [
    ['/sobre', 'Sobre o ECO QUEST', 'Sobre o ECO QUEST · ECO QUEST'],
    ['/termos', 'Termos de uso', 'Termos de uso · ECO QUEST'],
    ['/privacidade', 'Política de privacidade', 'Privacidade · ECO QUEST'],
    ['/recuperar-senha', 'Recuperar senha', 'Recuperar senha · ECO QUEST'],
    ['/redefinir-senha', 'Criar nova senha', 'Nova senha · ECO QUEST'],
    ['/qualquer-coisa', 'Página não encontrada', 'Página não encontrada · ECO QUEST'],
  ]) {
    await page.goto(BASE + path);
    await page.getByRole('heading', { name: heading }).first().waitFor();
    if ((await page.title()) !== title) throw new Error(`título de ${path}: ${await page.title()}`);
    await page.getByRole('navigation', { name: 'Informações' }).getByRole('link', { name: 'Privacidade' }).waitFor();
  }
  await see('Aprenda. Faça. Transforme.');
  log(label, 'páginas públicas (Sobre, Termos, Privacidade, recuperar/redefinir senha, 404) com título e rodapé');
  await page.goto(BASE + '/sobre');
  await shot('01-sobre');

  // Primeiro acesso: boas-vindas + primeira missão
  await createProfile(page);
  const welcome = page.getByRole('dialog', { name: 'Bem-vindo ao ECO QUEST' });
  await welcome.waitFor();
  await welcome.getByText('Aprenda.').waitFor();
  await page.screenshot({ path: `${OUT}/${label}-02-boas-vindas.png` });
  await welcome.getByRole('button', { name: 'Começar' }).click();
  await welcome.waitFor({ state: 'detached' });
  const mission = page.locator('.first-mission');
  await mission.getByRole('heading', { name: '🌱 Sua primeira missão' }).waitFor();
  if ((await mission.locator('.mission-path__step').count()) !== 7) throw new Error('passos da missão');
  await mission.locator('[aria-current="step"]').getByText('1. Aprender').waitFor();
  await mission.getByText('Seu mundo evolui').waitFor();
  await page.reload();
  await mission.waitFor();
  if (await welcome.count()) throw new Error('boas-vindas repetida');
  log(label, 'primeiro acesso: boas-vindas curta (uma vez) e "Sua primeira missão" com os 7 passos');
  await shot('03-inicio');

  // Rotas alternativas
  await page.goto(BASE + '/meu-mundo');
  await page.waitForURL('**/mundo');
  await page.goto(BASE + '/dashboard');
  await page.waitForURL('**/inicio');
  log(label, 'rotas /dashboard e /meu-mundo levam às telas certas');

  // Admin: bloqueado para jogador comum
  await page.goto(BASE + '/admin');
  await see('Acesso restrito');
  if (await page.getByRole('link', { name: /Admin/ }).count()) throw new Error('link de admin para jogador comum');
  log(label, '/admin bloqueado para jogador comum (e sem link no menu)');

  // Admin: promovido (somente no modo demonstração, direto nos dados locais)
  await editDemo(page, `db.player.profile.role = 'admin';`);
  await page.goto(BASE + '/admin');
  await page.getByRole('heading', { name: '🔐 Admin ECO QUEST' }).waitFor();
  const metric = async (label2) =>
    page.locator('.admin-stats > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label2}$`) }) }).locator('dd').first().innerText().then((t) => t.split(/\s+/)[0]);
  if ((await metric('Usuários cadastrados')) !== '1') throw new Error('usuários');
  if ((await metric('Desafios')) !== String(C.challengesTotal)) throw new Error('desafios cadastrados');
  if ((await metric('Itens do mundo')) !== String(C.worldItems)) throw new Error('itens');
  log(label, `painel admin com números reais (1 usuário, ${C.challengesTotal} desafios, ${C.worldItems} itens)`);
  await shot('04-admin');

  await page.getByRole('tab', { name: '📚 Conteúdo' }).click();
  const acao = page.locator('.admin-table tr', { hasText: 'Participe de uma ação ambiental' });
  await acao.waitFor();
  page.once('dialog', (d) => d.accept());
  await acao.getByRole('button', { name: 'Desativar Participe de uma ação ambiental' }).click();
  await acao.getByText('Desativado').waitFor();
  await page.goto(BASE + '/desafios');
  await see('Plante uma árvore');
  if (await page.getByText('Participe de uma ação ambiental').count()) throw new Error('desafio desativado ainda aparece');
  await page.goto(BASE + '/admin');
  await page.getByRole('tab', { name: '📚 Conteúdo' }).click();
  await acao.getByRole('button', { name: 'Ativar Participe de uma ação ambiental' }).click();
  await acao.getByText('Ativo').waitFor();
  await page.goto(BASE + '/desafios');
  await see('Participe de uma ação ambiental');
  log(label, 'admin desativa um desafio (some para o jogador) e reativa (volta)');

  await page.goto(BASE + '/admin');
  await page.getByRole('tab', { name: '👥 Usuários' }).click();
  await page.locator('.admin-table').getByText('Duda', { exact: true }).waitFor();
  await page.getByRole('tab', { name: '🧾 Registros' }).click();
  await page.getByText('admin.set_active').first().waitFor();
  log(label, 'admin lista usuários e registros (ações administrativas auditadas)');
  await shot('05-admin-registros');

  // Offline (sem interceptação de rede: com ela o Playwright não dispara o evento "offline")
  await page.unroute('**/*');
  await page.goto(BASE + '/inicio');
  await page.getByRole('heading', { name: /Olá, Duda/ }).waitFor();
  await context.setOffline(true);
  await see('Você está sem conexão');
  await context.setOffline(false);
  await page.getByText('Você está sem conexão').waitFor({ state: 'detached' });
  log(label, 'aviso de sem conexão aparece e some quando a internet volta');

  // Excluir minha conta
  await page.goto(BASE + '/perfil');
  await page.getByRole('button', { name: 'Excluir minha conta…' }).click();
  const del = page.getByRole('dialog', { name: 'Excluir sua conta?' });
  await del.getByText('o seu mundo virtual').waitFor();
  const confirmBtn = del.getByRole('button', { name: 'Excluir definitivamente' });
  if (await confirmBtn.isEnabled()) throw new Error('exclusão sem confirmação digitada');
  await del.getByLabel(/Para confirmar/).fill('EXCLUIR');
  await page.screenshot({ path: `${OUT}/${label}-06-excluir.png` });
  await confirmBtn.click();
  await page.waitForURL(BASE + '/');
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.waitForURL('**/entrar');
  log(label, 'excluir conta: explicação, confirmação digitada, dados e acesso apagados (volta para entrar)');

  console.log(`  [${label}] erros no console: ${JSON.stringify(errors)}`);
  if (errors.length) results.failed++;
  await context.close();
}

async function sweep(browser) {
  // Responsividade e acessibilidade nas telas principais, com dados de um jogador em andamento.
  const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
  const routes = ['/', '/inicio', '/aprender', '/aula/por-que-as-arvores-sao-importantes', '/desafios', '/missao/plante-uma-arvore/desafio',
    '/mundo', '/meu-lugar', '/conquistas', '/perfil', '/perfil/evolucao', '/admin', '/sobre', '/privacidade', '/jogadores'];
  const { page, errors, context } = await newPage(browser, { width: 375, height: 760 });
  await createProfile(page);
  await editDemo(page, `db.player.profile.role = 'admin';`);
  await page.evaluate(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  const overflow = [];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const r of routes) {
      await page.goto(BASE + r);
      await page.waitForLoadState('networkidle');
      const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (o > 0) overflow.push(`${r}@${w} (+${o}px)`);
    }
  }
  if (overflow.length) {
    results.failed++;
    console.log('  ✗ rolagem horizontal:', overflow.join(', '));
  } else log('telas', `${routes.length} telas × ${widths.length} larguras (320–1920) sem rolagem horizontal`);

  const violations = [];
  for (const w of [375, 1280]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const r of routes) {
      await page.goto(BASE + r);
      await page.waitForLoadState('networkidle');
      await page.evaluate(AXE);
      const res = await page.evaluate(async () =>
        (await window.axe.run(document, { resultTypes: ['violations'], preload: false })).violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          target: v.nodes[0]?.target?.join(' '),
        })),
      );
      for (const v of res) violations.push({ route: r, width: w, ...v });
    }
  }
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (process.env.AXE_DEBUG) for (const v of violations) console.log(`     [axe] ${v.route}@${v.width} ${v.id} (${v.impact})`);
  fs.writeFileSync(`${OUT}/axe.json`, JSON.stringify(violations, null, 2));
  if (serious.length) {
    results.failed++;
    console.log('  ✗ acessibilidade (sérias/críticas):');
    for (const v of serious) console.log(`     ${v.route}@${v.width} ${v.id} (${v.impact}) ×${v.nodes} ${v.target}`);
  } else log('telas', `acessibilidade (axe): nenhuma violação séria/crítica em ${routes.length} telas × 2 larguras (${violations.length} menores registradas)`);
  if (errors.length) {
    results.failed++;
    console.log('  ✗ erros no console/CSP:', JSON.stringify(errors.slice(0, 5)));
  } else log('telas', 'nenhum erro de console nem violação de CSP (cabeçalhos de produção)');
  await context.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions);
  await flow(browser, 'mobile', { width: 375, height: 760 });
  await flow(browser, 'desktop', { width: 1280, height: 860 });
  await sweep(browser);
  await browser.close();
  console.log(`\n${results.passed} verificações ok, ${results.failed} falharam`);
  process.exit(results.failed ? 1 : 0);
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
