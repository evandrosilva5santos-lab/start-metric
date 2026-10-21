# INITIAL_AUDIT.md — Snapshot Histórico da Auditoria

**Data:** 28/09/2026  
**Agente Auditor:** Antigravity (Advanced Agentic Architecture Engine)  
**Projeto:** Start Metric (Monorepo SaaS de Inteligência de ROI e Atribuição de Tráfego Pago)  
**Estado Geral Inicial:** `PARTIALLY_IMPLEMENTED` (~70% do Core Dashboard funcional, integrações avançadas em andamento)

---

## 1. Contexto & Identidade do Projeto

O **Start Metric** é uma plataforma SaaS para gestores de tráfego, agências e e-commerces calcularem o **lucro líquido real por campanha**, combinando dados de compra de mídia (Meta Ads Graph API v21+), dados de vendas (Stripe/Shopify/Webhooks) e motor de atribuição last-click / CAPI server-side.

---

## 2. Stack Tecnológica Auditada

| Camada | Tecnologia | Estado Real Auditado |
|---|---|---|
| **Monorepo** | Turborepo 2.8+ / npm workspaces | Funcional (`apps/*`, `packages/*`) |
| **Frontend Principal** | Next.js 16.3.5 (App Router, React 19, TypeScript) | Rodando em `apps/dashboard`, build validado (47 rotas) |
| **Backend de Suporte** | NestJS 11 + Prisma + Bull Queues | Configurado em `apps/api` |
| **Banco de Dados** | PostgreSQL (Supabase) + RLS | Schemas criados, scripts de migração disponíveis |
| **Autenticação** | Supabase Auth + PAINEL_SENHA Master Gate | Integrado em middleware e sessões |
| **Estilização & UI** | Tailwind CSS v4 + Radix UI + Framer Motion | Design system Dark Obsidian & Emerald Glow |
| **Integrações** | Meta Ads Graph API v21+, Evolution WhatsApp API | Módulos implementados em `packages/meta-api` e `packages/whatsapp` |

---

## 3. Inventário de Módulos e Pacotes

```text
packages/
├── types/          -> [IMPLEMENTED] Tipos TypeScript compartilhados (Meta, Dashboard, Clientes, ROI)
├── db/             -> [IMPLEMENTED] Prisma Client & Schemas de persistência
├── supabase/       -> [IMPLEMENTED] SSR Client & Helper de queries autenticadas
├── meta-api/       -> [IMPLEMENTED] Client Graph API v21+, OAuth, Sync de contas e campanhas
├── attribution/    -> [PARTIALLY_IMPLEMENTED] Parser de UTMs, hashing SHA-256 e motor CAPI
├── reports/        -> [PARTIALLY_IMPLEMENTED] Data aggregation engine & templates
├── whatsapp/       -> [IMPLEMENTED] Conector Evolution API v2, proxies e instâncias
└── utils/          -> [IMPLEMENTED] Formatadores de moeda (BRL/USD), datas e cálculos matemáticos

apps/
├── dashboard/      -> [IMPLEMENTED] Painel SPA com 47 rotas ativas (Performance, Clientes, Garimpo, Tracking, Settings)
└── api/            -> [PARTIALLY_IMPLEMENTED] Endpoints NestJS, processamento de filas e background jobs
```

---

## 4. Auditoria de Funcionalidades vs. Requisitos do PRD

| Requisito do PRD | Estado no Código | Classificação | Evidência / Arquivo |
|---|---|---|---|
| Conexão OAuth Meta Ads | Implementado | `FACT` / `IMPLEMENTED` | `apps/dashboard/src/app/api/meta/` |
| Multi-tenant lógico via RLS | Implementado | `FACT` / `IMPLEMENTED` | `SCHEMA.md` e `corrigir_banco.sql` |
| Autenticação Master (PAINEL_SENHA) | Implementado | `FACT` / `IMPLEMENTED` | `apps/dashboard/src/lib/auth/painel.ts` |
| Dashboard de Performance (ROAS/Gasto) | Implementado | `FACT` / `IMPLEMENTED` | `apps/dashboard/src/app/(dashboard)/performance/` |
| Gestão de Clientes & Vínculo de Contas | Implementado | `FACT` / `IMPLEMENTED` | `apps/dashboard/src/app/(dashboard)/clients/` |
| Garimpo & Esteira de Ofertas | Implementado | `FACT` / `IMPLEMENTED` | `apps/dashboard/src/app/(dashboard)/garimpo/` |
| Hub de Tracking e Auditoria de UTMs | Implementado | `FACT` / `IMPLEMENTED` | `apps/dashboard/src/app/(dashboard)/tracking/` |
| Integração de Vendas Stripe/Shopify | Parcial / Mock | `CONFLICT` / `PARTIALLY_IMPLEMENTED` | Necessita persistência real de pedidos para cálculo de lucro líquido |
| Atribuição Last-Click com Caixa Real | Parcial | `REQUIREMENT` / `PARTIALLY_IMPLEMENTED` | Fórmulas prontas, necessita fluxo contínuo de webhook de pedidos |
| Envio Automático de Relatórios WhatsApp | Parcial | `REQUIREMENT` / `PARTIALLY_IMPLEMENTED` | UI e Evolution API prontas, scheduler em background necessita ativação contínua |

---

## 5. Riscos & Conflitos Identificados

1. **Dependência de Banco de Dados Remoto:** Se as tabelas `clients`, `dashboard_metrics_rollup` ou RLS não forem aplicadas no Supabase de produção, chamadas à API podem retornar erro 500/404. Mitigação: script canônico `corrigir_banco.sql` documentado.
2. **Ambiente Multi-Pacote:** O monorepo possui pacotes interdependentes (`@start-metric/*`). Builds devem respeitar a ordem topológica definida no Turborepo.
3. **Cache de Compilação em Disco:** Caches corrompidos em `.next` podem travar builds com Turbopack. A regra de limpeza preventiva (`rm -rf apps/dashboard/.next`) está registrada nas regras de execução.

---

## 6. Veredito do Initial Audit

O projeto possui base arquitetural sólida, tipagem 100% livre de erros e rotas de frontend e backend bem estabelecidas. Está apto para a estruturação do **Master Plan determinístico** e execução das micro/nano tasks subsequentes.
