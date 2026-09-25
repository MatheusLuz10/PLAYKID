// ECO QUEST · teste de ponta a ponta (03-aprendizagem). Veja tests/e2e/README.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { criarConta } = require('./conta.cjs');
const C = require('./conteudo.cjs');
const OUT = __dirname + '/.saida/03-aprendizagem';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(__dirname + '/.saida', { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4318';
const PHOTO = __dirname + '/fixtures/foto.png';
const TREE = '/aula/por-que-as-arvores-sao-importantes';

async function run(label, viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  // boas-vindas do primeiro acesso da conta nova: fecha quando aparecer
  const welcome = page.getByRole('dialog', { name: 'Bem-vindo ao ECO QUEST' });
  await page.addLocatorHandler(welcome, async () => welcome.getByRole('button', { name: 'Começar' }).click());
  await page.addInitScript(() => {
    localStorage.setItem('eco-quest:onboarding-visto:demo-user', '1');
    localStorage.setItem('eco-quest:teste:sem-conclusao-automatica', '1');
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: true });
  const see = (t) => page.getByText(t, { exact: false }).first().waitFor({ timeout: 5000 });
  const log = (m) => console.log(`  [${label}] ✓ ${m}`);
  const overflowChecks = [];
  const checkOverflow = async (where) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (o) overflowChecks.push(where);
  };

  // Perfil
  await page.goto(BASE);
  await criarConta(page, 'bia_eco');
  await page.getByLabel('Nome', { exact: true }).fill('Bia');
  await page.getByLabel('Nome de usuário').fill('bia_eco');
  await page.getByRole('button', { name: 'Criar perfil' }).click();
  await page.waitForURL('**/inicio');

  // ÁREA APRENDER
  await page.getByRole('link', { name: 'Aprender' }).first().click();
  await page.waitForURL('**/aprender');
  await page.locator('.category-card').nth(5).waitFor();
  if ((await page.locator('.category-card').count()) !== 6) throw new Error('expected 6 categories');
  await see(`0 de ${C.lessonsIn('natureza')} conteúdos concluídos`);
  await see(`0 de ${C.lessonsTotal} conteúdos concluídos`);
  log('Aprender: 6 categorias com contagem e progresso');
  await checkOverflow('aprender');
  await shot('01-aprender');

  // CATEGORIA
  await page.locator('.category-card', { hasText: 'Natureza' }).click();
  await page.waitForURL('**/aprender/natureza');
  await page.locator('.lesson-tile').nth(2).waitFor();
  if ((await page.locator('.lesson-tile').count()) !== C.lessonsIn('natureza')) throw new Error(`expected ${C.lessonsIn('natureza')} lessons`);
  await see('🔒 Conclua “Como uma planta cresce?” para liberar.');
  await see('🔒 1 bloqueado');
  log('Categoria: 3 conteúdos, 1 bloqueado por pré-requisito');
  await checkOverflow('categoria');
  await shot('02-categoria');

  // BIBLIOTECA: filtros e busca
  await page.goto(BASE + '/aprender/biblioteca');
  await see(`${C.lessonsTotal} conteúdos`);
  await page.getByRole('group', { name: 'Filtrar por categoria' }).getByRole('button', { name: /Água/ }).click();
  await see(`${C.lessonsIn('agua')} conteúdos`);
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
  await page.getByRole('group', { name: 'Filtrar por nível' }).getByRole('button', { name: 'Intermediário' }).click();
  await see('2 conteúdos');
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
  await page.getByLabel('Pesquisar conteúdos').fill('arvore');
  await page.waitForFunction(() => document.querySelectorAll('.lesson-tile').length > 0 && document.querySelectorAll('.lesson-tile').length < 12);
  await see('Por que as árvores são importantes?');
  const searchCount = await page.locator('.lesson-tile').count();
  if (!page.url().includes('q=arvore')) throw new Error('query not in URL');
  log(`Busca "arvore" (sem acento): ${searchCount} resultado(s), URL atualizada`);
  await page.getByLabel('Pesquisar conteúdos').fill('xyzxyz');
  await see('Nenhum conteúdo encontrado');
  log('Busca sem resultado mostra estado vazio');
  await checkOverflow('biblioteca');
  await page.getByLabel('Pesquisar conteúdos').fill('');
  await shot('03-biblioteca');

  // FAVORITOS
  await page.getByRole('button', { name: 'Favoritar “Por que as árvores são importantes?”' }).first().click();
  await page.getByRole('button', { name: /Remover “Por que as árvores são importantes\?” dos favoritos/ }).first().waitFor();
  await page.getByRole('button', { name: '★ Favoritos' }).click();
  await see('1 conteúdo');
  log('Favoritar + filtro de favoritos');

  // TESTE 1 · abrir a aula
  await page.goto(BASE + TREE);
  await see('Muito mais do que paisagem');
  await see('1 de 5');
  await see('20% concluído');
  await page.locator('.lesson-figure__img').first().waitFor();
  const alt = await page.locator('.lesson-figure__img').first().getAttribute('alt');
  if (!alt || alt.length < 20) throw new Error('image without alt');
  log('Teste 1 · aula aberta (parte 1 de 5, imagem com texto alternativo)');
  await shot('04-aula-parte1');

  // TESTE 2 · progresso salvo
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await see('Ecossistemas');
  const focused = await page.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.textContent);
  if (!focused.startsWith('H2:Ecossistemas')) throw new Error('focus not moved to heading: ' + focused);
  log('Acessibilidade · foco vai para o título da nova parte');
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await see('3 de 5');
  await see('60% concluído');
  await page.getByRole('button', { name: 'Mostrar resposta' }).click();
  await see('Três: um pássaro no ninho');
  log('Teste 2 · parte 3 de 5 (60%) + bloco "Observe"');
  await checkOverflow('aula');
  await shot('05-aula-parte3');

  // TESTES 3 e 4 · fechar e voltar
  await page.goto(BASE + '/inicio');
  await page.reload();
  await page.goto(BASE + '/aprender');
  await see('Continue de onde parou');
  await see('Parte 3 de 5 · 60%');
  await page.goto(BASE + TREE);
  await see('Você parou aqui. Quer continuar?');
  await shot('06-retomar');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await see('3 de 5');
  await see('Vida');
  log('Testes 3/4 · após fechar, "Você parou aqui" retoma na parte 3');

  // Parte 4 e 5 (mini interação)
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await see('Água e solo');
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await see('Antes de plantar');
  await page.getByRole('button', { name: /Embaixo da fiação/ }).click();
  await see('Vamos pensar juntos:');
  await page.getByRole('button', { name: /espaço aberto e ensolarado/ }).click();
  await see('✅ Escolha adequada');
  log('Mini interação "Escolha o local" com explicação');
  await shot('07-escolha');

  // TESTES 5–9 · concluir
  await page.getByRole('button', { name: 'Concluir aula' }).click();
  await see('Você aprendeu');
  await see('Árvores fazem parte de ecossistemas.');
  await see('+20 XP de conhecimento');
  await see('✅ Conteúdo concluído');
  await see('Seu conhecimento será testado');
  log('Testes 5/6 · resumo "Você aprendeu" + 20 XP');
  await page.locator('section[aria-labelledby="related-title"] .lesson-tile').nth(3).waitFor();
  const related = await page.locator('section[aria-labelledby="related-title"] .lesson-tile').count();
  if (related !== 4) throw new Error('related: ' + related);
  log('Teste 9 · 4 conteúdos relacionados');
  await page.waitForTimeout(800);
  await shot('08-resumo');

  // TESTE 7 · aparece como concluído
  await page.goto(BASE + '/aprender/natureza');
  await page.locator('.lesson-tile', { hasText: 'Por que as árvores' }).getByText('✓ Concluído').waitFor();
  await page.locator('.lesson-tile', { hasText: 'Por que as árvores' }).getByRole('link', { name: /Revisar/ }).waitFor();
  await see(`1 de ${C.lessonsIn('natureza')} conteúdos concluídos`);
  log('Teste 7 · card mostra "✓ Concluído" e botão "Revisar"');

  // TESTE 8 · quiz disponível → quiz da missão
  await page.goto(BASE + TREE);
  // aula concluída: revisão começa pela parte 1 (sem "você parou aqui")
  await see('1 de 5');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Ver resumo' }).click();
  await see('Você já tinha concluído esta aula');
  await page.getByRole('link', { name: 'Fazer quiz' }).click();
  await page.waitForURL('**/missao/plante-uma-arvore/quiz');
  await page.getByRole('button', { name: 'Começar', exact: true }).waitFor();
  log('Teste 8 · "Fazer quiz" leva ao quiz (desafio ainda bloqueado)');
  await page.goto(BASE + '/missao/plante-uma-arvore/desafio');
  await see('Desafio bloqueado');
  log('Desafio continua exigindo quiz aprovado (tela mostra o requisito)');

  // (O ciclo quiz → desafio → evidência → recompensa → mundo é coberto por e2e5, e2e6 e e2e7,
  //  com o fluxo atual de checklist, acompanhamentos e conclusão definitiva.)

  // Outra aula: quiz em preparação + desbloqueio por pré-requisito
  await page.goto(BASE + '/aula/como-uma-planta-cresce');
  await see('1 de 3');
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Concluir aula' }).click();
  await see('+20 XP de conhecimento');
  await page.getByRole('link', { name: 'Fazer quiz' }).click();
  await page.waitForURL((u) => u.pathname.endsWith('/quiz')); // a aula prepara o desafio da flor: quiz da missão
  await page.getByRole('button', { name: 'Começar', exact: true }).waitFor();
  log('Aula concluída → quiz da aula disponível (todas as aulas têm quiz desde a Etapa 4)');
  await shot('09-quiz-preparacao');
  await page.goto(BASE + '/aula/o-que-e-uma-horta');
  await see('1 de 3');
  log('Pré-requisito concluído libera "O que é uma horta?"');

  // Estados de erro / indisponível
  await page.goto(BASE + '/aula/nao-existe');
  await see('Conteúdo não encontrado');
  await page.goto(BASE + '/aula/o-que-significa-reutilizar');
  await see('Conteúdo indisponível por enquanto');
  log('Estados: conteúdo inexistente e conteúdo bloqueado');
  await shot('10-bloqueado');

  console.log(`  [${label}] overflow: ${overflowChecks.length ? overflowChecks.join(',') : 'nenhum'} · erros: ${JSON.stringify(errors)}`);
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
