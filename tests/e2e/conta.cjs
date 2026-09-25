// Contas da demonstração (login local com senha) para os roteiros de teste.
const SENHA = 'senha-eco-123';

/** Da tela inicial sem ninguém conectado: Começar → Criar conta → tela "Crie seu perfil". */
async function criarConta(page, usuario, senha = SENHA) {
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.waitForURL('**/entrar');
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome de usuário').fill(usuario);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByLabel('Confirmar senha').fill(senha);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.waitForURL('**/criar-perfil');
}

/** Entra na conta de demonstração (sem senha, tudo desbloqueado). */
async function entrarNaDemonstracao(page, base) {
  await page.goto(base + '/entrar');
  await page.getByRole('button', { name: /Entrar na conta de demonstração/ }).click();
  await page.waitForURL('**/inicio');
}

/**
 * Chave dos dados da conta conectada (use dentro de page.evaluate):
 * a conta de demonstração fica em 'eco-quest:demo:v2'; as outras em 'eco-quest:demo:v2:<id>'.
 */
const CHAVE_DA_CONTA = `(() => { const r = JSON.parse(localStorage.getItem('eco-quest:demo:jogadores') || '{}'); return !r.session || r.session === 'demo-user' ? 'eco-quest:demo:v2' : 'eco-quest:demo:v2:' + r.session; })()`;

module.exports = { SENHA, criarConta, entrarNaDemonstracao, CHAVE_DA_CONTA };
