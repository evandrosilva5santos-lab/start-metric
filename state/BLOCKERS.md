# BLOCKERS.md — Registro de Bloqueios e Impedimentos

> **Status Possíveis:** `RESOLVED`, `RESOLVED`, `WONT_FIX`

---

| ID | Data | Origem | Descrição do Bloqueio | Impacto | Tarefa Bloqueada | Decisão / Ação Necessária | Responsável | Status |
|---|---|---|---|---|---|---|---|---|
| BLK-001 | 28/09/2026 | Auditoria Antigravity | Falha de compilação TS em `apps/dashboard/src/app/api/webhooks/stripe/route.ts`: export não encontrado em `@start-metric/types`, apiVersion incompatível (`2023-10-16` vs esperada pela lib) e tipo implícito `any` no map de itens. | `npm run typecheck` falha com código 1. | `NANO-005.01.01` | Corrigir a tipagem, rebuildar `@start-metric/types` e ajustar os parâmetros do Stripe e type annotation em `item`. | Claude | `RESOLVED` |
| BLK-002 | 28/09/2026 | Auditoria Antigravity | Perda de parâmetros de atribuição (`click_id`, `attribution_fbc`, `attribution_fbp`) no `StripeWebhookPayloadSchema` em `packages/types/src/orders.ts`. O Zod `safeParse` descarta esses campos. | Motor de atribuição last-click recebe `undefined` para cliques/pixels. | `NANO-005.01.01` | Adicionar campos opcionais de tracking/atribuição ao `StripeWebhookPayloadSchema`. | Claude | `RESOLVED` |
