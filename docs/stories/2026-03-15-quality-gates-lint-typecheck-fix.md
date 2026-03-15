# Story: Quality Gates Fix - Lint/Typecheck Stabilization

## Context
- Request: corrigir erros sem alterar comportamento do app.
- Scope: fixes mínimos para restaurar quality gates no monorepo.

## Acceptance Checklist
- [x] Corrigir erro de lint em webhook Stripe do dashboard (`require` -> import ESM).
- [x] Corrigir bloqueios de typecheck no `apps/api` relacionados a Stripe webhook controller/service.
- [x] Corrigir/normalizar estrutura do `apps/api/prisma/schema.prisma` para permitir Prisma Client válido.
- [x] Garantir disponibilidade de `PrismaService` via módulo dedicado para injeção no webhook module.
- [x] Executar quality gates no root.
- [x] Atualizar checklist e file list antes de concluir.

## Quality Gates
- [x] `npm run lint` (passou com warnings não bloqueantes)
- [x] `npm run typecheck`
- [x] `npm test`

## File List
- [x] `apps/api/prisma/schema.prisma`
- [x] `apps/api/src/prisma.module.ts`
- [x] `apps/api/src/app.module.ts`
- [x] `apps/api/src/webhooks/stripe/stripe.controller.ts`
- [x] `apps/api/src/webhooks/stripe/stripe-webhook.service.ts`
- [x] `apps/dashboard/src/app/api/webhooks/stripe/route.ts`
- [x] `docs/stories/2026-03-15-quality-gates-lint-typecheck-fix.md`
