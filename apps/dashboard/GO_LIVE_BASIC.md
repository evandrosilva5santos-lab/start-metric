# Go Live (Basico) - Start Metric Dashboard

Objetivo: colocar o `apps/dashboard` no ar (Vercel) para conectar Meta Ads e visualizar campanhas/metricas.

## 1) Pre-requisitos
- Vercel project ja esta linkado neste repo em `apps/dashboard/.vercel/project.json`.
- Supabase projeto existente e acessivel (env vars).
- Meta Developer App com permissao de Ads (env vars).

## 2) Variaveis de ambiente (Vercel: Preview + Production)
Configure em Vercel (Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; necessario para cron)
- `SUPABASE_ENCRYPTION_KEY` (>= 32 chars; server-only)
- `META_APP_ID` (server-only)
- `META_APP_SECRET` (server-only)
- `META_GRAPH_API_VERSION` (ex: `v19.0`)
- `CRON_SECRET` (server-only; usado para triggers manuais e protecao adicional)

Observacao:
- `META_REDIRECT_URI` agora e opcional. Se voce usa dominio custom, pode setar para fixar o callback.

## 3) Meta OAuth Redirect URIs (Meta Developer Console)
Adicione como "Valid OAuth Redirect URIs" (pelo menos estes):
- `http://localhost:3000/api/meta/callback`
- `https://SEU-DEPLOY-VERCEL/api/meta/callback`

Se voce usa dominio custom, inclua tambem:
- `https://SEU-DOMINIO/api/meta/callback`

## 4) Banco (Supabase)
Garanta que as migrations de `apps/dashboard/supabase/migrations` foram aplicadas no seu projeto Supabase
(tabelas `profiles`, `ad_accounts`, `campaigns`, `daily_metrics`, funcoes `encrypt_token`/`decrypt_token`, RLS, etc).

## 4.1) Auth (Supabase)
- Em `Authentication > Providers > Email`, mantenha `Confirm email` habilitado.
- Em `Authentication > URL Configuration`, garanta que o redirect permitido inclui:
  - `http://localhost:3000/auth/callback`
  - `https://SEU-DEPLOY-VERCEL/auth/callback`
- O cadastro do app depende do trigger que cria automaticamente `organizations + profiles` para novos usuarios.

## 5) Smoke test (na producao/preview)
1. Abrir `/auth` e autenticar
2. Ir em `/settings/meta`
3. Clicar "Conectar conta Meta Ads" e concluir OAuth
4. Voltar em `/settings/meta` e clicar "Sincronizar"
5. Confirmar que campanhas e metricas aparecem (ou que nao ha erros de token/rate limit)

## 6) Cron (opcional, para atualizar automaticamente)
O arquivo `apps/dashboard/vercel.json` agenda:
- `/api/cron/meta-sync` (3:00 diario)
- `/api/cron/alerts-monitor` (a cada 15 minutos)

Os endpoints aceitam:
- `Authorization: Bearer ${CRON_SECRET}` (manual)
- Header `x-vercel-cron: 1` (Vercel Cron)
