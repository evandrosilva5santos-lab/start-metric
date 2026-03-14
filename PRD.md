# PRD — Start Metric (Versão Consolidada)

> **Fonte única de verdade.** Consolidado a partir de: PRD.md (original), prd-saas-tracking-gestao-campanhas.md, plano-execucao-mvp-tracking-saas.md e task-01-scaffold-monorepo.md.
> Os demais arquivos são histórico — não editar.

---

## Missão

Permitir que gestores de tráfego, e-commerces e agências identifiquem **quais campanhas geram lucro real**, não apenas métricas de plataforma.

**Problema central:** ferramentas atuais fragmentam dados entre plataformas de mídia e e-commerce, gerando atribuição inconsistente, ROAS inflado e ausência de lucro líquido por campanha.

---

## Personas

| Persona | Job-to-be-done | Dor principal |
|---|---|---|
| **Gestor de Tráfego** | Saber quais campanhas escalar com segurança | Discrepância de pixel, excesso de planilhas |
| **Dono de E-commerce** | Proteger margem entendendo custo real por venda | Foco em ROAS bruto sem considerar custos reais |
| **Agência** | Gerenciar múltiplos clientes com velocidade de diagnóstico | Operação manual, relatórios lentos |

---

## Princípio de Pareto — As 3 features que entregam 80% do valor

### 🥇 Feature 1: Dashboard de Performance (CORE — entregar primeiro)

Visão de ROAS, CPA, gasto e **lucro real** por campanha, com dados do Meta Ads.

**Estado atual:** ~70% pronto (dashboard existe, sync Meta funcionando, alertas implementados).

**O que falta para completar:**
- [ ] Integração de fonte de vendas (Stripe ou Shopify) para calcular lucro real
- [ ] Motor de atribuição last-click operacional
- [ ] Isolamento multi-tenant por cliente (filtros por organização)

**Critério de done:** usuário vê lucro por campanha com número que bate com o caixa.

---

### 🥈 Feature 2: Relatórios Inteligentes (segunda entrega)

Report Builder que gera documentos dinâmicos exportáveis com templates reutilizáveis.

**Componentes mínimos:**
- Data Aggregation Engine (spend, conversões, ROAS, métricas sociais)
- Templates com variáveis (`{{client_name}}`, `{{spend}}`, `{{top_campaign}}`)
- Scheduler (frequência: diário, semanal, mensal)
- Histórico e status de envios

**Critério de done:** relatório gerado automaticamente e visualizado pelo cliente sem ação manual.

---

### 🥉 Feature 3: WhatsApp Automation (terceira entrega)

Distribuição dos relatórios via WhatsApp usando templates da Feature 2.

**Componentes:**
- Account Manager (conectar/remover números WA Business API)
- Scheduler Worker (dispara conforme agendamento armazenado)
- Retry com backoff + histórico de envios + alertas em falha persistente

**Critério de done:** relatório chega no WhatsApp do cliente no horário agendado sem falha crítica.

---

## O que NÃO é escopo do MVP

- Substituir plataformas de compra de mídia (Meta/Google/TikTok)
- Editor avançado de criativos
- App mobile (fase 4)
- Google Ads e TikTok Ads (focar Meta primeiro)
- IA para sugestões de orçamento (fase avançada)
- Sistema de tracking próprio com UTMs/click IDs (fase 2)

---

## Sequência de Entrega

```
[AGORA]  Dashboard funcional com Meta Ads
            └─► Integrar Stripe/Shopify → calcular lucro real
                └─► Motor de atribuição last-click
                    └─► [Feature 2] Report Builder
                        └─► [Feature 3] WhatsApp Automation
```

---

## Arquitetura — Decisões já tomadas

| Camada | Tecnologia | Status |
|---|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript | ✅ Rodando |
| Estilização | Tailwind CSS v4 + Framer Motion | ✅ Rodando |
| Estado global | Zustand + React Query | ✅ Implementado |
| Auth | Supabase Auth (multi-tenant por org_id) | ✅ Rodando |
| DB | Supabase PostgreSQL + RLS | ✅ Rodando |
| API | NestJS (apps/api) | 🔧 Em desenvolvimento |
| Filas | BullMQ + Redis | 🔧 Em desenvolvimento |
| Meta Ads | Graph API v21+ com OAuth | ✅ Integrado |
| Alertas | Avaliador in-app (ROAS/CPA/spend) | ✅ Implementado |

### ADRs ativos

| ADR | Decisão | Revisitar quando |
|---|---|---|
| ADR-001 | Modular monolith com NestJS | Equipe > 10 devs ou escala independente por domínio |
| ADR-002 | PostgreSQL como banco primário | Volume exigir OLAP dedicado |
| ADR-003 | Motor de atribuição desacoplado da ingestão | — |
| ADR-004 | Multi-tenant lógico com RLS por org_id | — |

---

## Modelo de Dados (entidades críticas)

```
organizations → clients → ad_accounts → campaigns → daily_metrics
                       └─► orders → attributions ←─┘
tracking_sessions → events → attributions
```

**Fórmulas canônicas — calculadas no backend, nunca no frontend:**

```
ROAS          = revenue_attributed / ad_spend
CPA           = ad_spend / attributed_conversions
Lucro Bruto   = revenue_attributed - ad_spend
Lucro Líquido = lucro_bruto - fees - refunds
ROI           = lucro_líquido / ad_spend
```

Todas as métricas consideram timezone configurável por cliente.

---

## Checklist de Done do MVP

- [ ] Usuário conecta conta Meta Ads via OAuth sem suporte técnico
- [ ] Usuário conecta fonte de vendas (Stripe ou Shopify)
- [ ] Dashboard mostra lucro por campanha com atribuição rastreável
- [ ] Relatório gerado automaticamente e entregue por WhatsApp
- [ ] Multi-tenant: dados isolados por organização (RLS ativo e validado)
- [ ] Segurança: secrets fora do código, TLS ativo, endpoint de exclusão de dados
- [ ] Observabilidade: logs estruturados + alerta de job falho

---

## Backlog — Fase Posterior (não bloqueia MVP)

- Sistema de tracking próprio (UTMs, click IDs, endpoint de eventos, deduplicação)
- Modelos de atribuição first-click e linear com reprocessamento histórico
- Integração Google Ads e TikTok Ads
- Integração Shopify e WooCommerce
- RBAC completo (owner / manager / analyst / viewer)
- App mobile com KPIs e alertas push
- IA para previsão de ROAS e sugestão de alocação de orçamento
- Exportação PDF de relatórios
- Integrações Hotmart, Eduzz, outros marketplaces

---

## KPIs de Sucesso

| Categoria | KPI |
|---|---|
| Negócio | MRR, churn mensal, NPS |
| Uso | Clientes com ≥1 integração ativa; tempo até primeiro insight útil |
| Qualidade de dados | Taxa de vendas atribuídas; divergência fonte×dashboard < 2%; latência de atualização |

---

## Riscos

| Risco | Mitigação |
|---|---|
| Mudanças de API do Meta | Camadas de integração isoladas + monitoramento de versões |
| Restrições de privacidade/cookies | Abordagem server-side + first-party tracking |
| Divergência entre fontes e dashboard | Reconciliador diário + trilhas de auditoria + transparência de fórmula |
| Complexidade prematura de arquitetura | Modular monolith + extração progressiva por gatilhos objetivos |
