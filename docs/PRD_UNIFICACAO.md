# PRD — Unificacao Start Metric + Metrifiquei

> **Objetivo:** Unificar os projetos Start Metric (TRAFEGO PAGO) e Metrifiquei em um unico painel SaaS de gestao completa para agencias de trafego pago.

---

## 1. Contexto

### Situacao Atual

Existem dois projetos separados que compartilham o mesmo Supabase (project ID: `etjqbqorawnnvdlmztka`), porem em schemas diferentes:

| | Start Metric (TRAFEGO PAGO) | Metrifiquei |
|---|---|---|
| **Localizacao** | `/Volumes/Vol Macbook/App/TRAFEGO PAGO` | `/Users/evandro/Downloads/Projeto Metrifiquei` |
| **Maturidade** | Producao (~648 arquivos) | Scaffold/inicial (~54 arquivos) |
| **Estrutura** | Monorepo Turborepo (3 apps, 7 packages) | App unico Next.js |
| **DB Schema** | `public` (tabelas `startmetric_*`) | `metrifiquei` (zero tabelas criadas) |
| **Auth** | Supabase Auth + RLS + Painel | Nenhum |
| **Billing** | Stripe integrado | Nenhum |
| **Integracoes** | Meta API, WhatsApp Evolution, CAPI | Nenhuma ativa |

### Por que unificar?

O usuario precisa de **um painel unico** que centralize: ads, clientes, relatorios, tarefas, e gestao total da empresa. Manter dois projetos separados gera duplicacao, inconsistencia e esforco dobrado.

### Decisao

**Migrar o Metrifiquei para dentro do monorepo Start Metric.** Razoes:

1. Start Metric tem 12x mais codigo funcional
2. Infraestrutura completa ja pronta (auth, billing, Meta API, WhatsApp, monorepo)
3. Metrifiquei e essencialmente um schema + UI scaffold + engine de variaveis/templates
4. O monorepo ja suporta multiplos apps e packages

---

## 2. Visao do Produto Unificado

### Missao

Ser o **painel unico** para gestores de trafego e agencias, onde gerenciam:
- Performance de campanhas (Meta Ads, Google Ads)
- Clientes e equipes (CRM multi-tenant)
- Relatorios automatizados com 167 variaveis dinamicas
- Alertas inteligentes de metricas e saldo
- Tracking e atribuicao de conversoes
- Leads e notificacoes em tempo real
- Disparos automaticos via WhatsApp e Email
- Billing e planos (Stripe)
- Gestao de tarefas e operacoes da agencia

### Personas

| Persona | Necessidade | O que ganha com a unificacao |
|---|---|---|
| **Gestor de Trafego** | Saber quais campanhas escalar | Dashboard + relatorios automaticos + alertas |
| **Dono de Agencia** | Gerir equipe, clientes e operacao | CRM + squads + tarefas + billing |
| **Dono de E-commerce** | Entender lucro real por campanha | Attribution + tracking + CAPI |

---

## 3. Ativos a Migrar do Metrifiquei

### 3.1 Ativos de ALTO VALOR (migrar integralmente)

| Ativo | Descricao | Destino no Monorepo |
|---|---|---|
| **Catalogo de Variaveis** | 167 variaveis dinamicas geradas por action_type | `packages/reports/src/variables/` |
| **Engine de Renderizacao** | `render.ts` — resolve variaveis em templates com formatadores BRL/%, rankings | `packages/reports/src/engine/` |
| **Presets de Templates** | 13 report + 4 alert + 2 lead notification templates | `packages/reports/src/templates/` |
| **Prisma Schema** | 20 models multi-tenant bem projetados (Organization, Membership, Squad, Report, ReportPart, ReportSchedule, ReportRun com idempotencia) | `packages/db/prisma/` |
| **Report Editor UI** | Full-screen modal com split-screen, preview WhatsApp, variable chips, formatacao | `apps/dashboard/src/components/reports/` |

### 3.2 Ativos de MEDIO VALOR (adaptar e integrar)

| Ativo | Descricao | Acao |
|---|---|---|
| **EntityDrawer** | Componente drawer reutilizavel para CRUD | Integrar se nao existir equivalente |
| **FilterBar** | Barra de filtros componentizada | Avaliar vs componentes existentes |
| **StatusPill / PlanBadge** | Componentes UI utilitarios | Integrar se nao duplicar |
| **API Routes (Clients/Reports)** | CRUD com fallback JSON | Adaptar para usar Supabase Auth |

### 3.3 Ativos a DESCARTAR (ja existem no Start Metric)

