# Start Metric — Roadmap Estratégico

**Versão:** 1.0
**Data:** 2026-03-17
**Status:** Em Construção (Sprint 4+)

---

## VISÃO EXECUTIVA

**Start Metric** é uma plataforma SaaS de gestão inteligente de tráfego pago para agências digitais e consultores de marketing.

**Diferencial competitivo:**
- ✅ Relatórios **automáticos e personalizáveis** por cliente
- ✅ **Multi-tenant avançado** — segmentação por cliente, não apenas por conta
- ✅ **Dashboard analítico por cliente** — não mistura dados totais
- ✅ **Painel Admin separado** — gestão de usuários, pagamentos, planos
- ✅ **Automação de insights** — análise comparativa de períodos, alertas inteligentes
- ✅ **Integração WhatsApp** — entrega de relatórios via chat

**Modelo de negócio:** SaaS por assinatura com diferentes planos por volume de clientes/contas.

---

## 1. ARQUITETURA DE PRODUTO

### 1.1 Três Camadas de Interface

```
┌─────────────────────────────────────────────────────────┐
│  PAINEL ADMIN                                           │
│  (Gestão de usuários, pagamentos, planos, analytics)   │
│  Acesso: admin@startinc.com.br (role: admin)           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  DASHBOARD GESTOR (User Dashboard)                      │
│  - Listar clientes (grid com cards)                     │
│  - Filtrar por cliente/período                          │
│  - Gerenciar relatórios e integrações WhatsApp          │
│  - Analytics por cliente (nunca totalizadas)            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  PAINEL CLIENTE (Future: Client Portal)                 │
│  - Relatórios automáticos                               │
│  - Métricas e KPIs do seu negócio                       │
│  - (Fase 2)                                             │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Modelo de Dados Multi-Tenant

```sql
organizations
├── profiles (usuários da org)
├── clients (clientes finais do gestor)
│   ├── whatsapp_instances (conexão WhatsApp por cliente)
│   ├── report_templates (modelos de relatório por cliente)
│   ├── reports_sent (histórico de relatórios)
│   └── time_saved (log de automação)
├── ad_accounts (contas de anúncio)
│   ├── client_id FK → clients (qual cliente gerencia essa conta)
│   └── daily_metrics (dados de performance)
└── niches (categorias de negócio)
    └── client_niches (cliente pode ter um nicho pré-definido ou custom)
```

**Isolamento:** Todas as queries filtram por `org_id` e `client_id` quando aplicável.

---

## 2. PAINEL DE USUÁRIOS (User Dashboard)

### 2.1 Página `/clients` — Gestão de Clientes

**O que faz:**
- Lista todos os clientes da org em grid (3 colunas desktop, 1 mobile)
- Card por cliente mostra:
  - Avatar + nome da empresa
  - CNPJ, telefone, email
  - Nicho/segmento
  - Badge: "X contas vinculadas"
  - Badge: "X relatórios enviados"
  - Badge: "Xh poupar (tempo automação)"

**Ações no card:**
- **Ver Dashboard** → `/dashboard?client_id=xxx` (filtra todas as métricas por esse cliente)
- **Editar** → Modal com: nome, CNPJ, empresa, telefone, email, nicho
- **Arquivar** → Soft delete com `archived_at`
- **Relatórios** → Modal lista todos os relatórios enviados com datas

**Estado vazio:**
- Ícone Building2 grande
- Título: "Nenhum cliente gerenciado ainda"
- Botão: "+ Adicionar primeiro cliente"

**Botão flutuante/header:**
- "+ Novo cliente" (opens modal)

### 2.2 Modal "Novo Cliente"

**Campos:**
- Nome da empresa* (obrigatório)
- CNPJ* (format: 00.000.000/0000-00)
- Telefone (format: +55 11 99999-9999)
- Email (para enviar relatórios)
- Nicho* (select ou criar novo)
  - Opção 1: Selecionar nicho existente (dropdown)
  - Opção 2: "Criar novo nicho" (input text)
- Ad Accounts a vincular (multi-select com checkboxes)
  - Lista todas as contas Meta não vinculadas
  - Pode selecionar várias

**Validação (Zod):**
```typescript
CreateClientSchema = z.object({
  company_name: z.string().min(2).max(100),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
  phone: z.string().optional(),
  email: z.string().email(),
  niche_id: z.string().uuid().or(z.literal("create_new")),
  niche_name: z.string().optional(), // Se criar novo nicho
  account_ids: z.array(z.string().uuid()).optional(),
});
```

### 2.3 Página `/clients/[id]` — Detalhe do Cliente

**Layout:**
```
┌─ Header ──────────────────────────────────────┐
│ [Empresa] — CNPJ | Tel | Email                 │
│ Nicho: [segmento]                             │
│ Botões: Editar | Arquivar | Ver Dashboard     │
└───────────────────────────────────────────────┘

