# Story: Auth Flow Hardening and Signup Confirmation

## Context
- Corrigir ruído/loop no acesso do dashboard com Supabase Auth.
- Reforçar o cadastro com `nome`, `telefone`, `email`, `senha` e `confirmacao de senha`.
- Garantir confirmacao por e-mail e bootstrap automatico de `organization + profile`.

## Acceptance Checklist
- [x] Auditar fluxo atual de auth, callback e rotas protegidas.
- [x] Padronizar redirecionamento pos-login e pos-callback para `next` valido ou `/performance`.
- [x] Adicionar `name`, `phone` e `confirmPassword` ao formulario de cadastro.
- [x] Validar obrigatoriedade de nome, telefone, senha minima e confirmacao de senha.
- [x] Enviar `name` e `phone` em `raw_user_meta_data` no `signUp`.
- [x] Impedir login automatico apos cadastro, mesmo se o Supabase retornar sessao.
- [x] Adicionar `phone` em `public.profiles`.
- [x] Criar trigger/fn idempotente para bootstrap de `organizations + profiles` ao criar usuario.
- [x] Atualizar tipos de Supabase para refletir `profiles.name` e `profiles.phone`.
- [x] Documentar requirement de `Confirm email` e callback `/auth/callback` no go-live.
- [x] Hotfix: trocar leitura dinâmica de env no client por leitura estática `NEXT_PUBLIC_*` com sanitização (`trim`).
- [x] Hotfix: remover logs de diagnóstico temporários do fluxo `/auth` em produção.
- [x] Atualizar checklist e file list da story antes de concluir.

## Quality Gates
- [x] `npm run build --workspace start-metric` (2026-03-16: passou apos ajuste de tipagem em `apps/dashboard/src/app/(dashboard)/reports/page.tsx`)
- [ ] `npm run lint` (2026-03-16: falhou por erros pre-existentes em `apps/dashboard` reports e warnings diversos)
- [ ] `npm run typecheck` (2026-03-16: falhou por erros pre-existentes em `apps/api` e `apps/dashboard` reports)
- [x] `npm test` (2026-03-16: `api` test suite passou)
- [ ] `npm run lint --workspace start-metric` (2026-03-16: falhou por `no-explicit-any` em reports)
- [ ] `npm run typecheck --workspace start-metric` (2026-03-16: falhou por casts de tipos em reports)

## File List
- [x] `apps/dashboard/src/app/auth/page.tsx`
- [x] `apps/dashboard/src/app/auth/AuthPageClient.tsx`
- [x] `apps/dashboard/src/app/(dashboard)/reports/page.tsx`
- [x] `apps/dashboard/src/app/auth/callback/route.ts`
- [x] `apps/dashboard/src/proxy.ts`
- [x] `apps/dashboard/next.config.ts`
- [x] `apps/dashboard/src/lib/supabase/client.ts`
- [x] `apps/dashboard/src/lib/supabase/server.ts`
- [x] `apps/dashboard/src/lib/supabase.ts`
- [x] `apps/dashboard/src/lib/supabase/types.ts`
- [x] `apps/dashboard/supabase/migrations/20260314120000_auth_signup_bootstrap.sql`
- [x] `MIGRATIONS_CONSOLIDATED.sql`
- [x] `apps/dashboard/GO_LIVE_BASIC.md`
- [x] `docs/stories/2026-03-14-auth-flow-hardening.md`
