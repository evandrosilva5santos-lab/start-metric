# Story: Sprint 4 - WhatsApp Connection por Cliente

## Context
Implementação do escopo descrito em `docs/sprints/sprint-4-whatsapp-connection.md`:
- conexão de instância WhatsApp por cliente,
- fluxo de QR Code com polling,
- endpoints de criação/status/teste/desconexão,
- webhook para atualização de estado,
- badge de status na listagem de clientes.

## Checklist
- [x] Criar migration para `public.whatsapp_instances` com `client_id`, `qr_code`, `last_connected_at`, índices e RLS por org.
- [x] Atualizar `packages/whatsapp` com métodos de instância/QR/status/delete e helper `createEvolutionClient`.
- [x] Criar `POST/GET /api/whatsapp/instances`.
- [x] Criar `GET /api/whatsapp/instances/[id]/status`.
- [x] Criar `DELETE /api/whatsapp/instances/[id]`.
- [x] Criar `POST /api/whatsapp/instances/[id]/test`.
- [x] Criar webhook `POST /api/webhooks/whatsapp` com validação de secret.
- [x] Criar `WhatsAppConnectionPanel` com state machine e polling a cada 3s.
- [x] Criar página de cliente em `/clients/[id]` com seção de conexão WhatsApp.
- [x] Adicionar badge de status do WhatsApp no card de clientes em `/clients`.

## Validation
- [x] `npm test`
- [ ] `npm run lint` (falha por erros preexistentes fora do escopo em `reports`, `analytics/export`, `profile`, `dashboard/queries`)
- [ ] `npm run typecheck` (falha por erros preexistentes fora do escopo em `profile`, `analytics/export`, `dashboard/queries`)
- [x] `npx eslint` focado nos arquivos alterados do Sprint 4 (sem erros, apenas warnings `@next/next/no-img-element`)
- [x] `npm run build --workspace @start-metric/whatsapp`

## File List
- `apps/dashboard/supabase/migrations/20260319010000_whatsapp_instances_connection.sql`
- `apps/dashboard/src/lib/supabase/types.ts`
- `packages/whatsapp/src/client.ts`
- `packages/whatsapp/src/types.ts`
- `packages/whatsapp/src/index.ts`
- `apps/dashboard/src/lib/whatsapp/evolution.ts`
- `apps/dashboard/src/app/api/whatsapp/instances/route.ts`
- `apps/dashboard/src/app/api/whatsapp/instances/[id]/route.ts`
- `apps/dashboard/src/app/api/whatsapp/instances/[id]/status/route.ts`
- `apps/dashboard/src/app/api/whatsapp/instances/[id]/test/route.ts`
- `apps/dashboard/src/app/api/webhooks/whatsapp/route.ts`
- `apps/dashboard/src/components/whatsapp/WhatsAppConnectionPanel.tsx`
- `apps/dashboard/src/app/(dashboard)/clients/[id]/page.tsx`
- `apps/dashboard/src/components/clients/ClientCard.tsx`
- `apps/dashboard/src/app/(dashboard)/clients/ClientsPageClient.tsx`
- `apps/dashboard/src/app/api/clients/route.ts`

