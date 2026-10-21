# Plan-Orchestrate Result

**Plan**: `painel-metricas-relatorios.md`
**Lang**: `typescript`
**ECC mode**: `plugin`
**Steps**: 10
**Scope**: all

## Steps overview

| # | Title | Tags | Chain |
|---|---|---|---|
| 1 | Visão geral lê do banco | impl, refactor | `ecc:tdd-guide,ecc:refactor-cleaner,ecc:typescript-reviewer` |
| 2 | Sync guarda conversões por tipo | impl, db | `ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer` |
| 3 | Coletor de métricas dos relatórios | impl | `ecc:tdd-guide,ecc:typescript-reviewer` |
| 4 | Tabelas de relatórios, alertas e leads | impl, db, security | `ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer,ecc:security-reviewer` |
| 5 | API de relatórios | impl, security | `ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer` |
| 6 | Direção visual de Relatórios e Alertas | design | `ecc:planner,ecc:architect` |
| 7 | UI de Relatórios | impl, test | `ecc:tdd-guide,ecc:e2e-runner,ecc:typescript-reviewer` |
| 8 | Geração agendada | impl | `ecc:tdd-guide,ecc:typescript-reviewer` |
| 9 | Alertas com template | impl | `ecc:tdd-guide,ecc:typescript-reviewer` |
| 10 | Verificação | test, build | `ecc:tdd-guide,ecc:e2e-runner,ecc:build-error-resolver` |

---

## Step 1 — Visão geral lê do banco

**Intent**: Trocar a busca ao vivo na Meta feita pelo navegador por leitura do banco renderizada no servidor, igual à Performance.
**Tags**: impl, refactor
**Chain rationale**: `impl` é primária; de `refactor` entra só `refactor-cleaner` para remover o caminho antigo (`architect` cortado para manter o limite e porque a arquitetura já existe em `performance/page.tsx`). `typescript-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:refactor-cleaner,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-1] Na rota / do apps/dashboard, trocar MetaDataGate + /api/meta/dados (Graph API ao vivo no navegador, cache em memória) por getDashboardData de lib/dashboard/queries.ts renderizado no servidor, como em performance/page.tsx; Acceptance: / e /performance mostram o mesmo investimento no mesmo período; abrir / não faz request a graph.facebook.com; npm run typecheck verde"
```

## Step 2 — Sync guarda conversões por tipo

**Intent**: Guardar no banco as ações por tipo que a sincronização já baixa da Meta.
**Tags**: impl, db
**Chain rationale**: Regra impl+db: `database-reviewer` valida a migration no meio, `typescript-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-2] Criar migration em apps/dashboard/supabase/migrations adicionando actions jsonb e action_values jsonb (nulos) em daily_metrics, e fazer /api/cron/meta-sync gravar os arrays actions/action_values que já recebe da Graph API; não aplicar a migration no Supabase; Acceptance: após um sync, actions->>'purchase' preenchido; colunas antigas inalteradas; typecheck verde"
```

## Step 3 — Coletor de métricas dos relatórios

**Intent**: Converter dados do banco e da Insights API em valores indexados pelos slugs do catálogo, corrigindo o ROAS ponderado.
**Tags**: impl
**Chain rationale**: Implementação pura com testes; `typescript-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-3] Criar apps/dashboard/src/lib/reports/engine/metrics.ts que agrega linhas de daily_metrics em Record<slug, number> do catálogo (meta_spend, meta_actions.*, meta_roas...) e busca na Insights só alcance, frequência, vídeo e criativos; ROAS = receita / investimento (corrige o peso pelo tamanho do nome em preview-engine.ts); Acceptance: teste com linhas sintéticas em scripts/reports-engine.test.mjs passa; typecheck verde"
```

## Step 4 — Tabelas de relatórios, alertas e leads

