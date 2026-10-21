# PROJECT_MAP.md — Mapa Físico e Lógico do Start Metric

> **Objetivo:** Permitir que qualquer agente ou desenvolvedor localize instantaneamente qualquer módulo, arquivo crítico, componente, API ou banco de dados no repositório.

---

## 1. Identidade & Estrutura Geral

* **Repositório Oficial:** `https://github.com/evandrosilva5santos-lab/start-metric.git`
* **Tipo:** Monorepo gerenciado com **Turborepo** + **npm workspaces**
* **Workspaces:** `apps/*`, `packages/*`

---

## 2. Árvore de Diretórios

```text
/
├── apps/
│   ├── dashboard/                  -> Aplicação Web Next.js 16.3+ (App Router)
│   │   ├── src/
│   │   │   ├── app/                -> 47 rotas do App Router
│   │   │   │   ├── (dashboard)/    -> Rotas protegidas principais (performance, clients, campaigns, etc.)
│   │   │   │   ├── admin/          -> Painel administrativo e governança
│   │   │   │   ├── api/            -> Route Handlers (meta, clients, alerts, tracking, cron, webhooks)
│   │   │   │   ├── auth/           -> Fluxo de autenticação, login e callback
│   │   │   │   └── shared/         -> Visualização de relatórios públicos por token
│   │   │   ├── components/         -> Componentes UI, Layouts, Modais e Widgets
│   │   │   ├── hooks/              -> Hooks React e React Query
│   │   │   └── lib/                -> Utilitários de servidor, auth, meta client e database
│   │   └── supabase/               -> Migrations e scripts SQL canônicos
│   └── api/                        -> Backend NestJS 11 (Modular Monolith)
│       └── src/                    -> Módulos NestJS (Auth, Metrics, Webhooks, BullMQ)
│
├── packages/
│   ├── types/                      -> [@start-metric/types] Definições TypeScript
│   ├── db/                         -> [@start-metric/db] Prisma ORM Client
│   ├── supabase/                   -> [@start-metric/supabase] Cliente Supabase SSR/Admin
│   ├── meta-api/                   -> [@start-metric/meta-api] Cliente Meta Graph API v21+
│   ├── attribution/                -> [@start-metric/attribution] Atribuição Last-Click e UTMs
│   ├── reports/                    -> [@start-metric/reports] Agregação e Templates de Relatórios
│   ├── whatsapp/                   -> [@start-metric/whatsapp] Evolution API v2 & Proxies
│   └── utils/                      -> [@start-metric/utils] Formatadores e Helpers de cálculo
│
├── docs/                           -> Documentação Canônica e Contratos
├── execution/                      -> Master Plan, Task Queue e Regras de Execução
├── state/                          -> Status, Changelog, Blockers e Handoff
└── reports/                        -> Relatórios de Auditoria e Validação
```

---

## 3. Arquivos Críticos & Pontos de Atenção

| Caminho do Arquivo | Função / Responsabilidade |
|---|---|
| [`PRD.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/PRD.md) | Fonte Única de Verdade de Requisitos de Produto |
| [`DESIGN.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/DESIGN.md) | Contrato de Design System, Tokens e Viewports |
| [`SCHEMA.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/SCHEMA.md) | Modelo DDL PostgreSQL, RLS e Índices |
| [`apps/dashboard/src/middleware.ts`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/apps/dashboard/src/middleware.ts) | Guardião de Rotas, Sessões e Redirecionamento |
| [`apps/dashboard/src/lib/auth/painel.ts`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/apps/dashboard/src/lib/auth/painel.ts) | Master Gate de Autenticação por Senha |
| [`apps/dashboard/supabase/scripts/corrigir_banco.sql`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/apps/dashboard/supabase/scripts/corrigir_banco.sql) | Script DDL Idempotente para Sincronização do Supabase |
| [`package.json`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/package.json) | Configuração raiz do monorepo e scripts Turborepo |
