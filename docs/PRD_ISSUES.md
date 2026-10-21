# PRD_ISSUES.md — Registro de Divergências, Gaps e Conflitos

> **Objetivo:** Registrar qualquer inconsistência entre requisitos do PRD, arquitetura e implementação real sem alterar silenciosamente as fontes superiores.

---

| ID | Referência PRD | Problema Encontrado | Tipo | Impacto | Evidência / Arquivo | Status | Decisão Necessária |
|---|---|---|---|---|---|---|---|
| **ISSUE-001** | PRD §Princípio de Pareto - Feature 1 | Cálculo de Lucro Líquido Real necessita de ingestão contínua de pedidos reais (Stripe/Shopify/Webhooks) | `MISSING_REQUIREMENT` | `ALTO` | `apps/dashboard/src/app/(dashboard)/performance/` | `OPEN` | Finalizar webhook de ingestão de pedidos de checkout para alimentar a tabela `orders` |
| **ISSUE-002** | PRD §Princípio de Pareto - Feature 2 | Agendador de relatórios do Report Builder depende de cron contínuo ativo no backend | `DEPENDENCY` | `MÉDIO` | `apps/dashboard/src/app/api/cron/` | `OPEN` | Configurar invocação periódica do endpoint `/api/cron/alerts-monitor` via Vercel Cron ou BullMQ |
| **ISSUE-003** | PRD §Modelo de Dados | Sincronização do Supabase requer execução manual do script `corrigir_banco.sql` em novos deploys se migrations não forem automáticas | `INCONSISTENCY` | `MÉDIO` | `apps/dashboard/supabase/scripts/corrigir_banco.sql` | `OPEN` | Padronizar pipeline de migração automática do Supabase CLI no CI/CD |
| **ISSUE-004** | PRD §Backlog - WhatsApp Pro | Proxy manager por instância de WhatsApp marcado como backlog no PRD, mas pacote base já possui tipos e stubs | `AMBIGUITY` | `BAIXO` | `packages/whatsapp/src/` | `OPEN` | Manter interface com `<ComingSoonBadge />` até homologação completa de proxies residenciais |
