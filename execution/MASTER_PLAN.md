# MASTER_PLAN.md — Plano Mestre de Execução Decomposto (Padrão ECC)

> **Estrutura Obrigatória:** FASE → EPIC → TASK → MICRO TASK → NANO TASK.  
> Cada Nano Task contém o schema completo do ECC: Research, Test, Implementation, Review, Security, Verification e Memory Impact.

---

# FASE 01: FUNDAÇÃO, INGESTÃO META ADS E CRM (CONCLUÍDA)

## EPIC-001: Autenticação & Ingestão Meta Ads
* **TASK-001:** Conexão OAuth e Criptografia de Tokens
  * **MICRO-001.01:** Handshake OAuth da Meta
    * **NANO-001.01.01:** `DONE` — Handshake OAuth v21+ em `/api/meta/oauth` e `/api/meta/callback`. [RISK: HIGH]
  * **MICRO-001.02:** Criptografia de Tokens
    * **NANO-001.02.01:** `DONE` — Criptografia simétrica AES-256 via pgcrypto. [RISK: CRITICAL]

## EPIC-002: Isolamento de Dados & Multi-Tenancy
* **TASK-002:** Configuração de RLS e Master Gate
  * **MICRO-002.01:** Políticas de RLS por `organization_id`
    * **NANO-002.01.01:** `DONE` — Script DDL `corrigir_banco.sql` com RLS. [RISK: CRITICAL]
  * **MICRO-002.02:** Autenticação Simplificada do Painel
    * **NANO-002.02.01:** `DONE` — Master Gate `PAINEL_SENHA` no middleware. [RISK: HIGH]

## EPIC-003: Core Dashboard & CRM de Clientes
* **TASK-003:** Visualização de Campanhas e Vínculo de Contas
  * **MICRO-003.01:** Dashboard de Performance
    * **NANO-003.01.01:** `DONE` — KPI Cards (Spend, ROAS, CPA) e gráficos de tendência. [RISK: MEDIUM]
  * **MICRO-003.02:** Gestão de Clientes e Contas
    * **NANO-003.02.01:** `DONE` — Listagem de clientes e busca de contas na Meta Graph API. [RISK: MEDIUM]

## EPIC-004: Inteligência Competitiva (Garimpo)
* **TASK-004:** Esteira de Ofertas e Sinais de Validação
  * **MICRO-004.01:** Extração de Domínios e Cálculo de Longevidade
    * **NANO-004.01.01:** `DONE` — Algoritmo de signals e testes unitários (`npm run test:garimpo`). [RISK: MEDIUM]

---

# FASE 02: LUCRO REAL, ATRIBUIÇÃO E REPORT BUILDER (EM EXECUÇÃO)

