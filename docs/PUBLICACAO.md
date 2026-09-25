# ECO QUEST · Guia de publicação

## 0. Publicação atual: Cloudflare Workers + Neon

O site está em **https://playkid.mluz787.workers.dev** (Worker `playkid`, conta Cloudflare mluz787@gmail.com) e usa
o Neon (projeto `empty-firefly-39961521` "PLAY KIDS", branch `production`, `aws-us-east-2`):

| Peça | Onde | Observação |
|---|---|---|
| Site (React) | Worker `playkid`, arquivos de `dist/` | `npm run build` usa os endereços públicos de `.env.production` |
| API de fotos | mesmo Worker, `worker/index.ts` (`/api/evidencia`) | confere o token do Neon Auth e as regras no banco |
| Login | Neon Auth (Managed Better Auth) | e-mail e senha; verificação de e-mail desligada |
| Banco | Neon Postgres + Data API | mesmas migrations do Supabase + `supabase/neon/*.sql` |
| Fotos | Neon Object Storage, bucket privado `evidence` | só o Worker tem as chaves; o navegador recebe links assinados de 1 h |

**Atualizar o site:** `npm run build && npx wrangler deploy`.

**Atualizar o banco** (depois de mudar migrations ou `content/*.json` + `npm run content:sql`):
`npm run db:neon` (lê `DATABASE_URL_UNPOOLED` do `.env.local`, gerado por `neon link`). O instalador aplica
`supabase/neon/00_compat.sql`, as migrations novas, sempre as de conteúdo, e `supabase/neon/99_accounts.sql`.
Teste antes num branch: `neon branch create --name teste` e `npm run db:neon -- --url <url do branch>`.

**Serviços do Neon:** declarados em `neon.ts` (`auth`, `dataApi`, bucket `evidence`) e aplicados com `neon deploy`.
Domínio do site liberado no login: `neon neon-auth domain add https://SEU-DOMINIO` (já feito para o workers.dev).

