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

## 👥 Squad

| Agente | Responsabilidade | Status |
|---|---|---|
| **Antigravity (Lead)** | Orquestração & Eng. de Software | 🚀 Ativo |
| **Architect** | Padrões, Segurança e ADRs | 🟢 Online |
| **Dev Engine** | Lógica de Aplicação & Dashboard | 🛠️ Trabalhando |
| **Data Engineer** | Pipeline Meta Ads + Atribuição | 🟢 Online |
| **UI/UX Expert** | Design & Componentes | 🟢 Online |