## EPIC-005: Ingestão de Pedidos & Atribuição de Lucro Real
* **TASK-005:** Webhook de Pedidos e Motor de Atribuição Last-Click
  * **MICRO-005.01:** Webhook de Vendas Stripe/E-commerce
    * **NANO-005.01.01:**
      * **ID:** `NANO-005.01.01`
      * **TITLE:** Criar Handler de Ingestão de Pedidos Stripe em `/api/webhooks/stripe`
      * **OBJECTIVE:** Receber eventos `payment_intent.succeeded` e `charge.refunded`, validar assinatura criptográfica do Stripe, calcular valor líquido com taxas deduzidas e persistir na tabela `orders`.
      * **SOURCE REQUIREMENT:** `PRD.md §Feature 1` / `REQ-CORE-008`
      * **BUSINESS CONTEXT:** O cálculo do lucro real por campanha exige saber exatamente quanto dinheiro líquido entrou no checkout após descontadas as taxas de cartão/gateway.
      * **TECHNICAL CONTEXT:** Next.js Route Handler que consome o raw body da requisição para validação de HMAC SHA-256 (`stripe-signature`) e grava via Supabase Client com `org_id`.
      * **PRECONDITIONS:** Tabela `orders` criada no schema do banco de dados.
      * **DEPENDENCIES:** Nenhuma.
      * **ALLOWED FILES:**
        - `apps/dashboard/src/app/api/webhooks/stripe/route.ts`
        - `packages/types/src/orders.ts`
        - `packages/types/src/index.ts`
      * **FORBIDDEN FILES:**
        - `apps/dashboard/src/middleware.ts`
        - Qualquer componente visual em `apps/dashboard/src/app/(dashboard)/*`
      * **RESEARCH REQUIRED:** Sim.
      * **RESEARCH QUESTIONS:**
        1. Como o SDK `stripe` no Node.js/Next.js valida assinaturas de webhook sem corromper o raw body?
        2. Quais campos da tabela `orders` em `SCHEMA.md` são obrigatórios?
      * **IMPLEMENTATION ACTION:**
        1. Definir tipos `StripeOrderPayload`, `StripeRefundPayload` em `packages/types/src/orders.ts`.
        2. Criar Route Handler POST `/api/webhooks/stripe` com `stripe.webhooks.constructEvent`.
        3. Calcular `net_amount = amount - fee` e registrar no Supabase.
      * **EXPECTED RESULT:** Webhook responde HTTP 200 OK com payload `{ received: true, order_id: "..." }`.
      * **ACCEPTANCE CRITERIA:**
        - Rejeição com HTTP 400 em caso de assinatura inválida ou ausente.
        - Parsing seguro com Zod.
        - `npm run typecheck` com zero erros em todos os 10 pacotes.
      * **TEST STRATEGY:** Simulação de payload de webhook via script de teste automatizado.
      * **VALIDATION STRATEGY (Levels 1, 2, 3):**
        - Level 1: Teste unitário de parsing de evento Stripe.
        - Level 2: `npm run typecheck`.
        - Level 3: Registro persistido na tabela `orders`.
      * **REVIEW STRATEGY:** Auditoria de segurança contra replay attacks e injeção de payload falso.
      * **SECURITY CONSIDERATIONS:** [RISK: CRITICAL] Nunca processar webhook sem verificar a chave secreta `STRIPE_WEBHOOK_SECRET`.
      * **PERFORMANCE CONSIDERATIONS:** Resposta rápida (<200ms) para evitar timeouts e retries desnecessários do Stripe.
      * **DESIGN CONSIDERATIONS:** TDD / Backend puro (sem impacto de UI).
      * **DOCUMENTATION IMPACT:** Registrar endpoint no `docs/PROJECT_MAP.md`.
      * **MEMORY IMPACT:** Atualizar `state/CHANGELOG.md` e `docs/DECISIONS.md` caso novo padrão de webhook seja adotado.
      * **NEXT TASK:** `NANO-005.02.01`

  * **MICRO-005.02:** Motor de Atribuição Last-Click
    * **NANO-005.02.01:**
      * **ID:** `NANO-005.02.01`
      * **TITLE:** Implementar Motor de Atribuição Last-Click cruzando UTMs e Campanhas
      * **OBJECTIVE:** Comparar parâmetros `utm_campaign`, `utm_content` e `ad_id` do pedido com os dados de `ad_metrics_daily` para gerar o registro de atribuição de venda.
      * **SOURCE REQUIREMENT:** `PRD.md §Feature 1` / `REQ-CORE-009`
      * **BUSINESS CONTEXT:** Permite ao gestor ver exatamente qual criativo e campanha geraram a compra no caixa.
      * **ALLOWED FILES:**
        - `packages/attribution/src/engine.ts`
        - `packages/attribution/src/index.ts`
      * **FORBIDDEN FILES:**
        - Componentes de UI.
      * **RESEARCH REQUIRED:** Sim (verificar regras de janela de conversão de 7 dias pós-clique).
      * **TEST STRATEGY:** Testes unitários de last-click com múltiplos touchpoints.
      * **VALIDATION STRATEGY:** Level 1 (Testes unitários) + Level 2 (`npm run typecheck`).
      * **SECURITY CONSIDERATIONS:** [RISK: HIGH] Validação de tenant (`org_id`).
      * **NEXT TASK:** `NANO-006.01.01`

---

## EPIC-006: Report Builder & Relatórios Dinâmicos
* **TASK-006:** Geração de Relatórios por Cliente e Exportação Pública
  * **MICRO-006.01:** Template Engine de Relatórios
    * **NANO-006.01.01:**
      * **ID:** `NANO-006.01.01`
      * **TITLE:** Conectar Agregador de Métricas ao Gerador de Template de Relatório
      * **OBJECTIVE:** Substituir variáveis dinâmicas (`{{client_name}}`, `{{spend}}`, `{{real_roas}}`, `{{top_campaign}}`) por dados consolidados do cliente.
      * **SOURCE REQUIREMENT:** `PRD.md §Feature 2` / `REQ-CORE-010`
      * **ALLOWED FILES:**
        - `packages/reports/src/engine.ts`
        - `apps/dashboard/src/app/(dashboard)/reports/`
      * **SECURITY CONSIDERATIONS:** [RISK: MEDIUM] Token de compartilhamento público somente-leitura.
      * **NEXT TASK:** `NANO-007.01.01`

---

# FASE 03: WHATSAPP AUTOMATION & SERVER-SIDE TRACKING

## EPIC-007: WhatsApp Evolution API v2
* **TASK-007:** Multi-Instâncias e Scheduler de Mensagens
  * **MICRO-007.01:** Gestão de Instâncias e QR Code
    * **NANO-007.01.01:** `READY` — Leitura de status da instância e QR Code dinâmico. [RISK: MEDIUM]
  * **MICRO-007.02:** Scheduler de Relatórios Matinais
    * **NANO-007.02.01:** `READY` — Invocação periódica de cron para envio matinal via WhatsApp. [RISK: HIGH]

## EPIC-008: Meta Conversions API (CAPI)
* **TASK-008:** Server-Side Event Hashing e Deduplicação
  * **MICRO-008.01:** Envio Server-Side de Purchase e Lead
    * **NANO-008.01.01:** `READY` — Hashing SHA-256 e disparo de evento com `event_id`. [RISK: HIGH]
