# Plano — Relatórios e Notificações (porte do Metrifiquei)

> Detalhamento das Fases 1, 3 e 5 do [PRD_UNIFICACAO.md](./PRD_UNIFICACAO.md).
> Base: leitura do código-fonte dos dois projetos e do schema real do Supabase (16/10/2026).
> **Fora de escopo por decisão do usuário (16/10/2026): envio por WhatsApp.** O plano deixa o ponto de entrega pronto para plugar depois.

---

## 1. Diagnóstico

### 1.1 O banco real não bate com a documentação

O `SCHEMA.md` descreve tabelas `startmetric_*` que **não existem**. O banco real (schema `public`) tem:

| Tabela real | Colunas relevantes |
|---|---|
| `clients` | org_id, name, email, phone, whatsapp, niche, logo_url, archived_at |
| `ad_accounts` | org_id, client_id, external_id, platform, name, currency, timezone, token_encrypted, status |
| `campaigns` | org_id, ad_account_id, meta_id, name, status, objective |
| `daily_metrics` | org_id, campaign_id, date, spend, impressions, clicks, conversions, revenue_attributed, roas, cpa |
| `notification_rules` | org_id, campaign_id, metric, operator, threshold, channel, active |
| `alerts` | org_id, rule_id, campaign_id, metric, observed_value, title, message, status |

Tabelas que o código usa mas **não existem**: `report_templates`, `scheduled_reports`, `report_executions`, `whatsapp_instances`. As rotas `/api/reports/templates/*` e `/api/whatsapp/instances` falham hoje.

**Convenção adotada:** seguir o banco real (`org_id`, sem prefixo). O script `scripts/migrate_to_startmetric_tables.sql` não foi aplicado e fica fora deste plano.

### 1.2 O banco guarda poucas métricas

`daily_metrics` tem 7 números por campanha/dia. O catálogo do Metrifiquei tem **167 variáveis** (não 559 como dizia o PRD; corrigido lá). A maioria não está no banco:

| Disponível no banco | Só via Meta Insights API |
|---|---|
| investimento, impressões, cliques, conversões, receita atribuída, ROAS, CPA (+ CTR/CPC/CPM calculados) | alcance, frequência, `actions.*`, `action_values.*`, `cost_per_action_type.*`, vídeo, rankings de criativos |

### 1.3 O que existe de cada lado

| Peça | Start Metric | Metrifiquei |
|---|---|---|
| Motor de templates | 2 cópias quase iguais (`lib/reports/preview-engine.ts` e `packages/reports`), 16 variáveis, bug no ROAS ponderado | `render.ts` + catálogo de 167 variáveis + formatação pt-BR |
| Presets | 1 resumo diário fixo | 13 de relatório, 4 de alerta, 2 de lead |
| Editor de relatório | não existe | modal tela cheia, `/` para inserir variável, preview estilo WhatsApp |
| Agendamento | código sem tabela | schema com idempotência (`report_runs`) |
| Alertas | motor rodando (ROAS, CPA, gasto sem conversão), aviso no navegador, texto fixo | só UI, sem motor |
| Leads | não existe | só UI |

`packages/reports` não é importado por nenhum app; é código órfão.

### 1.4 Defeitos do motor do Metrifiquei a corrigir no porte

1. **Mostra dado falso como real.** Variável sem dado cai no valor de exemplo do catálogo (`R$ 1.624,30`) e ranking vazio vira ranking fictício. Aceitável no preview, inaceitável num relatório gerado.
2. Datas de fallback fixas (`20/09/2026`) e link de dashboard fixo no domínio do Metrifiquei.
3. Saudação e hora no fuso do servidor (Vercel = UTC): "Bom dia" às 9h vira "Boa tarde".
4. `yesterday` e `previous_month` estão no catálogo, mas o motor não os resolve.
5. Presets de alerta escrevem `R$ {{target_value}},00`, o que gera `R$ R$ 100,00,00`.
6. Presets de lead usam `lead_name`, `lead_phone`… que não estão no catálogo.
7. Preset de Instagram usa variáveis que não existem em lugar nenhum.

---

## 2. Decisões

| # | Decisão | Motivo |
|---|---|---|
| D1 | Motor fica em `apps/dashboard/src/lib/reports/engine/` | Todos os consumidores (rotas, cron, editor) estão no dashboard; nenhum app importa `packages/reports` |
| D2 | Dois modos de renderização: `preview` (usa exemplo) e `live` (sem dado → `—` + lista de faltantes) | Corrige o defeito 1 |
| D3 | Métricas vêm da **Meta Insights API na hora da geração**; o banco é fallback | Única forma de preencher alcance, ações e vídeo para o período exato |
| D4 | Agendamento vira colunas de `reports` (não tabelas 1:1) | Metrifiquei tinha tabelas sempre 1:1 que só adicionavam joins |
| D5 | Google e Instagram ficam no catálogo, sem preset ativo até existir integração | Start Metric só integra Meta |
| D6 | Alertas e leads reaproveitam o mesmo motor de templates | Uma engine para tudo |
| D7 | **Sem WhatsApp por enquanto.** Relatório gerado fica no histórico com "copiar texto"; alertas e leads aparecem no painel | Pedido do usuário. A entrega é uma função `deliver(run)` isolada, onde o WhatsApp entra depois |

---

## 3. Fluxo

