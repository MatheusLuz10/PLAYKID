# ECO QUEST · Mapa da arquitetura

> Aprenda. Faça. Transforme. O jogo recompensa **aprendizado e ações reais**, nunca cliques.

## Visão geral

```text
                    ECO QUEST
                        │
        ┌───────────────┼───────────────┐
    APRENDER        DESAFIOS       GAMIFICAÇÃO
      LIÇÕES        EVIDÊNCIAS         XP
       QUIZ         FOLLOW-UPS       NÍVEIS
        └───────────────┼───────────────┘
                   CONQUISTAS
                        ↓
                  MUNDO VIRTUAL
```

- **Frontend:** React 19 + TypeScript + Vite, React Router, CSS puro com tokens (`src/styles/tokens.css`).
- **Backend:** Supabase — PostgreSQL (RLS em todas as tabelas), Auth (e-mail/senha), Storage (bucket privado
  `eco-evidence`). Toda escrita do jogo passa por **funções SQL `security definer`** que validam as regras; o
  navegador só pede ações.
- **Modo demonstração:** sem variáveis de ambiente, o app usa `LocalBackend`, que reproduz as mesmas regras no
  navegador (dados só neste dispositivo). Útil para apresentação e testes de interface. Aceita vários jogadores
  no mesmo aparelho (`services/demoPlayers.ts`, tela `/jogadores`): cada um tem a própria chave de dados
  (`eco-quest:demo:v2` para o jogador original, `eco-quest:demo:v2:<id>` para os demais) e o registro
  `eco-quest:demo:jogadores` guarda só a lista e o jogador atual.

## Pastas

```text
content/                  Fontes únicas do conteúdo (geram o SQL e alimentam a demonstração)
  lessons.json · quizzes.json · challenges.json · gamification.json · world.json · place.json
scripts/
  build-content-sql.mjs   content/*.json → migrations 15, 17, 20, 22, 24 e 27 (valida tudo antes)
  bundle-sql.mjs          todas as migrations → supabase/setup.sql
supabase/
  migrations/             01…27 (esquema, RLS, funções, conteúdo) — ver tabela abaixo
  tests/db.test.mjs       testes do banco em PGlite (sem Docker)
src/
  App.tsx                 rotas (públicas, autenticadas, /admin; páginas raras sob demanda)
  models/                 tipos de domínio
  services/               supabaseClient (só chave pública), authService, errors, logger, imageService
    backend/              GameBackend (contrato) · SupabaseBackend · LocalBackend · mappers
  state/                  AuthContext (sessão) · GameContext (conteúdo + jogador + ações)
  logic/                  regras de leitura puras: missão, desafios, XP/níveis, gamificação, mundo, catálogo
  hooks/                  useMission, useLessonDetail, useOnlineStatus
  components/             layout (AppShell, NavBar, guards, ErrorBoundary), ui, learning, quiz, mission,
                          challenge, player, achievements, gamification, world, onboarding
  modules/place/          🏡 Meu Lugar: cena 3D (three.js, rota /meu-lugar sob demanda), catálogo, regras, tela
                          (mesmo visual realista do mundo: texturas em canvas, modelos do jardim vindos de world3d/)
  modules/world3d/        🌎 Meu Mundo em 3D (sob demanda em /mundo): layout das 5 áreas, paisagem, modelos por item,
                          cena (sombras estáticas, abertura em etapas, qualidade automática); sem WebGL → WorldMap 2D
  pages/                  telas (inclui learning/, mission/ e public/)
  data/                   avatares + dados da demonstração (lidos de content/)
  styles/                 tokens, base, layout, componentes e um arquivo por etapa
docs/                     este mapa e o guia de publicação
```

## Fluxo principal (e onde cada regra vive)