| Ativo | Razao |
|---|---|
| AppShell / Sidebar / Layout | Start Metric ja tem layout completo |
| shadcn/ui components (button, card, etc.) | Ja existem no Start Metric |
| Auth placeholder | Start Metric tem Supabase Auth real |
| WhatsApp UI scaffold | Start Metric tem Evolution API integrada |
| Mock data / hardcoded demos | Serao substituidos por dados reais |

---

## 4. Schema Unificado

### Estrategia de Banco de Dados

> **Correcao (16/10/2026):** as tabelas `startmetric_*` descritas abaixo e no `SCHEMA.md` nao existem no banco real. O banco usa nomes sem prefixo e `org_id` (`clients`, `daily_metrics`, `notification_rules`...). O schema efetivo de relatorios e notificacoes esta em [PLANO_RELATORIOS_NOTIFICACOES.md](./PLANO_RELATORIOS_NOTIFICACOES.md) §4, e o motor fica em `apps/dashboard/src/lib/reports/engine/` (nao em `packages/reports`, que nenhum app importa).

**Decisao original:** Usar o schema `public` existente do Start Metric, incorporando os modelos do Metrifiquei com prefixo `startmetric_`.

### Modelos a Adicionar (novos)

```
startmetric_squads           -- Equipes dentro de uma organizacao
startmetric_memberships      -- Relacao User<->Org com roles (OWNER/ADMIN/MEMBER)
startmetric_client_contacts  -- Contatos de cada cliente
startmetric_integrations     -- Conexoes OAuth genericas (META/GOOGLE/INSTAGRAM/WEBHOOK)
startmetric_whatsapp_connections -- Sessoes WhatsApp (substitui modelo atual mais simples)
startmetric_message_templates -- Templates de mensagem (SYSTEM/USER, REPORT/ALERT/NOTIFICATION)
startmetric_reports          -- Relatorios configurados (evolucao do modelo existente)
startmetric_report_parts     -- Partes do relatorio (sem limite artificial)
startmetric_report_deliveries -- Config de entrega (WhatsApp/Email/Both)
startmetric_report_schedules -- Agendamento (DAILY/WEEKLY/MONTHLY)
startmetric_report_runs      -- Historico de execucao com idempotencia
startmetric_lead_webhooks    -- Webhooks de captura de leads
```

### Modelos existentes a evoluir

```
organizations        -- Adicionar campos: slug
startmetric_clients  -- Adicionar campos: logoUrl, bannerUrl, city, state, segment, product, sortOrder
startmetric_ad_accounts -- Adicionar: currency, accountType, balance, dailyBudget
```

---

## 5. Plano de Execucao

### Fase 0: Preparacao (1-2 dias)

| # | Tarefa | Risco |
|---|---|---|
| 0.1 | Criar branch `feat/unificacao-metrifiquei` | Nenhum |
| 0.2 | Backup completo do banco Supabase | Nenhum |
| 0.3 | Documentar estado atual de ambos os projetos | Nenhum |

### Fase 1: Migrar Packages — Engine de Reports (2-3 dias)

| # | Tarefa | Detalhes |
|---|---|---|
| 1.1 | Migrar catalogo de variaveis | Copiar `catalog.ts` para `packages/reports/src/variables/` |
| 1.2 | Migrar engine de renderizacao | Copiar `render.ts` para `packages/reports/src/engine/` |
| 1.3 | Migrar presets de templates | Copiar presets para `packages/reports/src/templates/` |
| 1.4 | Adaptar imports e tipos | Ajustar para usar `@start-metric/types` |
| 1.5 | Testes unitarios | Validar que render engine funciona com dados do Meta API |

### Fase 2: Evoluir Schema do Banco (2-3 dias)

| # | Tarefa | Detalhes |
|---|---|---|
| 2.1 | Criar migration SQL para novos modelos | Squads, Memberships, ClientContacts, etc. |
| 2.2 | Evoluir modelos existentes | ALTER TABLE para novos campos em clients, ad_accounts |
| 2.3 | Criar RLS policies para novas tabelas | Seguir padrao existente por org_id |
| 2.4 | Atualizar Prisma schema em `packages/db` | Sincronizar com SQL migrations |
| 2.5 | Testar com `npm run typecheck` | Garantir tipos corretos |

### Fase 3: Migrar UI de Relatorios (3-4 dias)

| # | Tarefa | Detalhes |
|---|---|---|
| 3.1 | Copiar Report Editor (full-screen modal) | Adaptar para layout existente |
| 3.2 | Copiar TemplateEditor com variable chips | Integrar com catalogo migrado |
| 3.3 | Copiar VariableSelectorModal | Conectar com dados reais do Meta API |
| 3.4 | Copiar WhatsApp preview component | Integrar com Evolution API existente |
| 3.5 | Criar rotas de API para Reports CRUD | Usar Supabase Auth (nao JSON fallback) |
| 3.6 | Substituir pagina /reports existente | Nova UI com editor completo |

