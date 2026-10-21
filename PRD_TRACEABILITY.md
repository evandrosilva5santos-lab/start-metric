# PRD_TRACEABILITY.md — Matriz de Rastreabilidade de Requisitos

> **Regra de Ouro:** Nenhum requisito do PRD pode ficar sem destino e nenhuma tarefa pode existir sem origem explícita.

---

```text
PRD REQUIREMENT
↓
PHASE
↓
EPIC
↓
TASK
↓
MICRO TASK
↓
NANO TASK
↓
FILE
↓
TEST / VALIDATION
↓
STATUS
```

---

## 1. Matriz Completa de Rastreamento

| ID Requisito PRD | Descrição do Requisito | Fase | Epic | Task | Micro Task | Nano Task | Arquivo(s) de Implementação | Método de Validação | Status |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-CORE-001** | Conexão OAuth com Meta Ads Graph API v21+ | FASE 01 | EPIC-001 (Auth & Meta Ingestion) | TASK-001 | MICRO-001.01 | NANO-001.01.01 | `apps/dashboard/src/app/api/meta/oauth/route.ts` | Teste de handshake OAuth no browser | `DONE` |
| **REQ-CORE-002** | Criptografia de Access Tokens AES-256 | FASE 01 | EPIC-001 (Auth & Meta Ingestion) | TASK-001 | MICRO-001.02 | NANO-001.02.01 | `apps/dashboard/src/lib/security/encryption.ts` | Teste de encriptação e decriptação de token | `DONE` |
| **REQ-CORE-003** | Multi-Tenancy Lógico via RLS no Supabase | FASE 01 | EPIC-002 (Data Isolation & RLS) | TASK-002 | MICRO-002.01 | NANO-002.01.01 | `apps/dashboard/supabase/scripts/corrigir_banco.sql` | Query com `auth_org_id()` diferente | `DONE` |
| **REQ-CORE-004** | Master Gate de Autenticação com PAINEL_SENHA | FASE 01 | EPIC-002 (Data Isolation & RLS) | TASK-002 | MICRO-002.02 | NANO-002.02.01 | `apps/dashboard/src/lib/auth/painel.ts` | Teste de login em `/auth` com cookie | `DONE` |
| **REQ-CORE-005** | Dashboard de Performance (ROAS, CPA, Spend) | FASE 01 | EPIC-003 (Core Performance Dashboard) | TASK-003 | MICRO-003.01 | NANO-003.01.01 | `apps/dashboard/src/app/(dashboard)/performance/page.tsx` | Renderização de KPI Cards e Gráficos | `DONE` |
| **REQ-CORE-006** | CRM de Clientes e Busca de Contas de Anúncio | FASE 01 | EPIC-003 (Core Performance Dashboard) | TASK-003 | MICRO-003.02 | NANO-003.02.01 | `apps/dashboard/src/app/(dashboard)/clients/page.tsx` | Cadastro de cliente e fetch de contas | `DONE` |
| **REQ-CORE-007** | Esteira e Mineração de Ofertas (Garimpo) | FASE 01 | EPIC-004 (Intelligence & Garimpo) | TASK-004 | MICRO-004.01 | NANO-004.01.01 | `apps/dashboard/src/app/(dashboard)/garimpo/page.tsx` | `npm run test:garimpo` (7/7 pass) | `DONE` |
| **REQ-CORE-008** | Ingestão de Pedidos Reais de Checkout (Stripe/Shopify) | FASE 02 | EPIC-005 (Real Profit & Attribution) | TASK-005 | MICRO-005.01 | NANO-005.01.01 | `apps/dashboard/src/app/api/webhooks/stripe/route.ts` | Teste de payload webhook com cálculo de taxas | `READY` |
| **REQ-CORE-009** | Motor de Atribuição Last-Click com Caixa Real | FASE 02 | EPIC-005 (Real Profit & Attribution) | TASK-005 | MICRO-005.02 | NANO-005.02.01 | `packages/attribution/src/engine.ts` | Cruzamento de UTM/Ad_ID com Order_ID | `READY` |
| **REQ-CORE-010** | Report Builder com Templates Dinâmicos | FASE 02 | EPIC-006 (Intelligent Reports) | TASK-006 | MICRO-006.01 | NANO-006.01.01 | `apps/dashboard/src/app/(dashboard)/reports/page.tsx` | Geração de documento de relatório por cliente | `READY` |
| **REQ-CORE-011** | WhatsApp Evolution API v2 (Multi-Instâncias) | FASE 03 | EPIC-007 (WhatsApp Automation) | TASK-007 | MICRO-007.01 | NANO-007.01.01 | `packages/whatsapp/src/evolution-client.ts` | Leitura de QR Code e envio de mensagem de teste | `READY` |
| **REQ-CORE-012** | Disparo Automático de Relatório Matinal via WhatsApp | FASE 03 | EPIC-007 (WhatsApp Automation) | TASK-007 | MICRO-007.02 | NANO-007.02.01 | `apps/dashboard/src/app/api/cron/alerts-monitor/route.ts` | Execução do cron e recebimento da mensagem no celular | `READY` |
| **REQ-CORE-013** | Meta CAPI Server-Side Hashing & Deduplicação | FASE 03 | EPIC-008 (Server-Side Tracking) | TASK-008 | MICRO-008.01 | NANO-008.01.01 | `packages/attribution/src/capi.ts` | Teste no Gerenciador de Eventos da Meta | `READY` |