| Passo | Tela | Função no servidor |
|---|---|---|
| Cadastro / login | `AuthPage` | Supabase Auth → trigger `handle_new_user` (perfil) → `handle_new_profile` (mundo inicial) |
| Perfil | `CreateProfilePage` | `update` restrito às colunas de perfil (RLS + grants por coluna) |
| Lição | `LessonPlayer` | `track_lesson_progress`, `complete_lesson` |
| Quiz | `QuizPlayer` | `start_quiz_attempt`, `answer_quiz_question` (gabarito nunca vai ao cliente), `finish_quiz_attempt` |
| Desafio | `ChallengePage` | `accept_challenge` (exige aula + quiz aprovado; prazo do servidor) |
| Execução / evidência | `ChecklistPage` | upload no Storage (pasta do usuário) + `complete_challenge_step` |
| Acompanhamento | `TrackingPage` | `complete_followup` (datas pelo relógio do servidor) |
| Conclusão | `RewardPage` | `complete_challenge` (idempotente) |
| XP / nível / conquista | automático | `process_gamification_event` → `xp_transactions` → trigger de nível → `check_achievements` |
| Mundo | `WorldPage` | trigger em `gamification_events` → `sync_world` → `refresh_world` (estágio) |
| Meu Lugar (casa 3D) | `PlacePage` | trigger em `gamification_events` → `sync_place` (objetos, sem XP próprio); leitura `get_place_state`, novidades vistas `reveal_place_items` |

Todo XP nasce de um **evento verificado** com chave única `(usuário, tipo, referência)`: atualizar a página,
clicar duas vezes ou repetir chamadas não gera recompensa de novo.

## Migrations

| Faixa | Conteúdo |
|---|---|
| 01–13 | extensões, perfis, categorias, aulas, quizzes, desafios, evidências, progresso, XP, conquistas, mundo, RLS, seed |
| 14–15 | sistema de aprendizagem (+ conteúdo gerado) |
| 16–17 | quiz (+ conteúdo gerado) |
| 18–20 | calendário e sistema de desafios (+ conteúdo gerado) |
| 21–22 | gamificação: eventos, XP por origem, níveis e conquistas (+ conteúdo gerado) |
| 23–24 | mundo virtual: áreas, estágios, itens e desbloqueios (+ conteúdo gerado) |
| 25 | integração final: índices, histórico de conteúdo desativado, logs, exclusão de conta, administração |
| 26–27 | Meu Lugar: estágios e objetos da casa, `user_place_items` (1 por objeto, RLS só do dono), `sync_place` (+ conteúdo gerado) |

## Segurança (resumo)

- **RLS em todas as tabelas** (testado). Dados privados: somente o dono (e admin, quando necessário).
- **Conteúdo** é público para leitura; só admin escreve. Conteúdo desativado some para novos jogadores e continua
  visível para quem já tem histórico (`has_content_history`).
- **Nada de XP, nível, conquista, conclusão ou item vindo do cliente**: as tabelas não têm permissão de escrita
  para o usuário; tudo passa pelas funções.
- **Storage privado**: caminho `users/{uid}/challenges/{desafio}/…`, JPG/PNG/WebP até 10 MB, leitura por URL
  assinada; o jogador só apaga arquivos que não são evidência (ou todos, ao excluir a conta).
- **Chaves**: o frontend recusa `service_role`/`sb_secret_` e usa só a chave pública.
- **Admin**: `profiles.role = 'admin'`; toda função de administração chama `require_admin()`. Ninguém muda o
  próprio papel.
- **XSS**: nenhum HTML bruto é renderizado; textos do usuário são limpos no servidor (`sanitize_note`); URLs de
  imagem passam por `safeImageSrc`.
- **Cabeçalhos de produção** (`vercel.json`): CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`.

## Erros e monitoramento

- `services/errors.ts` traduz códigos do servidor em mensagens amigáveis (nunca mostra SQL/SQLSTATE).
- `services/logger.ts` registra erros inesperados sem dados sensíveis e os envia para `public.app_logs`
  (`log_client_error`, limitado por minuto). Para usar uma ferramenta externa, troque o `setLogReporter` em
  `services/index.ts`.
- `ErrorBoundary` evita tela branca; `OfflineBanner` avisa quando a conexão cai (nenhuma ação é marcada como
  feita sem confirmação do servidor).
- Sessão expirada: o servidor recusa o token → evento `SESSION_EXPIRED_EVENT` → sessão local encerrada → tela
  "Entrar" com aviso e retorno à página em que o jogador estava.
