# TASK_QUEUE.md — Fila de Execução de Tarefas

> **Regra de Estado:** Uma Nano Task só pode estar em exatamente um dos estados abaixo. É proibida a duplicidade de estado.

---

## 🟢 DONE (Concluídas e Validadas)
- [x] `NANO-001.01.01` — Handshake OAuth Meta Ads Graph API v21+
- [x] `NANO-001.02.01` — Criptografia de Tokens AES-256
- [x] `NANO-002.01.01` — Script DDL e Políticas RLS por `organization_id`
- [x] `NANO-002.02.01` — Master Gate de Autenticação PAINEL_SENHA no middleware
- [x] `NANO-003.01.01` — Core Performance Dashboard com KPI Cards e Gráficos
- [x] `NANO-003.02.01` — CRM de Clientes e Busca de Contas de Anúncio
- [x] `NANO-004.01.01` — Algoritmo de Sinais do Garimpo e Testes Unitários
- [x] `NANO-005.01.01` — Handler de Ingestão de Pedidos Stripe em `/api/webhooks/stripe`
- [x] `NANO-009.00.01` — Canonização documental do Design System Metrifiquei Teal
- [x] `NANO-009.00.02` — Baseline reproduzível e lint zero
- [x] `NANO-009.01.01` — Dependências e configuração shadcn
- [x] `NANO-009.01.02` — Tokens, fontes e tema
- [x] `NANO-009.02.01` — Primitivos UI
- [x] `NANO-009.02.02` — Componentes compartilhados e estados
- [x] `NANO-010.01.01` — Elegibilidade server-side e endpoints Meta operacionais
- [x] `NANO-010.02.01` — Hierarquia Cliente → Plataforma → Conta e persistência válida
- [x] `NANO-010.03.01` — Aplicar elegibilidade em Relatórios e Alertas
- [x] `NANO-010.04.01` — Vínculo, reatribuição, desvinculação e arquivamento seguro

---

## 🟡 READY (Autorizadas para Próxima Execução)
- [ ] `NANO-010.05.01` — Testes integrados e Chrome QA

---

## ⚪ IN_PROGRESS (Em Execução pelo Agente Autorizado)
- [ ] `NANO-010.05.01` — Testes integrados e Chrome QA

---

## 🔵 VALIDATION (Em Fase de Auditoria e Teste)
*(Nenhuma no momento)*

---

## 🔴 BLOCKED (Aguardando Dependência ou Decisão)
- [ ] `NANO-005.02.01` — Motor Last-Click adiado pelo proprietário em 17/10/2026; não cancelado
- [ ] `NANO-006.01.01` — Agregador de Métricas do Report Builder (Depende de `NANO-005.02.01`)
- [ ] `NANO-007.01.01` — Gestão de Instâncias Evolution API (Depende de `NANO-006.01.01`)
- [ ] `NANO-007.02.01` — Scheduler de Disparos WhatsApp (Depende de `NANO-007.01.01`)
- [ ] `NANO-008.01.01` — Server-Side CAPI Hashing & Deduplicação (Depende de `NANO-005.02.01`)

---

## 🟦 EPIC-009 — Migração Metrifiquei Teal (sequencial)

1. [x] `NANO-009.00.01` — Contrato visual canônico
2. [x] `NANO-009.00.02` — Baseline e lint
3. [x] `NANO-009.01.01` — Dependências e configuração shadcn
4. [x] `NANO-009.01.02` — Tokens, fontes e tema
5. [x] `NANO-009.02.01` — Primitivos UI
6. [x] `NANO-009.02.02` — Componentes compartilhados e estados
7. [ ] `NANO-009.03.01` — AppShell e Sidebar
8. [ ] `NANO-009.03.02` — Topbar, tema e navegação mobile
9. [ ] `NANO-009.04.01` — Combobox pesquisável para cliente/conta
10. [ ] `NANO-009.04.02` — Dashboard, KPIs, gráficos e tabelas
11. [ ] `NANO-009.05.01` — Clientes
12. [ ] `NANO-009.05.02` — Cliente 360° e drawers
13. [ ] `NANO-009.06.01` — Performance e Campanhas
14. [ ] `NANO-009.06.02` — Criativos, Horário e Diagnóstico
15. [ ] `NANO-009.07.01` — Relatórios: lista e histórico
16. [ ] `NANO-009.07.02` — Relatórios: editor e drawer
17. [ ] `NANO-009.08.01` — Alertas e triagem
18. [ ] `NANO-009.09.01` — Garimpo
19. [ ] `NANO-009.09.02` — Integrações e Configurações
20. [ ] `NANO-009.09.03` — Auth, Admin e superfícies compartilhadas
21. [ ] `NANO-009.10.01` — Limpeza do legado com zero consumidores
22. [ ] `NANO-009.10.02` — Validação final, documentação e handoff

---

## 🟪 EPIC-010 — Autorização canônica de contas

1. [x] `NANO-010.00.01` — PRD, arquitetura, regras e ADR
2. [x] `NANO-010.01.01` — Resolvedor de elegibilidade e proteção dos endpoints Meta
3. [x] `NANO-010.02.01` — Hierarquia Cliente → Plataforma → Conta e persistência válida
4. [x] `NANO-010.03.01` — Aplicar elegibilidade em Relatórios e Alertas
5. [x] `NANO-010.04.01` — Vínculo, reatribuição, desvinculação e arquivamento seguro
6. [ ] `NANO-010.05.01` — Testes integrados e Chrome QA
