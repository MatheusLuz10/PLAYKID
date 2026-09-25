// ECO QUEST · teste de ponta a ponta (10-jogadores). Veja tests/e2e/README.md.
// Login independente para cada usuário (modo demonstração, contas deste aparelho):
// criar conta, senha errada recusada, sair, entrar de novo, evolução separada,
// nome de usuário único, senha nunca guardada em texto, pausa após muitas
// tentativas, conta de demonstração sem senha e exclusão de uma só conta.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const C = require('./conteudo.cjs');
const { SENHA, criarConta } = require('./conta.cjs');
const OUT = __dirname + '/.saida/10-jogadores';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const LESSON = 'por-que-as-arvores-sao-importantes';

const results = { passed: 0, failed: 0 };

async function run(browser, label, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // Boas-vindas do primeiro acesso (uma por conta) e celebrações: fecha quando aparecerem.
  const welcome = page.getByRole('dialog', { name: 'Bem-vindo ao ECO QUEST' });
  await page.addLocatorHandler(welcome, async () => welcome.getByRole('button', { name: 'Começar' }).click());
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => celebration.getByRole('button', { name: 'Continuar' }).click());

  const log = (m) => {
    results.passed++;
    console.log(`  [${label}] ✓ ${m}`);
  };
  const see = (t) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout: 8000 });
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: true });
  const fillProfile = async (name, username) => {
    await page.getByLabel('Nome', { exact: true }).fill(name);
    await page.getByLabel('Nome de usuário').fill(username);
    await page.getByRole('button', { name: 'Criar perfil' }).click();
  };
  const lessonsDone = async (n) => {
    await page.goto(BASE + '/aprender');
    await see(`${n} de ${C.lessonsTotal} conteúdos concluídos`);
  };
  const doLesson = async () => {
    await page.goto(BASE + '/aula/' + LESSON);
    await see('1 de 5');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.getByRole('button', { name: 'Concluir aula' }).click();
    await see('+20 XP');
  };
  const signOut = async () => {
    await page.goto(BASE + '/perfil');
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL(BASE + '/');
  };
  const signIn = async (user, pass) => {
    await page.goto(BASE + '/entrar');
    await page.getByLabel('Nome de usuário').fill(user);
    await page.getByLabel('Senha', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  };
  const noOverflow = async (where) => {
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (extra > 0) throw new Error(`rolagem horizontal em ${where}: +${extra}px`);
  };

  // Sem ninguém conectado, o jogo pede login
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/inicio');
  await page.waitForURL('**/entrar');
  await page.getByRole('tab', { name: 'Entrar' }).waitFor();
  await noOverflow('entrar');
  await shot('01-entrar');
  log('sem login, as páginas do jogo levam para "Entrar"');

  // Conta da Ana
  await page.goto(BASE);
  await criarConta(page, 'ana_eco');
  if ((await page.getByLabel('Nome de usuário').inputValue()) !== 'ana_eco') throw new Error('perfil sem o nome de usuário do login');
  await fillProfile('Ana', 'ana_eco');
  await page.waitForURL('**/inicio');
  await see('Olá, Ana!');
  await doLesson();
  await lessonsDone(1);
  const stored = await page.evaluate(() => localStorage.getItem('eco-quest:demo:jogadores'));
  if (stored.includes(SENHA) || !/"hash"/.test(stored)) throw new Error('senha guardada de forma insegura');
  log('Ana cria conta (usuário + senha) e perfil; a senha não fica guardada em texto (só o resumo PBKDF2)');

  // Sair
  await signOut();
  await page.goto(BASE + '/aprender');
  await page.waitForURL('**/entrar');
  log('"Sair" encerra a sessão: o jogo volta a pedir login');

  // Nome de usuário repetido e senhas diferentes
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome de usuário').fill('ana_eco');
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('alert').getByText('já está em uso').waitFor();
  await page.getByLabel('Nome de usuário').fill('beto_eco');
  await page.getByLabel('Confirmar senha').fill('outra-senha');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('alert').getByText('não são iguais').waitFor();
  log('criar conta recusa nome de usuário repetido e senhas diferentes');

  // Conta do Beto: evolução separada
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.waitForURL('**/criar-perfil');
  await fillProfile('Beto', 'beto_eco');
  await page.waitForURL('**/inicio');
  await see('Olá, Beto!');
  await lessonsDone(0);
  log('Beto cria a própria conta e começa do zero (0 aulas)');
  await signOut();

  // Senha errada, depois certa
  await signIn('ana_eco', 'senha-errada');
  await page.getByRole('alert').getByText('Nome de usuário ou senha incorretos.').waitFor();
  if (!page.url().includes('/entrar')) throw new Error('entrou com senha errada');
  await signIn('ana_eco', SENHA);
  await page.waitForURL('**/inicio');
  await see('Olá, Ana!');
  await lessonsDone(1);
  log('senha errada é recusada; com a senha certa a Ana volta ao seu progresso (1 aula)');

  // Recarregar mantém a sessão
  await page.reload();
  await see(`1 de ${C.lessonsTotal} conteúdos concluídos`);
  log('recarregar a página mantém a Ana conectada');

  // Lista de contas: entrar exige a senha da conta escolhida
  await page.goto(BASE + '/jogadores');
  await page.locator('.players-list__row', { hasText: 'Ana' }).getByText('Conectada agora').waitFor();
  await page.getByRole('button', { name: 'Entrar como Beto' }).click();
  await page.getByLabel('Senha de Beto').fill('nao-e-essa');
  await page.locator('.players-list__login').getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('alert').getByText('Senha incorreta.').waitFor();
  await noOverflow('jogadores');
  await shot('02-contas');
  await page.getByLabel('Senha de Beto').fill(SENHA);
  await page.locator('.players-list__login').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/inicio');
  await see('Olá, Beto!');
  log('"Contas deste aparelho": trocar para o Beto exige a senha dele');

  // Muitas tentativas erradas → pausa
  await signOut();
  for (let i = 0; i < 5; i++) {
    await signIn('ana_eco', 'errada-' + i);
    await page.getByRole('alert').waitFor();
  }
  await signIn('ana_eco', SENHA);
  await page.getByRole('alert').getByText('Muitas tentativas').waitFor();
  log('depois de 5 senhas erradas, a conta fica em pausa por 30 segundos');

  // Conta de demonstração (sem senha, tudo desbloqueado)
  await page.goto(BASE + '/entrar');
  await page.getByRole('button', { name: /Entrar na conta de demonstração/ }).click();
  await page.waitForURL('**/inicio');
  await lessonsDone(C.lessonsTotal);
  log('conta de demonstração entra sem senha, com tudo desbloqueado');
  await signOut();

  // Excluir a conta do Beto: só ele some
  await signIn('beto_eco', SENHA);
  await page.waitForURL('**/inicio');
  await page.goto(BASE + '/perfil');
  await page.getByRole('button', { name: 'Excluir minha conta…' }).click();
  const del = page.getByRole('dialog', { name: 'Excluir sua conta?' });
  await del.getByLabel(/Para confirmar/).fill('EXCLUIR');
  await del.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await page.waitForURL(BASE + '/');
  await signIn('beto_eco', SENHA);
  await page.getByRole('alert').getByText('Nome de usuário ou senha incorretos.').waitFor();
  await page.goto(BASE + '/jogadores');
  if (await page.locator('.players-list__row', { hasText: 'Beto' }).count()) throw new Error('Beto continua na lista');
  await page.locator('.players-list__row', { hasText: 'Ana' }).waitFor();
  log('excluir a conta do Beto apaga o acesso e os dados dele; a Ana continua');

  console.log(`  [${label}] erros no console: ${JSON.stringify(errors)}`);
  if (errors.length) results.failed++;
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const [label, viewport] of [
    ['mobile', { width: 375, height: 760 }],
    ['desktop', { width: 1280, height: 860 }],
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
