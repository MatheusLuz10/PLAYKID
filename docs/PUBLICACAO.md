# ECO QUEST · Guia de publicação

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