┌─ Abas ────────────────────────────────────────┐
│ Visão Geral | Contas | Relatórios | Timeline  │
└───────────────────────────────────────────────┘

┌─ TAB: Visão Geral ─────────────────────────────┐
│ • Contas vinculadas: X
│ • Tempo economizado: XXh XXmin
│ • Relatórios enviados: X (últimos 30 dias)
│ • Status WhatsApp: [conectado/desconectado]
│ • Última atualização: [data/hora]
└───────────────────────────────────────────────┘

┌─ TAB: Contas ──────────────────────────────────┐
│ Lista de ad_accounts com:
│ • Nome da conta
│ • Spend (últimos 30 dias)
│ • ROAS
│ • Status
│ Botão: "+ Vincular conta"
└───────────────────────────────────────────────┘

┌─ TAB: Relatórios ──────────────────────────────┐
│ Histórico de relatórios enviados:
│ • Data/hora
│ • Template utilizado
│ • Status (enviado/falhou)
│ • Via (Email/WhatsApp)
│ Botão: "+ Enviar relatório agora"
└───────────────────────────────────────────────┘

┌─ TAB: Timeline ────────────────────────────────┐
│ Log de eventos do cliente:
│ • [data] Contas vinculadas/desvinculadas
│ • [data] Relatórios enviados
│ • [data] Configurações alteradas
│ • [data] WhatsApp conectado/desconectado
└───────────────────────────────────────────────┘
```

---

## 3. DASHBOARD ANALÍTICO (Segmentado por Cliente)

### 3.1 Filtros Principais

**Antes:** Dashboard mostrava TUDO (confuso para gestor com múltiplos clientes)

**Depois:** Dashboard filtra por cliente selecionado

```
┌─ Filtros ─────────────────────────────────────┐
│ Cliente: [Dropdown: Todos | Cliente A | ...]   │ ← NOVO
│ Período: [Últimos 7 dias / 30 / 90 dias / Custom]
│ Nicho: [Todos | Nicho 1 | Nicho 2 | ...]      │ ← NOVO
│ Status: [Ativo | Pausado | Desativado]
│ Objetivo: [Todas | Tráfego | Leads | Vendas]
│                                                 │
│ [Sincronizar] [Salvar filtros]                │
└───────────────────────────────────────────────┘
```

### 3.2 KPIs Exibidos (Por Cliente)

Quando cliente selecionado:
- **Spend Total:** R$ XXX.XXX
- **Impressões:** XX.XXX.XXX
- **Cliques:** XXX.XXX
- **CTR:** X.XX%
- **CPC:** R$ X.XX
- **Conversões:** XXX
- **Conversão Rate:** X.XX%
- **Revenue:** R$ XXX.XXX (se integrado)
- **ROAS:** X.XX

**Comparativo período anterior:**
- Setas ↑/↓ com % de variação
- Verde (melhoria) / Vermelho (queda)

### 3.3 Insights Automáticos

**Sistema de alertas inteligente:**

```
🔔 ALERTAS POR CLIENTE
├─ "Spend aumentou 40% em relação à semana anterior"
├─ "CTR caiu abaixo da média histórica deste cliente"
├─ "ROAS melhorou! Recomendação: aumentar orçamento"
├─ "Campanha X teve 0 conversões esta semana"
└─ "Comparado ao cliente Y (mesmo nicho), spend é 30% maior com ROAS 20% inferior"
```

**Comparativos por nicho:**
- "Clientes no nicho E-commerce têm ROAS médio de X.XX"
- "Seu cliente está [acima/abaixo] da média"

### 3.4 Tabela de Campanhas

Por cliente selecionado:
- Nome da campanha
- Status (ativa/pausada)
- Spend
- Conversões
- ROAS
- Ações: pausar, editar, relatório

---

## 4. PAINEL ADMIN (Nova Interface)

**Acesso:** `evandro@startinc.com.br` (ou `admin` role)

**Rota:** `/admin` (já existe)

**O que gerencia:**

### 4.1 Usuários & Organizações

```
┌─ Aba: Usuários ────────────────────────────┐
│ Tabela com:
│ • Email | Nome | Org | Role | Status
│ • Data de cadastro | Último acesso
│ • Plano atual | Limite de clientes
│
│ Ações:
│ • Editar: mudar role, plano, ativar/desativar
│ • Ver: histórico de atividades
│ • Deletar: arquivar usuário
│
│ Filtros:
│ • Status: [Ativo | Inativo | Suspenso]
│ • Plano: [Grátis | Pro | Enterprise]
│ • Org: [Todas | Org 1 | Org 2]
└────────────────────────────────────────────┘
```

### 4.2 Planos & Assinatura

```
┌─ Aba: Planos ──────────────────────────────┐
│ Tabela com:
│ • Org | Plano | Status | Data Início | Data Vencimento
│ • MRR | Ciclo de faturamento
│ • Limite: clientes / contas / relatórios
│
│ Ações:
│ • Upgrade/Downgrade: manual para teste
│ • Estender trial
│ • Aplicar desconto/cupom
│ • Ver fatura/invoice
│
│ Gráficos:
│ • MRR por plano
│ • Churn rate
│ • Growth MRR (MoM)
└────────────────────────────────────────────┘
```

### 4.3 Pagamentos & Faturamento

```
┌─ Aba: Pagamentos ─────────────────────────┐
│ Tabela com:
│ • Data | Org | Valor | Método (Stripe)
│ • Status: [Pago | Pendente | Falhou | Refundado]
│ • Invoice / Recibo
│
│ Ações:
│ • Reprocessar pagamento falho
│ • Emitir crédito/desconto
│ • Gerar relatório fiscal
│
│ Métricas:
│ • Receita total (ARR/MRR)
│ • Taxa de sucesso de pagamento
│ • Chargeback/disputa rate
└────────────────────────────────────────────┘
```

### 4.4 Analytics Admin

```
┌─ Aba: Analytics ───────────────────────────┐
│ Métricas globais:
│ • Total de usuários/orgs
│ • Total de clientes gerenciados (todos)
│ • Volume de relatórios enviados (todos)
│ • % de sincronizações bem-sucedidas
│ • Uptime/performance de APIs
│
│ Gráficos:
│ • MRR growth
│ • User acquisition (DAU/MAU)
│ • Churn by plan
│ • Feature adoption (% usando relatórios, WhatsApp, etc)
│ • Support tickets by issue type
└────────────────────────────────────────────┘
```

### 4.5 Suporte & Logs

```
┌─ Aba: Logs ────────────────────────────────┐
│ Ver histórico de atividades:
│ • Usuário X fez login
│ • Sincronização da Meta falhou (motivo)
│ • Relatório enviado para cliente Y (WhatsApp)
│ • Erro: query timeout em /api/analytics
│ • Usuário X mudou de plano Pro → Enterprise
│
│ Filtros:
│ • Por tipo de evento
│ • Por usuário/org
│ • Por data range
│ • Por nível de severidade (INFO/WARN/ERROR)
└────────────────────────────────────────────┘
```

---

## 5. MODELO DE NEGÓCIO

### 5.1 Planos de Assinatura

| Plano | Preço | Clientes | Contas Meta | Relatórios/mês | Integrações |
|-------|-------|----------|------------|----------------|------------|
| **Starter** | R$ 299/mês | 3 | 5 | 10 | Email |
| **Professional** | R$ 799/mês | 15 | 25 | 50 | Email + WhatsApp |
| **Enterprise** | Custom | Ilimitado | Ilimitado | Ilimitado | Tudo + API |

### 5.2 Modelo de Conversão

```
Funil de Aquisição:
1. Landing page (product-led)
2. Trial gratuito 14 dias (Plano Starter)
3. Conversão em dia 8-10 (onboarding + primeira métrica)
4. Retention (relatórios automáticos)
5. Expansão (upgrade para Pro com 10+ clientes)
6. Enterprise (vendas consultivas para agências 50+)

