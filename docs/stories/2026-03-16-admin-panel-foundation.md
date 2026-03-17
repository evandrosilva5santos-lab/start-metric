# Story: Admin Panel Foundation (Mock Plans + Real Users + Logs/Problems)

## Context
Criar uma primeira versão da área administrativa do SaaS para operação interna, mantendo:
- dados de receita fictícios (mock),
- criação e gestão de usuários reais,
- registro detalhado de logs técnicos,
- backlog de problemas com causa raiz e análise minuciosa.

## Checklist
- [x] Criar base de banco para admin (`admin_plans`, `admin_user_subscriptions`, `admin_user_logs`, `admin_problem_reports`, `admin_revenue_snapshots_mock`) com RLS.
- [x] Criar helper server-side para Supabase service role (`createAdminClient`).
- [x] Criar helper de contexto/autorização para org + papel admin.
- [x] Implementar API `GET/POST /api/admin/plans`.
- [x] Implementar API `GET/POST /api/admin/users` (criação real em Auth + vínculo em `profiles`).
- [x] Implementar API `GET/POST /api/admin/logs` (registro técnico com causa raiz).
- [x] Implementar API `GET/POST /api/admin/problems`.
- [x] Implementar API `PATCH /api/admin/problems/[problemId]`.
- [x] Implementar API `GET/POST /api/admin/revenue` (mock, com fallback gerado).
- [x] Criar tela `/admin` com formulários e listagens operacionais.
- [x] Separar rota de admin em layout dedicado de backoffice (fora da área principal do cliente).
- [x] Isolar autorização de admin via allowlist de e-mails (`ADMIN_PANEL_ALLOWED_EMAILS`) para não depender de role de cliente.
- [x] Bloquear acesso direto a `/admin` no `proxy.ts` para contas não-admin.
- [x] Remover link de admin da navegação do usuário comum (header/sidebar).
- [x] Criar login exclusivo do admin em `/admin/auth` com visual e fluxo separados do `/auth` de cliente.
- [x] Criar endpoint de validação pós-login (`GET /api/admin/access`) para impedir sessão de cliente no backoffice.

## Validation
- [x] `npm run typecheck --workspace start-metric`
- [x] `npm run build --workspace start-metric`
- [ ] `npm run lint --workspace start-metric` (falha por erros preexistentes em `reports` e `api/reports`, fora deste hotfix)
- [x] `npx eslint src/proxy.ts src/lib/admin src/components/layout/Header.tsx src/components/layout/Sidebar.tsx src/app/admin` (no workspace `apps/dashboard`)
- [ ] `npm test --workspace start-metric` (script `test` não existe no workspace)
- [x] `npm test` (monorepo/Turbo)

## File List
- `apps/dashboard/supabase/migrations/20260316193000_admin_panel_foundation.sql`
- `apps/dashboard/src/lib/supabase/admin.ts`
- `apps/dashboard/src/lib/admin/access.ts`
- `apps/dashboard/src/lib/admin/context.ts`
- `apps/dashboard/src/lib/admin/types.ts`
- `apps/dashboard/src/lib/admin/validation.ts`
- `apps/dashboard/src/proxy.ts`
- `apps/dashboard/src/app/api/admin/plans/route.ts`
- `apps/dashboard/src/app/api/admin/users/route.ts`
- `apps/dashboard/src/app/api/admin/logs/route.ts`
- `apps/dashboard/src/app/api/admin/access/route.ts`
- `apps/dashboard/src/app/api/admin/problems/route.ts`
- `apps/dashboard/src/app/api/admin/problems/[problemId]/route.ts`
- `apps/dashboard/src/app/api/admin/revenue/route.ts`
- `apps/dashboard/src/app/admin/layout.tsx`
- `apps/dashboard/src/app/admin/page.tsx`
- `apps/dashboard/src/app/admin/AdminPanelClient.tsx`
- `apps/dashboard/src/app/admin/auth/page.tsx`
- `apps/dashboard/src/app/admin/auth/AdminAuthClient.tsx`
- `apps/dashboard/src/components/layout/Header.tsx`
- `apps/dashboard/src/components/layout/Sidebar.tsx`
