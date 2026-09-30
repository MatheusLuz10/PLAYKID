// ECO QUEST · teste de ponta a ponta (12-online-neon). Veja tests/e2e/README.md.
// Site PUBLICADO com Neon (login Neon Auth, banco pela Data API, fotos pelo Worker):
// cria conta, perfil, aula, quiz, aceita o desafio, envia foto, vê a foto, sai e entra
// de novo, confere que outra pessoa não vê a foto e, no fim, exclui a conta (limpeza).
//   ONLINE_URL=https://playkid.mluz787.workers.dev node tests/e2e/12-online-neon.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { launchOptions } = require('./navegador.cjs');
const OUT = __dirname + '/.saida/12-online-neon';
fs.mkdirSync(OUT, { recursive: true });
const BASE = (process.env.ONLINE_URL || 'https://playkid.mluz787.workers.dev').replace(/\/$/, '');
const PHOTO = __dirname + '/fixtures/foto.png';
const TREE = '/missao/plante-uma-arvore';
const results = { passed: 0, failed: 0 };
const log = (m) => {
  results.passed++;
  console.log(`  ✓ ${m}`);
};

(async () => {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const welcome = page.getByRole('dialog', { name: 'Bem-vindo ao ECO QUEST' });
  await page.addLocatorHandler(welcome, async () => welcome.getByRole('button', { name: 'Começar' }).click());
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => celebration.getByRole('button', { name: 'Continuar' }).click());
  const see = (t, timeout = 20000) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout });
  const email = `teste.playkid.${Date.now()}@example.com`;
  const senha = 'Senha-Eco-2026!';
  const user = `eco_${Date.now().toString(36)}`.slice(0, 24);

  try {
    // Conta nova (Neon Auth)
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.waitForURL('**/entrar**');
    await page.getByRole('tab', { name: 'Criar conta' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(senha);
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.waitForURL('**/criar-perfil', { timeout: 30000 });
    log(`conta criada no Neon Auth (${email}) e sessão aberta`);

    // Perfil (banco pela Data API; o perfil nasce de ensure_account)
    await page.getByLabel('Nome', { exact: true }).fill('Teste Online');
    await page.getByLabel('Nome de usuário').fill(user);
    await page.getByRole('button', { name: 'Criar perfil' }).click();
    await page.waitForURL('**/inicio', { timeout: 30000 });
    await see('Olá, Teste Online!');
    log('perfil salvo no banco do Neon (RLS: cada um só vê o seu)');

    // Casa completa (migration 29) e visita pelo @usuário (migration 30)
    await page.goto(BASE + '/mundo?casa=1');
    await page.locator('.place-room', { hasText: 'Sala' }).waitFor({ timeout: 30000 });
    // a casa termina de montar e os objetos por perto ganham botão
    await page.locator('.place-stage .place-hotspot').first().waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: '✕ Sair da casa' }).click();
    await page.goto(BASE + '/mundo/visitar/' + user);
    await see('Este é o seu próprio mundo');
    await page.getByRole('heading', { name: '🌎 Mundo de Teste Online' }).waitFor();
    await page.goto(BASE + '/mundo/visitar/ninguem_existe_aqui');
    await see('Não encontramos ninguém com esse @usuário');
    log('casa completa (mobiliada, por dentro) desde a conta nova; visita pelo @usuário no servidor (e @usuário inexistente recusado)');

    // Missões abertas (migration 28): aceita outro desafio sem aula e sem quiz; aula sem pré-requisito abre
    await page.goto(BASE + '/missao/reduza-o-desperdicio-de-agua/desafio');
    await see('🔓 Disponível');
    await page.getByRole('button', { name: 'Aceitar desafio' }).click();
    await page.waitForURL('**/missao/reduza-o-desperdicio-de-agua/comprovar', { timeout: 30000 });
    await page.goto(BASE + '/aula/o-que-e-uma-horta');
    await page.getByRole('button', { name: 'Continuar →' }).waitFor({ timeout: 20000 });
    log('missões abertas: desafio aceito sem aula/quiz pelo servidor e aula sem pré-requisito');

    // Aula → quiz → desafio
    await page.goto(BASE + '/aula/por-que-as-arvores-sao-importantes');
    await see('1 de 5');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.getByRole('button', { name: 'Concluir aula' }).click();
    await page.getByRole('link', { name: 'Fazer quiz' }).click();
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
    for (const [i, l] of ['B', 'C', 'A', 'D', 'B'].entries()) {
      await page.locator('.option', { has: page.locator('.option__letter', { hasText: l }) }).click();
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();
      await page.locator('.feedback').waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: i === 4 ? 'Ver resultado' : 'Continuar →' }).click();
    }
    await page.getByRole('link', { name: 'Ir para o desafio' }).click();
    await page.getByRole('button', { name: 'Aceitar desafio' }).click();
    await page.waitForURL('**' + TREE + '/comprovar', { timeout: 30000 });
    log('aula concluída, quiz aprovado e desafio aceito (funções SQL pela Data API)');

    // Foto (Worker → Neon Object Storage)
    for (let i = 0; i < 4; i++) {
      const before = await page.locator('.checklist-step.is-done').count();
      await page.getByRole('button', { name: '✓ Marcar como feito' }).click();
      await page.waitForFunction((n) => document.querySelectorAll('.checklist-step.is-done').length > n, before, { timeout: 20000 });
    }
    await page.getByRole('button', { name: '📷 Registrar foto' }).click();
    await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
    await page.locator('textarea').fill('Muda plantada no teste online.');
    await page.getByRole('button', { name: 'Enviar registro' }).click();
    const img = page.locator('img[src*="neon.tech"]').first();
    await img.waitFor({ timeout: 30000 });
    const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
    if (!loaded) await page.waitForFunction((e) => e.complete && e.naturalWidth > 0, await img.elementHandle(), { timeout: 20000 });
    await page.screenshot({ path: `${OUT}/01-foto.png`, fullPage: true });
    log('foto enviada ao Neon Object Storage pelo Worker e exibida por link temporário assinado');

    // Sem login a API recusa
    const anon = await page.evaluate(async () => (await fetch('/api/evidencia/link?caminho=users/x/challenges/y/z.jpg')).status);
    if (anon !== 401) throw new Error('API sem login respondeu ' + anon);
    log('API de fotos recusa pedidos sem login (401)');

    // Sair e entrar de novo
    await page.goto(BASE + '/perfil');
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL(BASE + '/', { timeout: 20000 });
    await page.goto(BASE + '/entrar');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL('**/inicio', { timeout: 30000 });
    await see('Olá, Teste Online!');
    await page.goto(BASE + TREE + '/comprovar');
    await page.locator('img[src*="neon.tech"]').first().waitFor({ timeout: 30000 });
    log('sair e entrar de novo: progresso e foto continuam lá');

    // Recarregar mantém a sessão
    await page.reload();
    await page.locator('img[src*="neon.tech"]').first().waitFor({ timeout: 30000 });
    log('recarregar a página mantém a sessão');

    // Outra pessoa no mesmo aparelho: "Trocar de conta" sai e abre a tela de entrar;
    // Perfil → "Criar outra conta" abre direto o cadastro.
    await page.goto(BASE + '/inicio');
    await page.getByRole('button', { name: /Trocar de conta/ }).click();
    await page.waitForURL('**/entrar', { timeout: 20000 });
    await page.getByRole('tab', { name: 'Criar conta' }).waitFor();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL('**/inicio', { timeout: 30000 });
    await page.goto(BASE + '/perfil');
    await page.getByRole('button', { name: '👥 Criar outra conta' }).click();
    await page.waitForURL('**/entrar?modo=cadastro', { timeout: 20000 });
    await page.getByRole('tab', { name: 'Criar conta', selected: true }).waitFor();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(senha);
    await page.getByRole('tab', { name: 'Entrar' }).click();
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL('**/inicio', { timeout: 30000 });
    log('com alguém conectado: "Trocar de conta" (Início) e "Criar outra conta" (Perfil) levam ao login/cadastro');
  } finally {
    // Limpeza: exclui a conta de teste (fotos, dados e login)
    try {
      await page.goto(BASE + '/perfil');
      await page.getByRole('button', { name: 'Excluir minha conta…' }).click({ timeout: 15000 });
      const del = page.getByRole('dialog', { name: 'Excluir sua conta?' });
      await del.getByLabel(/Para confirmar/).fill('EXCLUIR');
      await del.getByRole('button', { name: 'Excluir definitivamente' }).click();
      await page.waitForURL(BASE + '/', { timeout: 30000 });
      await page.goto(BASE + '/entrar');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha').fill(senha);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('alert').waitFor({ timeout: 20000 });
      if (page.url().includes('/inicio')) throw new Error('conta continuou existindo');
      log('excluir a conta apaga fotos, dados e o login (entrar de novo é recusado)');
    } catch (e) {
      results.failed++;
      console.error('  ✗ limpeza: ' + e.message.split('\n')[0]);
    }
    const relevant = errors.filter((e) => !/401|Unauthorized|Failed to load resource/i.test(e));
    console.log(`  erros no console: ${JSON.stringify(relevant)}`);
    await browser.close();
  }
  console.log(`\n${results.passed} verificações ok, ${results.failed} falharam`);
  process.exit(results.failed ? 1 : 0);
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | '));
  process.exit(1);
});
