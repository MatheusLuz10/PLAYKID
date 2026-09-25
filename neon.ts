import { defineConfig } from "@neon/config/v1";

// Serviços do ECO QUEST no Neon (aplicar com `neon deploy`):
// - auth: login por e-mail e senha (Managed Better Auth);
// - dataApi: o app já usa o cliente de banco do Supabase (rpc/from), então a Data API
//   (compatível com PostgREST) mantém as funções SQL e as regras RLS já testadas;
// - buckets.evidence: fotos das evidências dos desafios (privado; o Worker assina os links).
export default defineConfig({
  auth: true,
  dataApi: true,
  buckets: {
    evidence: { access: "private" },
  },
});