**Segredos do Worker** (não vão para o repositório; já configurados): `DATABASE_URL`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY` — trocar com `npx wrangler secret put NOME`. Os demais valores são públicos e estão em
`wrangler.jsonc` (`vars`).

**Diferenças do Neon em relação ao Supabase** (tratadas em `supabase/neon/`):
- o papel sem login chama `anonymous` (recebe o que `anon` tem); o jogo só consulta o banco depois do login;
- o esquema `auth` é do Neon: a tabela de usuários do jogo é `app_auth.users`, preenchida por `ensure_account()`
  na primeira entrada; `app_auth.uid()` repassa o `auth.uid()` do login para as funções e regras;
- excluir a conta apaga fotos, dados e o login (`neon_auth.user`);
- o e-mail compartilhado do Neon serve para começar; para recuperação de senha por link, configure um SMTP próprio
  (https://neon.com/docs/auth/production-checklist).

**Build automático pelo GitHub (opcional):** no painel da Cloudflare, Worker `playkid` → Settings → Builds →
conectar o repositório `MatheusLuz10/PLAYKID` com *Build* `npm run build` e *Deploy* `npx wrangler deploy`.

## 1. Supabase (produção)

1. Crie o projeto de produção (separado do de testes).
2. **Banco:** aplique as migrations em ordem — `supabase db push` (CLI) **ou** cole `supabase/setup.sql`
   (gerado por `npm run db:bundle`) no SQL Editor **uma única vez**. As migrations de conteúdo são idempotentes
   e podem ser reaplicadas depois de editar `content/*.json` (`npm run content:sql`).
3. **Auth → Providers → Email:** habilitado, com **Confirm email ativado**.
4. **Auth → URL Configuration:**
   - *Site URL:* `https://SEU-DOMINIO`
   - *Redirect URLs:* `https://SEU-DOMINIO`, `https://SEU-DOMINIO/redefinir-senha`
5. **Storage:** o bucket privado `eco-evidence` (10 MB, JPG/PNG/WebP) e suas políticas são criados pelas
   migrations. Confira em *Storage → Policies* que ele **não** é público.
6. **Primeiro administrador** (no SQL Editor, como dono do projeto):
   ```sql
   update public.profiles set role = 'admin'
   where user_id = (select id from auth.users where email = 'admin@exemplo.com');
   ```
   Os próximos são promovidos pelo próprio painel `/admin` → Usuários.
7. **Tarefa agendada (opcional):** `select public.expire_overdue_challenges();` uma vez por dia
   (*Database → Cron*), para marcar desafios com prazo vencido.

## 2. Vercel (ou outro host estático)

- *Framework:* Vite · *Build:* `npm run build` · *Output:* `dist` (já definidos em `vercel.json`).
- **Variáveis de ambiente (somente estas):**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`) — chave **pública**
- **Nunca** configure `service_role`, `sb_secret_…`, senha do banco ou outros segredos no frontend. O app
  recusa chaves privilegiadas e volta para o modo demonstração.
- `vercel.json` já traz: reescrita de rotas para a SPA, cache longo de `/assets` e cabeçalhos de segurança
  (CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` com câmera só no próprio
  site). Se usar outro domínio para o Supabase (domínio personalizado), inclua-o em `img-src` e `connect-src`.
- Em outro host: sirva `dist/` e redirecione rotas desconhecidas para `/index.html`, com os mesmos cabeçalhos.

## 3. Antes de cada publicação

```bash
npm ci
npm run test:db     # banco: migrations, RLS, regras, segurança (387 verificações)
npm run build       # tipos + build de produção
npm audit --omit=dev
```

- Nunca rode `DROP TABLE`/`TRUNCATE` em produção. Mudanças de banco entram **sempre** como nova migration.
- **Backup:** antes de migrations importantes, gere um backup (*Database → Backups* ou `supabase db dump`).
- Não reinicie o banco de produção para testar: use um projeto de testes.

## 4. Checklist final

| Área | Item | Como foi verificado |
|---|---|---|
| Autenticação | cadastro, login, logout, sessão, recuperação de senha | telas + fluxo Supabase Auth (recuperação precisa de SMTP configurado no projeto) |
| Aprendizado | categorias, lições, progresso, conclusão | e2e3 (celular e desktop) + testes do banco |
| Quiz | perguntas, respostas, nota, aprovação, tentativas | e2e4 + testes do banco |
| Desafios | desbloqueio, aceite, etapas, evidências, follow-up, conclusão | e2e5 + testes do banco |
| Gamificação | XP, histórico, níveis, level up, conquistas | e2e6 + testes do banco |
| Mundo | inicial, itens, desbloqueio, evolução, persistência | e2e7 + testes do banco |
| Meu Lugar (casa 3D) | casa inicial, objetos por aula/foto/desafio/conquista, origem e registro, estágios, sem duplicar, isolamento entre usuários, sem WebGL | e2e9 + testes do banco |
| Segurança | RLS, Storage, papéis, validação, idempotência | testes do banco (dois usuários, manipulação) |
| Interface | 320–1920 px, acessibilidade (axe), CSP | e2e8 |
| Produção | build, variáveis, cabeçalhos | `npm run build` + `vercel.json` |

## 5. Retenção e privacidade

- Exclusão de conta (Perfil → Excluir minha conta): apaga as fotos pelo Storage e, em seguida, o usuário —
  perfil, progresso, tentativas, desafios, evidências, XP, conquistas, mundo e casa (Meu Lugar) caem em cascata.
- `app_logs` guarda erros sem senha/token/e-mail; o registro de exclusão não identifica o usuário. Defina um
  prazo de retenção (ex.: apagar registros com mais de 90 dias) antes do uso em larga escala.
- Os textos de `/termos` e `/privacidade` são uma versão inicial e devem ser revisados juridicamente antes do
  uso real.