### Fase 4: Novas Features Multi-tenant (2-3 dias)

| # | Tarefa | Detalhes |
|---|---|---|
| 4.1 | Implementar Squads (equipes) | CRUD + UI + atribuicao de clientes |
| 4.2 | Implementar Memberships | Convites, roles, permissoes |
| 4.3 | Implementar ClientContacts | Contatos por cliente |
| 4.4 | Implementar LeadWebhooks | Endpoints de captura de leads |

### Fase 5: Sistema de Agendamento e Disparo (3-4 dias)

| # | Tarefa | Detalhes |
|---|---|---|
| 5.1 | Implementar ReportSchedule | Configuracao de frequencia e horario |
| 5.2 | Implementar ReportRun com idempotencia | Historico de execucao, controle de duplicidade |
| 5.3 | Cron job para disparos automaticos | Integrar com WhatsApp Evolution API |
| 5.4 | Delivery multi-canal | WhatsApp + Email + Webhook |

### Fase 6: Integracao e Testes (2-3 dias)

| # | Tarefa | Detalhes |
|---|---|---|
| 6.1 | Testes end-to-end do fluxo completo | Criar report -> agendar -> disparar -> historico |
| 6.2 | Validar RLS em todas as novas tabelas | Testar isolamento multi-tenant |
| 6.3 | Validar typecheck e build | `npm run typecheck && npm run build` |
| 6.4 | Remover codigo morto | Limpar imports e componentes nao utilizados |

---

## 6. Estimativa Total

| Fase | Duracao | Prioridade |
|---|---|---|
| Fase 0: Preparacao | 1-2 dias | CRITICA |
| Fase 1: Migrar Packages | 2-3 dias | CRITICA |
| Fase 2: Evoluir Schema | 2-3 dias | CRITICA |
| Fase 3: Migrar UI Relatorios | 3-4 dias | ALTA |
| Fase 4: Multi-tenant Features | 2-3 dias | ALTA |
| Fase 5: Agendamento e Disparo | 3-4 dias | MEDIA |
| Fase 6: Integracao e Testes | 2-3 dias | ALTA |
| **TOTAL** | **15-22 dias** | |

---

## 7. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|---|---|---|
| Conflito de tabelas no schema `public` | ALTO | Manter prefixo `startmetric_`, migrations incrementais |
| Quebra de funcionalidades existentes | ALTO | Branch separada, testes antes de merge |
| Incompatibilidade de tipos entre projetos | MEDIO | Centralizar em `packages/types` |
| Duplicacao de componentes UI | BAIXO | Audit antes de copiar, preferir existentes |
| Performance com 167 variaveis | BAIXO | Lazy loading do catalogo, cache |

---

## 8. Criterios de Sucesso

- [ ] Painel unico acessivel em uma URL
- [ ] Todos os clientes existentes preservados
- [ ] Report Builder com 167 variaveis funcionando com dados reais do Meta
- [ ] Agendamento e disparo automatico de relatorios via WhatsApp
- [ ] Multi-tenant com squads, memberships e roles
- [ ] Zero regressoes nas features existentes (dashboard, garimpo, tracking, alertas)
- [ ] `npm run typecheck` e `npm run build` passando
- [ ] Schema Metrifiquei no Supabase pode ser removido (zero dependencias)

---

## 9. O Que NAO Faz Parte Desta Unificacao

- Google Ads integration (futuro)
- AI analysis layer (futuro)
- Gestao de tarefas/projetos da agencia (futuro, apos unificacao)
- App mobile
- Migrar dados do schema `metrifiquei` (nao existem dados — schema tem zero tabelas)

---

## 10. Arquivos de Referencia

### Start Metric (TRAFEGO PAGO)
| Arquivo | Conteudo |
|---|---|
| `PRD.md` | PRD original |
| `SCHEMA.md` | Schema atual do banco |
| `docs/ARCHITECTURE.md` | Arquitetura do monorepo |

### Metrifiquei (fonte dos ativos)
| Arquivo | Conteudo |
|---|---|
| `PRD.md` | PRD do Metrifiquei |
| `PRD_METRIFIQUEI_V2_UNIFICADO.md` | PRD V2 com correcoes |
| `metrifiquei-app/prisma/schema.prisma` | Schema Prisma (20 models) |
| `metrifiquei-app/src/lib/variables/catalog.ts` | Catalogo de 167 variaveis |
| `metrifiquei-app/src/lib/engine/render.ts` | Engine de renderizacao |
| `metrifiquei-app/src/lib/templates/presets.ts` | Presets de templates |
