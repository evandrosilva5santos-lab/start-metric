# 🗺️ Roadmap de Execução — Start Metric

> Alinhado com PRD.md (fonte única de verdade). Princípio de Pareto aplicado.

---

## 🎯 Norte Verdadeiro

**Lucro real por campanha na tela do cliente.** Tudo que não serve a isso é backlog.

---

## ✅ Já Entregue (Fundação)

- [x] Monorepo Turborepo (apps/dashboard + apps/api + packages/db)
- [x] Next.js 16 + React 19 + Tailwind CSS v4
- [x] Supabase Auth (multi-tenant por org_id)
- [x] Integração Meta Ads (Graph API — OAuth + sync + métricas)
- [x] Dashboard com KPIs (Investimento, Receita, ROAS, CPA, Lucro Bruto)
- [x] Sistema de Alertas in-app (ROAS/CPA/spend_no_conversion)
- [x] Zustand + React Query (estado global + cache de dados)
- [x] Sidebar de navegação compartilhada com Framer Motion
- [x] GlobalStatusOverlay (loading/error global)
- [x] Auditoria de UI/UX (audit.md executado — score 9/10)

---

## 🔴 Agora — Completar Feature 1 (Dashboard de Lucro Real)

> Objetivo: usuário vê lucro por campanha com número que bate com o caixa.

- [ ] **Corrigir bug** `data?.metrics?.activeCampaigns` → `data?.campaigns?.length` em DashboardClient
- [ ] **Corrigir bug** filtros Zustand não sincronizam com `initialData.range` no mount
- [ ] **Criar página stub `/criativos`** (placeholder para não quebrar sidebar)
- [ ] **Integração Stripe** — ingestão de pedidos, valor líquido e reembolsos
- [ ] **Motor de atribuição last-click** — vincular pedido à campanha por click_id/utm
- [ ] **Auditoria de Segurança de Rotas** — verificar `getUser()` em todas API routes

**Critério de done:** campo "Lucro Real" no dashboard com valor consistente com Stripe.

---

## 🟡 Próximo — Feature 2: Relatórios Inteligentes

> Objetivo: relatório gerado automaticamente sem ação manual do cliente.

- [ ] Data Aggregation Engine (consolidar spend + receita + ROAS por período)
- [ ] Report Builder com templates e variáveis dinâmicas
- [ ] Scheduler (diário/semanal/mensal) com BullMQ
- [ ] Histórico de relatórios gerados com status (pending/sent/failed)
- [ ] Preview de relatório no dashboard

**Critério de done:** relatório semanal gerado e exibido no dashboard sem trigger manual.

---

## 🟢 Depois — Feature 3: WhatsApp Automation

> Objetivo: relatório entregue no WhatsApp do cliente no horário agendado.

- [ ] Account Manager para conectar números WA Business API
- [ ] Template Engine reaproveitando layouts dos relatórios
- [ ] Worker de disparo com scheduler persistido
- [ ] Retry com backoff exponencial + alerta em falha persistente
- [ ] Histórico de envios por cliente

**Critério de done:** relatório agendado chega no WhatsApp sem falha crítica.

---

## 🔵 Fase Posterior (Backlog — não bloqueia MVP)

- Sistema de tracking próprio (UTMs, click IDs, eventos, deduplicação)
- Modelos first-click e linear com reprocessamento histórico
- Google Ads e TikTok Ads
- RBAC completo (owner / manager / analyst / viewer)
- Shopify e WooCommerce
- App mobile
- IA para previsão de ROAS
- Exportação PDF
- Alertas via Slack

---

## 🧭 Foco Atual

**Feature 1 — bugs críticos + integração Stripe + motor de atribuição.**

---

## 🔬 Research Track (R&D Lead) — Próxima Feature

### Feature alvo pesquisada

**Feature 2: Relatórios Inteligentes** (Data Aggregation + Template Builder + Scheduler + Histórico + Preview).

### Recomendação arquitetural (2026-03-15)

**Decisão recomendada:** implementar Feature 2 com **pipeline assíncrono no `apps/api` (NestJS) usando fila durável**, mantendo o `apps/dashboard` focado em UI/BFF.

**Stack recomendada por fase:**
- Fase 2.1 (agora): **BullMQ no NestJS** (o projeto já usa `@nestjs/bull` + `bull`), com jobs dedicados para `report.generate` e `report.dispatch`.
- Fase 2.2 (upgrade): migrar para **BullMQ Job Schedulers** (`upsertJobScheduler`) para recorrência sem duplicidade operacional.
- Fase 2.3 (alternativa de simplificação): avaliar **Supabase Queues (pgmq)** se quisermos reduzir dependência de Redis no médio prazo.

### Por que esta decisão

- Aproveita infra já presente (Nest + fila), reduz risco de arquitetura paralela.
- Separa execução longa de geração/envio de relatório da camada de request HTTP.
- Facilita idempotência e retries por etapa (gerar, persistir, enviar).
- Mantém coerência com Feature 3 (WhatsApp), que já depende de workers e scheduler.

### Padrões obrigatórios para Feature 2

- **Transactional Outbox** para publicação confiável de eventos internos após persistência no Postgres.
- **Idempotency keys** para jobs e envios (especialmente quando acionados por cron/webhook).
- **Job state machine** clara: `pending -> generating -> completed|failed -> sent|failed`.
- **Tenant isolation** por `org_id` em toda execução e consulta.
- **Observabilidade mínima**: correlation_id por execução + métricas de latência/falha por job.

### Playbook de crescimento (growth-engine aplicado ao plano)

**North Star da Feature 2:** `% de organizações com relatório automático ativo e entregue com sucesso`.

**Métricas de ativação (primeiros 14 dias):**
- `report_template_created_rate`
- `scheduled_report_activation_rate`
- `first_report_time_to_value` (cadastro até primeiro relatório concluído)
- `scheduled_report_success_rate`
- `report_open_or_view_rate` (preview/download)

**Loops de crescimento:**
- Loop de retenção: agendamento semanal + histórico de performance por cliente.
- Loop de expansão: template compartilhável por organização/conta.
- Loop de monetização: limites por plano (quantidade de agendamentos e canais de envio).

### Plano tático (ordem de execução)

- [ ] Definir schema de `report_templates`, `scheduled_reports`, `report_executions`.
- [ ] Criar jobs `report.generate` e `report.dispatch` no `apps/api`.
- [ ] Implementar agregador canônico (mesmas fórmulas do dashboard).
- [ ] Entregar preview no dashboard + histórico com status.
- [ ] Habilitar scheduler recorrente e retries com backoff.
- [ ] Instrumentar métricas de ativação/entrega no produto.

### Riscos e mitigação

- Risco: dupla execução por cron/redeploy.
  Mitigação: idempotency key + lock distribuído por `(org_id, scheduled_report_id, period)`.
- Risco: divergência entre dashboard e relatório.
  Mitigação: centralizar cálculos em serviço único de agregação.
- Risco: timeout em geração dentro de rota HTTP.
  Mitigação: geração sempre em worker assíncrono.

---

## 👥 Squad

| Agente | Responsabilidade | Status |
|---|---|---|
| **Antigravity (Lead)** | Orquestração & Eng. de Software | 🚀 Ativo |
| **Architect** | Padrões, Segurança e ADRs | 🟢 Online |
| **Dev Engine** | Lógica de Aplicação & Dashboard | 🛠️ Trabalhando |
| **Data Engineer** | Pipeline Meta Ads + Atribuição | 🟢 Online |
| **UI/UX Expert** | Design & Componentes | 🟢 Online |