Target CAC Payback: < 12 meses
Target LTV:CAC > 3:1
```

### 5.3 Métricas Chave

| Métrica | Target | Descrição |
|---------|--------|-----------|
| **MRR** | R$ 30K (ano 1) | Receita recorrente mensal |
| **CAC** | R$ 800 | Custo para adquirir um customer |
| **LTV** | R$ 2.400 (3 anos) | Lifetime value do customer |
| **Churn** | < 5%/mês | Taxa de cancelamento |
| **NDR** | > 105% | Net Dollar Retention (expansão) |
| **NPS** | > 50 | Net Promoter Score |

---

## 6. ROADMAP TÉCNICO (Sprint 4 em diante)

### Sprint 4: WhatsApp Avançado ✅ (Em progresso)
- [ ] Migração de banco: `whatsapp_instances` com `client_id`
- [ ] Panel WhatsApp Connection na página `/clients/[id]`
- [ ] Envio de relatórios via WhatsApp (webhook)
- [ ] Histórico de mensagens por cliente

### Sprint 5: Relatórios Automáticos 🔴 (Planejado)
- [ ] Página `/reports` — listar templates
- [ ] Editor de template drag-and-drop
- [ ] Agendamento de envio (diário/semanal/mensal)
- [ ] Geração automática em PDF
- [ ] Histórico de relatórios enviados

### Sprint 6: Painel Admin Completo 🔴 (Planejado)
- [ ] `/admin/users` — gestão de usuários
- [ ] `/admin/plans` — gestão de planos
- [ ] `/admin/payments` — pagamentos e faturamento
- [ ] `/admin/analytics` — métricas globais
- [ ] `/admin/logs` — auditoria de atividades

### Sprint 7: Automação Inteligente 🔴 (Planejado)
- [ ] Sistema de alertas (acima/abaixo de threshold)
- [ ] Comparativos por nicho
- [ ] Insights recomendativos
- [ ] Reports automáticos baseados em anomalias

### Sprint 8: Portal Cliente 🔴 (Fase 2)
- [ ] `/client-portal` — acesso só-leitura para cliente final
- [ ] Relatórios compartilhados com senha/token
- [ ] Marca branca (logo, cores)
- [ ] Notificações em tempo real

---

## 7. DIFERENCIADORES COMPETITIVOS

| Diferencial | Concorrência | Start Metric |
|-------------|-------------|-------------|
| **Segmentação** | Por conta Meta | **Por cliente do gestor** |
| **Relatórios** | Manuais/templates genéricos | **Automáticos + personalizados** |
| **Entrega** | Email genérico | **WhatsApp + Email + PDF** |
| **Análise** | Dashboards isolados | **Comparativos por nicho** |
| **Admin** | Nenhum | **Painel completo de gestão** |
| **Automação** | Sync de dados | **Insights + alertas inteligentes** |
| **Integração** | Meta/Google Ads | **WhatsApp + CRM (roadmap)** |

---

## 8. QUESTÕES ESTRATÉGICAS RESPONDIDAS

### "Por que não totalizar dados no dashboard?"
❌ **Problema:** Um gestor com 20 clientes vê um dashboard gigante que mistura tudo
✅ **Solução:** Filtro por cliente → dados isolados, análise clara por segmento

### "Como monetizar relatórios automáticos?"
✅ Incluído em plano Professional+ (não é feature free)
✅ Volume de relatórios/mês é limitado por plano
✅ Integrações avançadas (API, webhooks) = Enterprise

### "Como diferenciar de Metabase/Looker?"
✅ Não somos ferramenta genérica — somos vertical-specific (Meta Ads)
✅ Automação de relatórios (não manual)
✅ WhatsApp como canal de distribuição
✅ Multi-tenant no nível do cliente, não só conta

### "Quando lancei cliente portal (portal cliente final)?"
✅ **Sprint 8** — depois que temos relatórios + admin estáveis
✅ Marca branca + permissões granulares
✅ Compartilhamento com senha para não-usuários

---

## 9. PRÓXIMOS PASSOS IMEDIATOS

1. **Sprint 4 (Esta semana):**
   - [ ] Migração do banco para `whatsapp_instances` com `client_id`
   - [ ] Testar envio de PDF via WhatsApp
   - [ ] Documentar webhook de recebimento

2. **Sprint 5 (Semana após):**
   - [ ] Desenhar editor de template no Figma
   - [ ] Criar página `/reports`
   - [ ] Implementar agendamento (Cron + BullMQ)

3. **Sprint 6 (3 semanas depois):**
   - [ ] Implementar painel admin (usuários + planos + payments)
   - [ ] Integrar com Stripe para webhooks de pagamento
   - [ ] Dashboard de analytics global

4. **Go-live MVP (Semana 12):**
   - [ ] Sprints 0-6 completas
   - [ ] Testes e QA rigorosos
   - [ ] Documentação de usuário
   - [ ] Onboarding automatizado

---

## 10. MODELO FINANCEIRO (ESTIMADO)

### Suposições
- **CAC:** R$ 800 (produto-led + content)
- **Payback Period:** 12 meses
- **LTV (3 anos):** R$ 2.400
- **Churn:** 3% ao mês (base, melhora com automação)
- **Pricing:** Starter R$ 299, Pro R$ 799, Enterprise Custom

### Projeção Ano 1

| Mês | Clientes | MRR | ARR | Burn | Runway |
|-----|----------|-----|-----|------|--------|
| 1 | 5 | R$ 1,5K | R$ 18K | R$ 8K | 18 |
| 3 | 15 | R$ 6K | R$ 72K | R$ 5K | 24 |
| 6 | 35 | R$ 15K | R$ 180K | R$ 4K | 30 |
| 12 | 80 | R$ 35K | R$ 420K | R$ 3K | 36+ |

**Break-even:** Mês 10-11 (com despesas operacionais ~R$ 30K/mês)

---

## Conclusão

**Start Metric não é um data warehouse genérico.** É uma plataforma especializada em automação de relatórios para agências de tráfego pago, com:

✅ Gerenciamento multi-cliente (não multi-conta)
✅ Relatórios automáticos e personalizáveis
✅ Integração WhatsApp nativa
✅ Admin panel para gestão operacional
✅ Insights comparativos por nicho

**Diferencial:** Salva tempo do gestor (automação) e melhora experiência do cliente final (relatórios inteligentes).