**Intent**: Criar o schema de relatórios, runs, templates, alertas e leads com RLS por organização.
**Tags**: impl, db, security
**Chain rationale**: impl+db (regra 3) com `security` adicionada por causa do RLS multi-tenant; `security-reviewer` fecha porque isolamento entre orgs é o risco principal.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer,ecc:security-reviewer" "[Plan: painel-metricas-relatorios.md#step-4] Criar migration com message_templates, reports, report_parts, report_runs (unique report_id+scheduled_for), lead_webhooks, leads e colunas nulas novas em notification_rules, seguindo docs/PLANO_RELATORIOS_NOTIFICACOES.md §4, com RLS por org_id igual a clients, e atualizar lib/supabase/types.ts; aplicar só com aprovação; Acceptance: outra org não lê linhas; duplicata de run rejeitada; typecheck verde"
```

## Step 5 — API de relatórios

**Intent**: Expor CRUD, preview com dado real e geração manual de relatórios.
**Tags**: impl, security
**Chain rationale**: Regra impl+security: rotas autenticadas por org, `security-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer" "[Plan: painel-metricas-relatorios.md#step-5] Criar rotas em apps/dashboard/src/app/api/reports/** para CRUD de reports/report_parts, preview com renderTemplate em modo live e 'gerar agora' que grava um report_run, validando com Zod e isolando por org_id; Acceptance: curl cria relatório; preview devolve { text, missing }; gerar agora cria um report_run; Out of scope: envio por WhatsApp"
```

## Step 6 — Direção visual de Relatórios e Alertas

**Intent**: Desenhar as telas de Relatórios e Alertas no tema ADZ nos três tamanhos, antes do código.
**Tags**: design
**Chain rationale**: Passo de design: `planner,architect`. O trabalho visual em si é feito com os skills brand-discovery, frontend-design-direction e frontend-design, fora do `/orchestrate` (o catálogo não tem agente de design visual).

```bash
/ecc:orchestrate custom "ecc:planner,ecc:architect" "[Plan: painel-metricas-relatorios.md#step-6] Definir estrutura e componentes das telas Relatórios (lista, editor em tela cheia, histórico) e Alertas (regras, feed) no tema ADZ de design/README.md, em 1440/834/390, reutilizando src/components/ui e MetaUi; Acceptance: mockups HTML em design/ para as 2 telas nos 3 tamanhos; cada um passa nas regras do README (travessão para ausência, tabular-nums, alvo de 44px)"
```

## Step 7 — UI de Relatórios

**Intent**: Implementar a tela de relatórios fiel aos mockups.
**Tags**: impl, test
**Chain rationale**: `e2e-runner` cobre o fluxo criar → pré-visualizar → gerar; regra 10 exige revisor no fim, então `typescript-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-7] Reescrever app/(dashboard)/reports com editor em tela cheia (/ para inserir variável do catálogo), partes ilimitadas, preview e histórico de report_runs com copiar texto, fiel aos mockups de design/ da etapa 6, consumindo a API da etapa 5; Acceptance: criar, pré-visualizar e gerar relatório no navegador em 1440, 834 e 390; typecheck verde"
```

## Step 8 — Geração agendada

**Intent**: Gerar relatórios no horário agendado, sem duplicar.
**Tags**: impl
**Chain rationale**: Implementação com teste de concorrência; `typescript-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-8] Criar app/api/cron/reports-dispatch que busca reports ativos com next_run_at vencido, insere report_run antes de qualquer trabalho (unique report_id+scheduled_for), renderiza em modo live e recalcula next_run_at no fuso do relatório; registrar o cron em vercel.json; Acceptance: duas chamadas simultâneas geram um único run; Out of scope: envio por WhatsApp"
```

## Step 9 — Alertas com template

**Intent**: Alertas passam a usar texto de template com valores reais e ganham condições novas.
**Tags**: impl
**Chain rationale**: Implementação; `typescript-reviewer` fecha.

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-9] Em apps/dashboard/src/lib/alerts, fazer o avaliador renderizar template_body (padrão ALERT_PRESETS de lib/reports/engine/presets.ts) com current_value/target_value formatados e suportar balance_below, ctr_below e api_error além de roas, cpa e spend_no_conversion; Acceptance: regra de CPA dispara com o texto do template e valores reais; typecheck verde"
```

## Step 10 — Verificação

