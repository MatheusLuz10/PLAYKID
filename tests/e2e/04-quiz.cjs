// ECO QUEST · teste de ponta a ponta (04-quiz). Veja tests/e2e/README.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const OUT = __dirname + '/.saida/04-quiz';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(__dirname + '/.saida', { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const PHOTO = __dirname + '/fixtures/foto.png';
const TREE = '/aula/por-que-as-arvores-sao-importantes';
const MQ = '/missao/plante-uma-arvore';
const CORRECT = ['B', 'C', 'A', 'D', 'B'];
const WRONG = ['A', 'A', 'B', 'A', 'A'];

async function run(label, viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  // Celebrações da Etapa 6 (nível/conquista) são fechadas quando aparecem.
  const celebration = page.getByRole('dialog', { name: /subiu de nível|Conquista/ });
  await page.addLocatorHandler(celebration, async () => {
    await celebration.getByRole('button', { name: 'Continuar' }).click();
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: true });
  const see = (t, timeout = 6000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });
  const log = (m) => console.log(`  [${label}] ✓ ${m}`);
  const overflow = [];
  const checkOverflow = async (w) => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) overflow.push(w);
  };
  const pick = async (letter) => {
    await page.locator('.option', { has: page.locator('.option__letter', { hasText: letter }) }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.locator('.feedback').waitFor();
  };
  const advance = async (last) => page.getByRole('button', { name: last ? 'Ver resultado' : 'Continuar →' }).click();
  const answerAll = async (letters) => {
    for (let i = 0; i < letters.length; i++) {
      await pick(letters[i]);
      await advance(i === letters.length - 1);
    }
  };

  // Perfil
  await page.goto(BASE);
  await criarConta(page, 'caio_eco');
  await page.getByLabel('Nome', { exact: true }).fill('Caio');
  await page.getByLabel('Nome de usuário').fill('caio_eco');
  await page.getByRole('button', { name: 'Criar perfil' }).click();
  await page.waitForURL('**/inicio');

  // TESTE NEGATIVO · URL direta
  await page.goto(BASE + MQ + '/desafio');
  await see('🔓 Disponível'); // missões abertas: o desafio não depende do quiz
  await page.goto(BASE + MQ + '/comprovar');
  await see('Aceite o desafio primeiro');
  await page.goto(BASE + MQ + '/quiz');
  await see('Quiz bloqueado');
  await see('Conclua o conteúdo para testar seus conhecimentos.');
  await page.goto(BASE + TREE + '/quiz');
  await see('Quiz bloqueado');
  log('Teste 1 / negativo · quiz bloqueado pela URL até ver a aula; desafio aberto, execução só após aceitar');
  await shot('01-quiz-bloqueado');

  // Aula → quiz liberado
  await page.goto(BASE + TREE);
  await see('1 de 5');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Concluir aula' }).click();
  await see('Seu conhecimento será testado');
  await page.getByRole('link', { name: 'Fazer quiz' }).click();
  await page.waitForURL('**' + MQ + '/quiz');
  await see('Teste seu conhecimento');
  await see('Aprovação');
  await see('70%');
  await see('+30 XP');
  log('Teste 2 · aula concluída → quiz disponível (5 perguntas, 70%, +30 XP, tentativa 1)');
  await checkOverflow('quiz-intro');
  await shot('02-quiz-intro');

  // Começar, errar, acertar
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  await see('Pergunta 1 de 5');
  await pick(WRONG[0]);
  await see('❌ Resposta incorreta');
  await see('Na verdade, árvores atraem e abrigam insetos');
  await see('✓ Resposta correta');
  const locked = await page.locator('fieldset.question input[type=radio]').first().isDisabled();
  if (!locked) throw new Error('answer should be locked');
  log('Testes 3/6 · resposta errada: feedback da alternativa + explicação; resposta travada');
  await checkOverflow('quiz-feedback');
  await shot('03-feedback-errado');
  await advance(false);
  await see('Pergunta 2 de 5');
  await pick(CORRECT[1]);
  await see('✅ Resposta correta');
  log('Teste 7 · resposta correta com feedback');

  // Abandonar e voltar
  await page.goto(BASE + '/inicio');
  await page.goto(BASE + MQ + '/quiz');
  await see('respondeu 2 de 5 perguntas');
  await shot('04-retomar');
  await page.getByRole('button', { name: 'Continuar tentativa' }).click();
  await see('Pergunta 3 de 5');
  log('Testes 4/5 · abandonou e retornou na pergunta 3');

  // Reprovar: 3/5 = 60%
  await pick(WRONG[2]);
  await advance(false);
  await pick(CORRECT[3]);
  await advance(false);
  await pick(CORRECT[4]);
  await advance(true);
  await see('Ainda não');
  await see('60%');
  await see('NÃO APROVADO');
  await see('Perguntas para revisar');
  await see('Revisar conteúdo');
  await page.locator('.review-list__item').nth(1).waitFor();
  log('Teste 9 · reprovado (60%) com perguntas erradas, explicações e revisão');
  await shot('05-reprovado');
  await page.goto(BASE + MQ + '/desafio');
  await see('🔓 Disponível');
  log('Reprovar no quiz não bloqueia o desafio (missões abertas)');

  // Tentar novamente → aprovado 80%
  await page.goto(BASE + MQ + '/quiz');
  await see('Tentativa');
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  await answerAll(['A', 'C', 'A', 'D', 'B']);
  await see('Quiz concluído');
  await see('80%');
  await see('+30 XP');
  await see('✅ APROVADO');
  await see('O que você aprendeu');
  await see('Biodiversidade e habitat');
  await see('Desafio desbloqueado');
  await page.locator('.attempt-list__item').nth(1).waitFor();
  const historyText = await page.locator('.attempt-list').innerText();
  if (!/Tentativa 2[\s\S]*80%[\s\S]*Tentativa 1[\s\S]*60%/.test(historyText)) throw new Error('history: ' + historyText);
  log('Testes 8/10/11/13/14 · aprovado 80%, +30 XP, conquista, desafio desbloqueado, histórico');
  await page.waitForTimeout(800);
  await shot('06-aprovado');

  // Refazer → 100%, sem XP duplicado
  await page.goto(BASE + '/conquistas');
  await page.locator('.achievement.is-unlocked', { hasText: 'Primeiro Conhecimento' }).waitFor();
  // 20 (aula) + 10 (conquista) + 30 (quiz) + 10 (conquista) = 70 XP
  const xpTotal = () => page.locator('.evolution-card .xp-bump').innerText();
  await page.goto(BASE + '/inicio');
  await page.locator('.evolution-card .xp-bump').waitFor();
  if ((await xpTotal()) !== '70') throw new Error('xp ' + (await xpTotal()));
  await page.goto(BASE + MQ + '/quiz');
  await see('Já recebido');
  await page.getByRole('button', { name: 'Refazer quiz' }).click();
  await answerAll(CORRECT);
  await see('100%');
  await see('XP já recebido na primeira aprovação');
  await page.goto(BASE + '/inicio');
  await page.locator('.evolution-card .xp-bump').waitFor();
  if ((await xpTotal()) !== '70') throw new Error('xp duplicado ' + (await xpTotal()));
  log('Teste 12 · refazer (100%) não duplica XP (total 70)');

  // Desafio: câmera ou galeria (o fluxo completo do desafio é coberto por e2e5–e2e7)
  await page.goto(BASE + MQ + '/desafio');
  await page.getByRole('button', { name: 'Aceitar desafio' }).click();
  await page.waitForURL('**/comprovar');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '✓ Marcar como feito' }).click();
  await page.getByRole('button', { name: '📷 Registrar foto' }).click();
  const capture = await page.locator('input[type=file][capture="environment"]').count();
  if (capture !== 1) throw new Error('camera input missing');
  const minDate = await page.locator('input[type=date]').getAttribute('min');
  if (!minDate) throw new Error('min date missing');
  log('Foto: câmera (capture) e galeria; data mínima = aceite');

  // Outra aula, quiz sem desafio
  await page.goto(BASE + '/aula/como-uma-planta-cresce');
  await see('1 de 3');
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Concluir aula' }).click();
  await page.getByRole('link', { name: 'Fazer quiz' }).click();
  await page.waitForURL((u) => u.pathname.endsWith('/quiz'));
  await see('60%');
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  await answerAll(['B', 'C', 'A']);
  await see('+30 XP');
  await see('Desafio desbloqueado');
  await see('Cultive uma flor');
  log('Quiz de outra aula (3 perguntas, 60%) → libera o desafio "Cultive uma flor"');

  // Meu desempenho
  await page.goto(BASE + '/perfil');
  await page.getByRole('link', { name: /Meu desempenho/ }).click();
  await page.waitForURL('**/perfil/desempenho');
  await page.locator('.perf-list__item').nth(1).waitFor();
  const tree = page.locator('.perf-list__item', { hasText: 'Árvores' });
  await tree.getByText('APROVADO', { exact: true }).waitFor();
  const treeText = await tree.innerText();
  if (!/100%[\s\S]*100%[\s\S]*3/.test(treeText)) throw new Error('perf: ' + treeText);
  await page.locator('.knowledge-list__item.is-mastered', { hasText: 'Árvores' }).waitFor();
  await page.locator('.knowledge-list__item.is-not_evaluated', { hasText: 'Reciclagem' }).waitFor();
  log('Meu desempenho (melhor 100%, última 100%, 3 tentativas) + Conhecimentos (dominado / não avaliado)');
  await checkOverflow('desempenho');
  await shot('09-desempenho');

  console.log(`  [${label}] overflow: ${overflow.length ? overflow.join(',') : 'nenhum'} · erros: ${JSON.stringify(errors)}`);
  await browser.close();
}

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  await run('mobile', { width: 375, height: 760 });
  await run('desktop', { width: 1280, height: 860 });
  console.log('OK');
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
