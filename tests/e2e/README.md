# Testes de ponta a ponta (Playwright)

Roteiros que usam o app como um jogador, no **celular (375 px) e no desktop (1280 px)**, no modo demonstração.
O banco é testado à parte por `npm run test:db`.

| Arquivo | O que cobre |
|---|---|
| `03-aprendizagem.cjs` | biblioteca, busca, favoritos, aula em partes com retomada, resumo, relacionados, aulas abertas (sem pré-requisito) |
| `04-quiz.cjs` | quiz bloqueado pela URL até ver a aula, desafio aberto sem quiz, reprovação, nova tentativa, aprovação, XP sem duplicar, histórico, desempenho |
| `05-desafios.cjs` | missões abertas (aceitar sem aula/quiz), execução só após aceitar, checklist em ordem, foto (inválida, remover, trocar), acompanhamentos, conclusão, prazo vencido |
| `06-gamificacao.cjs` | XP por ação, conquistas, subida de nível (inclusive vários níveis), evolução, galeria, perfil |
| `07-mundo.cjs` | mundo inicial (3D), desbloqueios, árvore nova crescendo na cena, detalhes, história, teclado, redução de movimento |
| `08-integracao-final.cjs` | páginas públicas, boas-vindas, primeira missão, admin, exclusão de conta, offline, 9 larguras (320–1920), acessibilidade (axe) e CSP de produção |
| `12-online-neon.cjs` | site publicado com Neon: conta, perfil, aula, quiz, desafio, foto no Object Storage, sair/entrar, excluir conta |
| `11-mundo-3d.cjs` | mundo em 3D: prévia que não prende a página (roda e dedo), entrar/sair em tela cheia, 5 áreas, marcadores, detalhes, câmera, teclado, "Casa e quintal", entrar na casa pelo mapa e andar pelos cômodos, e o mapa 2D sem WebGL |
| `13-detetive-dos-moveis.cjs` | desafio infantil sobre os móveis da casa: aula, quiz, 5 etapas sem foto, conclusão e a cadeirinha que aparece na sala |
| `14-visitas.cjs` | casa completa para conta nova; lista dos jogadores cadastrados (sem o próprio) com busca; "🏡 Casa" entra direto na casa e "🌎 Mundo" abre o mundo de outro jogador (só olhar); @usuário inexistente; voltar para o próprio mundo |
| `15-reserva-florestal.cjs` | Reserva Florestal da Amazônia no Meu Mundo: fauna, flora e reflorestamento; aula e quiz de preservação feitos a partir da reserva; ✅ no quiz aprovado |
| `10-jogadores.cjs` | login de cada usuário (demonstração): criar conta, senha errada, sair/entrar, evolução separada, pausa após 5 tentativas, conta de demonstração, excluir só uma conta |
| `09-meu-lugar.cjs` | casa por dentro (sem lugar separado): entrar pelo Meu Mundo em tela cheia, andar pelos cômodos (joystick, teclado, arrastar), "Sair da casa" volta ao mapa; casa completa; quintal no mundo com origem e diário; versão sem WebGL |

## Como rodar

```bash
# 1. ferramentas (uma vez, fora das dependências do app)
npm i -D playwright axe-core && npx playwright install chromium

# 2. build + servidor de pré-visualização na porta 4318
npm run build:demo && npx vite preview --port 4318 --strictPort

# 3. em outro terminal
node tests/e2e/05-desafios.cjs
```

Variáveis opcionais: `BASE_URL` (padrão `http://localhost:4318`), `PLAYWRIGHT_MODULE` e `AXE_MODULE` (caminho dos
pacotes, se instalados em outra pasta). Capturas de tela ficam em `tests/e2e/.saida/` (ignorada pelo Git).

Os roteiros usam o **modo demonstração** (sem Supabase). Em alguns pontos eles simulam a passagem do tempo
editando os dados locais da demonstração — isso existe só para teste; no Supabase as datas são do servidor.

A demonstração normal abre com tudo concluído (para explorar a casa completa). Os roteiros começam como
**usuário novo**: gravam a marca `eco-quest:teste:sem-conclusao-automatica = 1` no `localStorage` (inclusive
logo depois de limpá-lo), o que desliga essa conclusão automática só no navegador do teste. A conclusão
automática vale só para o jogador de demonstração original; jogadores cadastrados depois começam do zero.

As quantidades esperadas (aulas, desafios, conquistas, itens do mundo, objetos da casa) vêm de `conteudo.cjs`,
que lê `content/*.json`: acrescentar conteúdo não quebra os roteiros.

Os roteiros que abrem o mundo em 3D (07, 08 e 11) usam a placa de vídeo no Windows (`navegador.cjs`); sem ela
o Chromium desenha por software, bem mais devagar. `E2E_SEM_GPU=1` força o modo por software.

Na demonstração é preciso entrar numa conta: os roteiros criam uma com `conta.cjs` (`criarConta`) ou entram na
conta de demonstração (`entrarNaDemonstracao`). Os dados de cada conta ficam em `eco-quest:demo:v2:<id>`
(`CHAVE_DA_CONTA`); a conta de demonstração continua em `eco-quest:demo:v2`.

Os roteiros 03 a 11 usam o **modo demonstração** (`npm run build:demo`); o `npm run build` normal gera a versão
com Neon (endereços de `.env.production`). O roteiro `12-online-neon.cjs` testa o **site publicado**
(`ONLINE_URL`, padrão https://playkid.mluz787.workers.dev): cria uma conta real no Neon Auth, faz aula, quiz,
desafio e envia uma foto pelo Worker, e no fim **exclui a conta** (não deixa dados).
