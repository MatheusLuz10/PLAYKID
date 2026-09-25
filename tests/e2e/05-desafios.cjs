// ECO QUEST · teste de ponta a ponta (05-desafios). Veja tests/e2e/README.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const C = require('./conteudo.cjs');
const OUT = __dirname + '/.saida/05-desafios';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(__dirname + '/.saida', { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const PHOTO = __dirname + '/fixtures/foto.png';
const BAD = __dirname + '/.saida/arquivo-invalido.gif';
const TREE = '/missao/plante-uma-arvore';
const ACAO = '/missao/participe-de-uma-acao-ambiental';
fs.writeFileSync(BAD, 'GIF89a'); // arquivo de tipo não aceito

// Simula a passagem do tempo nos dados locais da demonstração (somente para teste).
const shiftDemo = (page, fn) =>
  page.evaluate((src) => {
    const k = (() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })();
    const db = JSON.parse(localStorage.getItem(k));
    new Function('db', src)(db);
    localStorage.setItem(k, JSON.stringify(db));
  }, fn);

async function run(label, viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  // Etapa 8: as boas-vindas do primeiro acesso são testadas em e2e8; aqui já contam como vistas.
  await page.addInitScript(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  const errors = [];
  // Etapa 6: janelas de nível/conquista são fechadas automaticamente neste roteiro.
  await page.addLocatorHandler(page.getByRole('dialog'), async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Continuar' }).click();
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: true });
  const see = (t, timeout = 6000) => page.getByText(t, { exact: false }).locator('visible=true').first().waitFor({ timeout });
  const log = (m) => console.log(`  [${label}] ✓ ${m}`);
  const overflow = [];
  const checkOverflow = async (w) => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) overflow.push(w);
  };
  const doQuiz = async (letters) => {
    for (let i = 0; i < letters.length; i++) {
      await page.locator('.option', { has: page.locator('.option__letter', { hasText: letters[i] }) }).click();
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();
      await page.locator('.feedback').waitFor();
      await page.getByRole('button', { name: i === letters.length - 1 ? 'Ver resultado' : 'Continuar →' }).click();
    }
  };
  const doLesson = async (slug, parts) => {
    await page.goto(BASE + '/aula/' + slug);
    await see(`1 de ${parts}`);
    for (let i = 0; i < parts - 1; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.getByRole('button', { name: 'Concluir aula' }).click();
    await see('Seu conhecimento será testado');
    await page.getByRole('link', { name: 'Fazer quiz' }).click();
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
  };
  const markStep = async () => {
    const before = await page.locator('.checklist-step.is-done').count();
    await page.getByRole('button', { name: '✓ Marcar como feito' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.checklist-step.is-done').length > n, before);
  };

  // Perfil
  await page.goto(BASE);
  await criarConta(page, 'duda_eco');
  await page.getByLabel('Nome', { exact: true }).fill('Duda');
  await page.getByLabel('Nome de usuário').fill('duda_eco');
  await page.getByRole('button', { name: 'Criar perfil' }).click();
  await page.waitForURL('**/inicio');

  // Página de desafios: missões abertas, tudo disponível desde o início
  await page.goto(BASE + '/desafios');
  await see('🔓 Disponíveis');
  await page.locator('.challenge-card').nth(7).waitFor();
  if ((await page.locator('.challenge-card').count()) !== C.challengesTotal) throw new Error(`expected ${C.challengesTotal} challenges`);
  if (await page.getByText('🔒 Bloqueados').count()) throw new Error('seção Bloqueados com missões abertas');
  await page.getByRole('group', { name: 'Filtrar por categoria' }).getByRole('button', { name: /Água/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('.challenge-card').length === 1);
  log('Desafios: 8 cadastrados, todos disponíveis; filtro por categoria');
  await page.goto(BASE + '/desafios');
  await checkOverflow('desafios');
  await shot('01-desafios-abertos');

  // Detalhe (Testes 1/2): aberto antes da aula; executar só depois de aceitar
  await page.goto(BASE + TREE + '/desafio');
  await see('🔓 Disponível');
  for (const t of ['Por que isso importa?', 'O que você vai precisar', 'Como realizar', 'Como comprovar', 'Acompanhamento', 'Recompensa', 'Dia 180']) await see(t);
  await page.getByRole('button', { name: 'Aceitar desafio' }).waitFor();
  await page.goto(BASE + TREE + '/comprovar');
  await see('Aceite o desafio primeiro');
  log('Testes 1/2 · detalhe completo e aberto; execução só depois de aceitar');
  await checkOverflow('detalhe');
  await shot('02-detalhe-aberto');

  // Aula + quiz (Teste 3)
  await doLesson('por-que-as-arvores-sao-importantes', 5);
  await doQuiz(['B', 'C', 'A', 'D', 'B']);
  await see('Desafio desbloqueado');
  await page.getByRole('link', { name: 'Ir para o desafio' }).click();
  await page.waitForURL('**' + TREE + '/desafio');
  await see('🔓 Disponível');
  log('Teste 3 · aprovado no quiz → desafio disponível');

  // Aceitar (Testes 4/6/12)
  await page.getByRole('button', { name: 'Aceitar desafio' }).click();
  await page.waitForURL('**' + TREE + '/comprovar');
  await see('0%');
  await see('Faltam');
  await page.locator('.checklist-step').nth(5).waitFor();
  if ((await page.locator('.checklist-step').count()) !== 6) throw new Error('expected 6 checklist steps');
  log('Testes 4/6/12 · aceito: checklist com 6 etapas, prazo exibido');

  // Checklist (Teste 7)
  await markStep();
  await see('11%');
  await markStep();
  await markStep();
  await markStep();
  log('Teste 7 · progresso calculado (11% após a 1ª etapa)');

  // Foto: inválida, remover, substituir, enviar (Testes 8/9)
  await page.getByRole('button', { name: '📷 Registrar foto' }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles(BAD);
  await see('Escolha um arquivo de imagem');
  const sendBtn = page.getByRole('button', { name: 'Enviar registro' });
  if (await sendBtn.isEnabled()) throw new Error('should not send invalid file');
  log('Teste 9 · arquivo inválido recusado antes do envio');
  await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
  await see('Foto selecionada:');
  await page.getByRole('button', { name: '🗑️ Remover foto' }).click();
  await see('Adicione uma foto');
  await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
  await page.locator('textarea').fill('Muda de ipê-amarelo');
  await checkOverflow('foto');
  await shot('03-foto');
  await sendBtn.click();
  await page.locator('.checklist-step.is-done').nth(4).waitFor();
  log('Teste 8 · prévia, remover, substituir e enviar a foto');

  // Observação obrigatória
  await page.getByRole('button', { name: '📝 Escrever observação' }).click();
  const sendText = page.getByRole('button', { name: 'Enviar registro' });
  if (await sendText.isEnabled()) throw new Error('text required');
  await page.locator('textarea').fill('Plantei um ipê-amarelo no quintal, no dia de hoje.');
  await sendText.click();
  await see('🌱 Aguardando acompanhamento');
  await see('Ver acompanhamentos');
  await shot('04-checklist-completo');
  log('Checklist concluído → aguardando acompanhamento');

  // Acompanhamento bloqueado até a data (Teste 14)
  await page.getByRole('link', { name: '📅 Ver acompanhamentos' }).click();
  await page.waitForURL('**' + TREE + '/acompanhar');
  await see('🔒 Disponível a partir de');
  if (await page.getByRole('button', { name: /Registrar acompanhamento/ }).count()) throw new Error('follow-up should be locked');
  if (await page.getByRole('button', { name: /Concluir desafio/ }).count()) throw new Error('cannot complete yet');
  await see('A conclusão definitiva');
  log('Testes 14/16 · acompanhamento bloqueado até a data; sem conclusão antecipada');
  await checkOverflow('acompanhar');
  await shot('05-timeline-bloqueada');

  // Meus desafios (Início)
  await page.goto(BASE + '/inicio');
  await see('Meus desafios');
  await see('Próxima ação:');
  await see('Primeiro acompanhamento a partir de');
  log('Início · "Meus desafios" com progresso, próxima ação e data');

  // O tempo passa (somente no teste): acompanhamentos abertos
  await shiftDemo(page, `for (const uc of Object.values(db.player.challenges)) for (const f of uc.followups) f.scheduledFor = new Date(Date.now() - 86400000).toISOString();`);
  await page.reload();
  await see('Seu acompanhamento de “Plante uma árvore” está disponível.');
  await shot('06-lembrete');
  await page.getByRole('link', { name: 'Registrar' }).first().click();
  await page.waitForURL('**' + TREE + '/acompanhar');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '📷 Registrar acompanhamento' }).first().click();
    await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
    await page.getByRole('button', { name: 'Registrar acompanhamento' }).last().click();
    await page.waitForFunction((n) => document.querySelectorAll('.timeline__item.is-done').length >= n + 2, i);
  }
  log('Lembrete 🔔 + Teste 15 · 3 acompanhamentos registrados com foto');

  // Conclusão e recompensa (Testes 17/21/22/24)
  await page.getByRole('button', { name: '🏆 Concluir desafio' }).click();
  await page.waitForURL('**' + TREE + '/recompensa');
  await see('+100 XP');
  await see('“Primeira Árvore”');
  await see('Nova árvore desbloqueada');
  await page.reload();
  await see('Desafio concluído');
  await page.getByRole('link', { name: /Ver meu mundo/ }).first().click();
  await see('Seu mundo cresceu!');
  await page.goto(BASE + '/inicio');
  await see('/ 450 XP'); // 375 XP: nível 3
  log('Conclusão: +100 XP, conquista, árvore no mundo; atualizar a página não duplica (375 XP)');
  await page.goto(BASE + '/perfil');
  await see('Desafios concluídos');
  await see('Plante uma árvore');
  log('Teste 24 · desafio concluído aparece no perfil');
  await page.goto(BASE + '/desafios');
  await see('🏆 Concluídos');

  // Outro desafio: prazo vencido → recomeçar → concluir sem acompanhamento
  await doLesson('o-que-e-uma-acao-ambiental-comunitaria', 3);
  await doQuiz(['B', 'D', 'B']);
  await page.getByRole('link', { name: 'Ir para o desafio' }).click();
  await page.getByRole('button', { name: 'Aceitar desafio' }).click();
  await page.waitForURL('**' + ACAO + '/comprovar');
  await shiftDemo(page, `for (const uc of Object.values(db.player.challenges)) if (uc.status === 'accepted') uc.deadlineAt = new Date(Date.now() - 3600000).toISOString();`);
  await page.reload();
  await see('⌛ O prazo terminou');
  await see('⌛ Prazo encerrado');
  await shot('07-expirado');
  await page.getByRole('button', { name: 'Recomeçar desafio' }).click();
  await see('Faltam');
  log('Teste 13 · prazo vencido: opção de recomeçar (novo prazo)');
  await markStep();
  await page.getByRole('button', { name: '📷 Registrar foto' }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO);
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await page.getByRole('button', { name: '📝 Escrever observação' }).click();
  await page.locator('textarea').fill('Mutirão de limpeza na praça do bairro com a escola.');
  await page.getByRole('button', { name: 'Enviar registro' }).click();
  await see('Checklist concluído!');
  await page.getByRole('button', { name: '🏆 Concluir desafio' }).click();
  await page.waitForURL('**' + ACAO + '/recompensa');
  await see('+100 XP');
  log('Desafio sem acompanhamento concluído (+100 XP)');

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
