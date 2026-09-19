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

### 🥉 Feature 3: WhatsApp Automation & Evolution Pro (terceira entrega)

Distribuição dos relatórios via WhatsApp usando templates da Feature 2 e gestão avançada de instâncias.

**Componentes:**
- Account Manager (conectar/remover números via QR Code ao vivo com polling)
- Scheduler Worker (dispara conforme agendamento armazenado)
- **[NOVO] Proxy Dedicado Anti-Ban:** Suporte a HTTP/HTTPS/SOCKS5 por instância para mitigar bloqueios
- **[NOVO] Simulação de Presença Humana:** Presença "digitando..." / "gravando áudio..." antes dos envios
- **[NOVO] Extração e Disparo em Grupos:** Leitura de participantes e disparo segmentado
- **[NOVO] Rejeição de Chamadas:** Auto-resposta em chamadas não autorizadas
- Retry com backoff + histórico de envios + alertas em falha persistente

**Critério de done:** relatório chega no WhatsApp do cliente no horário agendado sem falha crítica.

---

### 🔮 Feature 4: Meta Conversions API (CAPI) Server-Side (Atribuição & Tracking)

Envio direto de conversões server-side (Purchase, Lead, CompleteRegistration) para o Pixel da Meta Graph API v21+.

**Componentes:**
- Hash SHA-256 de dados do usuário (`em`, `ph`, `fn`, `ln`)
- Matching de cookies de primeiro nível (`_fbc`, `_fbp`, `client_ip`, `user_agent`)
- Deduplicação automática via `event_id` compartilhado entre browser e server
- Test Event Code para homologação no Gerenciador de Eventos da Meta

---

## 🎨 Padrão Visual de Roadmap no Frontend ("Em Breve" & "Futura Atualização")

Para manter o usuário informado sobre a evolução do produto sem frustração, todos os módulos em desenvolvimento ou futuras atualizações devem seguir o padrão canônico:

1. **Badge Visual:** Utilizar `<ComingSoonBadge variant="roadmap" />` ou `<ComingSoonBadge variant="new" />` com micro-ícone `Sparkles` ou `Clock`.
2. **Estilo Glass Desabilitado:** Cards em desenvolvimento devem usar opacidade reduzida (`opacity-65`), borda com gradiente sutil e `cursor-default` com tooltip explicativo.
3. **Copy Transparente:** Exibir breve resumo do benefício da funcionalidade e trimestre/fase prevista.

---

## O que NÃO é escopo do MVP

- Substituir plataformas de compra de mídia (Meta/Google/TikTok)
- Editor avançado de criativos
- App mobile nativo iOS/Android (fase 4)
- Google Ads e TikTok Ads (focar Meta primeiro)
- IA generativa de criativos em vídeo (fase futura)

---

## Sequência de Entrega

```
[AGORA]  Dashboard funcional com Meta Ads + CAPI Server-side
            └─► Integrar Stripe/Shopify → calcular lucro real
                └─► Motor de atribuição last-click
                    └─► [Feature 2] Report Builder & Resumo Executivo Diário
                        └─► [Feature 3] WhatsApp Evolution Pro (Multi-instâncias + Proxy)
```

---

## Arquitetura — Decisões já tomadas

| Camada | Tecnologia | Status |
|---|---|---|
| Frontend | Next.js 16.3+ + React 19 + TypeScript | ✅ Rodando |
| Estilização | Tailwind CSS v4 + Framer Motion | ✅ Rodando |
| Estado global | Zustand + React Query | ✅ Implementado |
| Auth | Supabase Auth (multi-tenant por org_id) | ✅ Rodando |
| DB | Supabase PostgreSQL + RLS | ✅ Rodando |
| API | Next.js App Router + NestJS (apps/api) | ✅ Rodando |
| WhatsApp | Evolution API v2 (Multi-instância / Proxy / Presence) | ✅ Integrado |
| CAPI Meta | Graph API v21+ Server-Side Hashing | ✅ Integrado |
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
| ADR-005 | CAPI Server-Side com SHA-256 e Deduplicação | — |
| ADR-006 | Criptografia de tokens via pgcrypto AES-256 | — |

---

## Modelo de Dados (entidades críticas)

```
organizations → clients → ad_accounts → campaigns → daily_metrics
                       ├─► orders → attributions ←─┘
                       ├─► whatsapp_instances (proxies, presence, settings)
                       └─► marketing_credentials (CAPI tokens, pixels)
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

- [x] Usuário conecta conta Meta Ads via OAuth sem suporte técnico
- [x] Criptografia de tokens AES-256 com isolamento multitenant
- [ ] Usuário conecta fonte de vendas (Stripe ou Shopify)
- [ ] Dashboard mostra lucro por campanha com atribuição rastreável
- [ ] Relatório gerado automaticamente e entregue por WhatsApp
- [x] Multi-tenant: dados isolados por organização (RLS ativo e validado)
- [x] Segurança: secrets fora do código, TLS ativo, endpoints blindados contra replay/IDOR
- [ ] Observabilidade: logs estruturados + alerta de job falho

---

## Backlog — Fase Posterior (não bloqueia MVP)

- [EM BREVE] Relatório Diário com IA no WhatsApp (ROAS matinal automático)
- [EM BREVE] Meta CAPI UI: painel de teste de eventos em tempo real
- [FUTURA ATUALIZAÇÃO] Proxy Manager por instância de WhatsApp
- [FUTURA ATUALIZAÇÃO] Sistema de tracking com UTMs e first-party cookies
- [FUTURA ATUALIZAÇÃO] Modelos de atribuição first-click e linear com reprocessamento
- [FUTURA ATUALIZAÇÃO] Integração Google Ads e TikTok Ads
- [FUTURA ATUALIZAÇÃO] Integração Shopify e WooCommerce
- [FUTURA ATUALIZAÇÃO] App mobile com KPIs e alertas push
- [FUTURA ATUALIZAÇÃO] IA para previsão de ROAS e sugestão de alocação de orçamento
- [FUTURA ATUALIZAÇÃO] Exportação PDF de relatórios
- [FUTURA ATUALIZAÇÃO] Integrações Hotmart, Eduzz, Cakto, Doppus, Asaas

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
| Restrições de privacidade/cookies | Abordagem server-side CAPI + first-party tracking |
| Divergência entre fontes e dashboard | Reconciliador diário + trilhas de auditoria + transparência de fórmula |
| Complexidade prematura de arquitetura | Modular monolith + extração progressiva por gatilhos objetivos |