```
 Editor (UI) ──► reports + report_parts (template com {{slug}})
                         │
 cron /api/cron/reports-dispatch (a cada 5 min)
                         │  reports ativos com next_run_at <= agora
                         ▼
             INSERT report_runs (report_id, scheduled_for)  ◄── UNIQUE: disparo repetido falha → pula
                         │
             para cada parte: Meta Insights (período da parte) → métricas por slug
                         │
             renderTemplate(body, ctx, mode="live") → texto + variáveis faltantes
                         │
             run.status = generated  (texto salvo, visível no histórico)
                         │
             deliver(run)  ← hoje: nada; depois: WhatsApp / e-mail
                         │
             reports.next_run_at = próximo horário (fuso do relatório)
```

---

## 4. Schema novo

```sql
-- Templates reutilizáveis (org_id NULL = template do sistema)
message_templates (
  id uuid pk, org_id uuid null → organizations,
  context text check (context in ('report','alert','lead')),
  objective text null, channel text null,
  name text not null, body text not null,
  created_at, updated_at
)

reports (
  id uuid pk, org_id uuid → organizations, client_id uuid → clients,
  name text, status text check (status in ('active','paused','draft')) default 'draft',
  frequency text check (frequency in ('daily','weekly','monthly')),
  send_time time default '08:00', weekday smallint null, month_day smallint null,
  timezone text default 'America/Sao_Paulo',
  next_run_at timestamptz null,
  created_at, updated_at
  -- colunas de entrega (canal, destino) entram quando o WhatsApp entrar
)

report_parts (
  id uuid pk, report_id uuid → reports on delete cascade,
  position int, ad_account_id uuid null → ad_accounts,
  period text check (period in ('yesterday','last_7d','last_30d','this_month','last_month','custom')),
  custom_start date null, custom_end date null,
  body text not null, send_without_data boolean default false,
  unique (report_id, position)
)

report_runs (
  id uuid pk, org_id uuid, report_id uuid → reports on delete cascade,
  scheduled_for timestamptz not null,
  status text check (status in ('queued','generated','delivered','failed','skipped')),
  rendered_body text, missing_variables text[] default '{}',
  error_message text null, started_at, finished_at, created_at,
  unique (report_id, scheduled_for)       -- idempotência
)

-- Alertas: evoluir notification_rules (só colunas novas e nulas)
alter table notification_rules
  add client_id uuid null, add ad_account_id uuid null, add template_body text null;
-- metric passa a aceitar: balance_below, ctr_below, api_error

lead_webhooks (id, org_id, client_id, name, token uuid unique, provider, template_body, active, created_at)
leads (id, org_id, client_id, webhook_id, name, phone, email, source, campaign, payload jsonb, rendered_message text, read_at, created_at)
```

Todas com RLS por `org_id` (mesmo padrão de `clients`).

---

## 5. Nano tasks

Uma por vez, com `npm run typecheck` verde ao final de cada uma.

| ID | Entrega | Arquivos | Pronto quando |
|---|---|---|---|
| **R1** | Motor: catálogo, render preview/live, presets corrigidos | `lib/reports/engine/{types,catalog,render,presets}.ts`, `scripts/reports-engine.test.mjs` | Testes passam; modo live nunca mostra valor de exemplo |
| **R2** | Coletor de métricas: Meta Insights → `Record<slug, number>`; fallback em `daily_metrics`; corrige ROAS ponderado | `lib/reports/engine/metrics.ts`, `packages/meta-api/src/client.ts` | Preview com conta real mostra alcance e compras do período |
| **R3** | Migration das tabelas da §4 + tipos Supabase | `supabase/migrations/…_reports_notifications.sql`, `lib/supabase/types.ts` | **Aplicar só com aprovação** (banco compartilhado) |
| **R4** | API CRUD de relatórios + preview com dado real + "gerar agora" | `app/api/reports/**` | Cria, edita, pré-visualiza e gera um run |
| **R5** | UI: editor tela cheia, seletor de variáveis, preview, histórico com "copiar" | `components/reports/**`, `app/(dashboard)/reports/**` | Fluxo completo no navegador |
| **R6** | Geração agendada com idempotência | `app/api/cron/reports-dispatch/route.ts`, `vercel.json` | Dois crons simultâneos geram um run só |
| **N1** | Alertas com template editável + novas condições (saldo, CTR, erro de conta) | `lib/alerts/**`, `components/alerts/**` | Alerta usa o texto do template, com valores reais |
| **N2** | Webhook de leads + notificação no painel | `app/api/leads/[token]/route.ts`, página de leads | POST de formulário cria lead e notificação |
| **C1** | Limpeza: remover `preview-engine.ts`, `packages/reports`, rotas de `report_templates` | — | Typecheck e build verdes |
| *W1 (depois)* | *Entrega via WhatsApp (Evolution API), criar `whatsapp_instances`* | — | *Quando o usuário liberar* |

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Migration no Supabase compartilhado com o Metrifiquei | Só cria tabelas novas e adiciona colunas nulas; nada é removido; aplicar com aprovação |
| Rate limit da Meta API em gerações simultâneas | Uma chamada por parte, por conta; gerações espalhadas pelo cron |
| Geração duplicada | `unique (report_id, scheduled_for)` antes de qualquer trabalho |
| Token Meta expirado na geração | Run vira `failed` com erro legível |
| Protocolo do projeto: a nano task autorizada em `CURRENT_TASK.md` é a NANO-005.02.01 (atribuição) | Este trabalho foi pedido diretamente pelo usuário; a atribuição continua pendente |