**Intent**: Validar tipos, testes, build e comportamento no navegador com DevTools.
**Tags**: test, build
**Chain rationale**: Passo de verificação, fechado pelos próprios validadores (`e2e-runner` e `build-error-resolver`), sem revisor extra (regra 10).

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner,ecc:build-error-resolver" "[Plan: painel-metricas-relatorios.md#step-10] Rodar npm run typecheck, npm run test:reports e npm run build; no Chrome DevTools abrir /, /performance e /reports: console sem erro, nenhuma request a graph.facebook.com em /, LCP de / medido antes e depois; Acceptance: tudo verde; números de antes/depois registrados em painel-metricas-relatorios.md"
```

---

## Batch execution

```bash
/ecc:orchestrate custom "ecc:tdd-guide,ecc:refactor-cleaner,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-1] Na rota / do apps/dashboard, trocar MetaDataGate + /api/meta/dados (Graph API ao vivo no navegador, cache em memória) por getDashboardData de lib/dashboard/queries.ts renderizado no servidor, como em performance/page.tsx; Acceptance: / e /performance mostram o mesmo investimento no mesmo período; abrir / não faz request a graph.facebook.com; npm run typecheck verde"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-2] Criar migration em apps/dashboard/supabase/migrations adicionando actions jsonb e action_values jsonb (nulos) em daily_metrics, e fazer /api/cron/meta-sync gravar os arrays actions/action_values que já recebe da Graph API; não aplicar a migration no Supabase; Acceptance: após um sync, actions->>'purchase' preenchido; colunas antigas inalteradas; typecheck verde"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-3] Criar apps/dashboard/src/lib/reports/engine/metrics.ts que agrega linhas de daily_metrics em Record<slug, number> do catálogo (meta_spend, meta_actions.*, meta_roas...) e busca na Insights só alcance, frequência, vídeo e criativos; ROAS = receita / investimento (corrige o peso pelo tamanho do nome em preview-engine.ts); Acceptance: teste com linhas sintéticas em scripts/reports-engine.test.mjs passa; typecheck verde"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:database-reviewer,ecc:typescript-reviewer,ecc:security-reviewer" "[Plan: painel-metricas-relatorios.md#step-4] Criar migration com message_templates, reports, report_parts, report_runs (unique report_id+scheduled_for), lead_webhooks, leads e colunas nulas novas em notification_rules, seguindo docs/PLANO_RELATORIOS_NOTIFICACOES.md §4, com RLS por org_id igual a clients, e atualizar lib/supabase/types.ts; aplicar só com aprovação; Acceptance: outra org não lê linhas; duplicata de run rejeitada; typecheck verde"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer,ecc:security-reviewer" "[Plan: painel-metricas-relatorios.md#step-5] Criar rotas em apps/dashboard/src/app/api/reports/** para CRUD de reports/report_parts, preview com renderTemplate em modo live e 'gerar agora' que grava um report_run, validando com Zod e isolando por org_id; Acceptance: curl cria relatório; preview devolve { text, missing }; gerar agora cria um report_run; Out of scope: envio por WhatsApp"
/ecc:orchestrate custom "ecc:planner,ecc:architect" "[Plan: painel-metricas-relatorios.md#step-6] Definir estrutura e componentes das telas Relatórios (lista, editor em tela cheia, histórico) e Alertas (regras, feed) no tema ADZ de design/README.md, em 1440/834/390, reutilizando src/components/ui e MetaUi; Acceptance: mockups HTML em design/ para as 2 telas nos 3 tamanhos; cada um passa nas regras do README (travessão para ausência, tabular-nums, alvo de 44px)"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-7] Reescrever app/(dashboard)/reports com editor em tela cheia (/ para inserir variável do catálogo), partes ilimitadas, preview e histórico de report_runs com copiar texto, fiel aos mockups de design/ da etapa 6, consumindo a API da etapa 5; Acceptance: criar, pré-visualizar e gerar relatório no navegador em 1440, 834 e 390; typecheck verde"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-8] Criar app/api/cron/reports-dispatch que busca reports ativos com next_run_at vencido, insere report_run antes de qualquer trabalho (unique report_id+scheduled_for), renderiza em modo live e recalcula next_run_at no fuso do relatório; registrar o cron em vercel.json; Acceptance: duas chamadas simultâneas geram um único run; Out of scope: envio por WhatsApp"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:typescript-reviewer" "[Plan: painel-metricas-relatorios.md#step-9] Em apps/dashboard/src/lib/alerts, fazer o avaliador renderizar template_body (padrão ALERT_PRESETS de lib/reports/engine/presets.ts) com current_value/target_value formatados e suportar balance_below, ctr_below e api_error além de roas, cpa e spend_no_conversion; Acceptance: regra de CPA dispara com o texto do template e valores reais; typecheck verde"
/ecc:orchestrate custom "ecc:tdd-guide,ecc:e2e-runner,ecc:build-error-resolver" "[Plan: painel-metricas-relatorios.md#step-10] Rodar npm run typecheck, npm run test:reports e npm run build; no Chrome DevTools abrir /, /performance e /reports: console sem erro, nenhuma request a graph.facebook.com em /, LCP de / medido antes e depois; Acceptance: tudo verde; números de antes/depois registrados em painel-metricas-relatorios.md"
```
