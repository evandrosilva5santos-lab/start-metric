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
- [x] Atualizar checklist e file list da story antes de concluir.

## Quality Gates
- [ ] `npm run lint` (falhou por erros pre-existentes no `apps/api`)
- [ ] `npm run typecheck` (falhou por erros pre-existentes no `apps/api`)
- [x] `npm test`
- [x] `npm run lint --workspace start-metric`
- [x] `npm run typecheck --workspace start-metric`

## File List
- [x] `apps/dashboard/src/app/auth/page.tsx`
- [x] `apps/dashboard/src/app/auth/callback/route.ts`
- [x] `apps/dashboard/src/proxy.ts`
- [x] `apps/dashboard/src/lib/supabase/types.ts`
- [x] `apps/dashboard/supabase/migrations/20260314120000_auth_signup_bootstrap.sql`
- [x] `MIGRATIONS_CONSOLIDATED.sql`
- [x] `apps/dashboard/GO_LIVE_BASIC.md`
- [x] `docs/stories/2026-03-14-auth-flow-hardening.md`
