# Story: Database Realtime Hardening (Supabase/Postgres)

## Context
- Auditar tabelas core do domínio de dados e corrigir inconsistências de integridade.
- Garantir RLS funcional e alinhado ao tenant atual (`public.current_org_id()`).
- Habilitar Realtime em tabelas com necessidade de broadcast.
- Tipar o client Supabase para reduzir risco de drift entre schema e app.

## Acceptance Checklist
- [x] Auditar tabelas core e identificar pontos críticos de schema/RLS.
- [x] Corrigir políticas RLS de vendas que referenciavam tabela inexistente (`organization_members`).
- [x] Normalizar tipagem/check constraints críticas de `sales_orders`.
- [x] Habilitar inclusão idempotente no publication `supabase_realtime` para tabelas de broadcast.
- [x] Tipar `src/lib/supabase.ts` com `Database`.
- [x] Rodar `npm run lint` (passou; apenas warnings não-bloqueantes).
- [x] Rodar `npm run typecheck`.
- [x] Rodar `npm test`.
- [x] Atualizar checklist e file list da story antes de concluir.

## Quality Gates
- [x] `npm run lint` (passou; warnings existentes)
- [x] `npm run typecheck`
- [x] `npm test` (passou)

## File List
- [x] `apps/dashboard/src/lib/supabase.ts`
- [x] `apps/dashboard/src/app/api/webhooks/stripe/route.ts`
- [x] `apps/dashboard/supabase/migrations/20260315030000_data_layer_hardening_realtime.sql`
- [x] `apps/api/prisma/schema.prisma`
- [x] `apps/api/src/prisma.module.ts`
- [x] `apps/api/src/webhooks/stripe/stripe.controller.ts`
- [x] `apps/api/src/webhooks/stripe/stripe-webhook.service.ts`
- [x] `docs/stories/2026-03-15-database-realtime-hardening.md`

## Execution Notes
- Tentativa de aplicar migration remota via Supabase CLI bloqueada por permissao da conta atual:
  - `supabase link --project-ref etjqbqorawnnvdlmztka` retornou `Forbidden resource`.
