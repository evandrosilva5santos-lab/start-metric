# Layer 2: User Pagante + IA de Análise de Campanhas

**Data:** 2026-03-17
**Status:** Visão estratégica + Roadmap técnico

---

## 🎭 CAMADA 2: USUÁRIO PAGANTE (Gestor de Tráfego)

### O que é?

Um **gestor de tráfego** (seu cliente) que paga pela plataforma para:
- Conectar múltiplas contas Meta/Google Ads
- Gerenciar múltiplos clientes finais
- Acompanhar performance de cada cliente
- Compartilhar dashboards/relatórios com clientes
- **[NOVO] Receber análise automática com IA**

### Usuários típicos

- Freelancer de tráfego pago
- Agência digital pequena/média
- Consultor de marketing
- Gestor de e-commerce próprio

### Acesso

```
Login: gestor@agencia.com
Rota: /dashboard, /clients, /settings, /reports
RLS: org_id = auth.uid()
Dados: Apenas sua org + clientes + contas
```

---

## 🤖 IA DE ANÁLISE: VISÃO GERAL

### O que a IA faz?

Analisa automaticamente as campanhas do seu cliente e fornece:

1. **Diagnóstico de Saúde** — Status geral da conta
2. **Insights Automáticos** — O que está bom/ruim
3. **Recomendações Acionáveis** — O que fazer
4. **Análise Comparativa** — Como se compara a outros clientes
5. **Previsões** — Tendências para próximos dias
6. **Relatório em PDF** — Pronto para enviar ao cliente

### Exemplo de output

```
📊 ANÁLISE AUTOMÁTICA — Cliente: Ecommerce XYZ (Semana 28 Mar - 03 Abr)

🟢 STATUS GERAL: Saudável
   ROAS: 3.5x (↑ 15% vs semana anterior)
   Spend: R$ 2.500
   Conversões: 45 (↑ 8%)

⚠️ PROBLEMAS DETECTADOS:
   1. Campanha "Brand Defense" tem CTR 40% abaixo da média histórica
      → Recomendação: Revisar copy dos anúncios

   2. Conta tem 2 campanhas em pausa há 5+ dias
      → Recomendação: Reativar ou deletar

✅ OPORTUNIDADES:
   1. Performance de campanha "Product Launch" é 60% melhor que "Brand Awareness"
      → Recomendação: Aumentar orçamento de "Product Launch"

   2. Segmento "Desktop" tem ROAS 25% melhor que Mobile
      → Recomendação: Ajustar bid adjustment para Desktop (+15%)

📈 PREVISÃO (próximos 7 dias):
   ROAS esperado: 3.4x ± 0.3
   Spend previsto: R$ 2.400-2.600
   Conversões esperadas: 43-48

🔄 COMPARATIVO COM OUTROS:
   Seu cliente: ROAS 3.5x | CPC R$ 2.15 | CTR 2.8%
   Média (Ecommerce): ROAS 2.8x | CPC R$ 2.80 | CTR 2.1%
   Seu cliente está: ↑ 25% acima da média ✨

---

Próximas ações recomendadas:
1. Investigar campanha "Brand Defense" (CTR baixo)
2. Aumentar orçamento em "Product Launch" em +20%
3. Reativar campanhas em pausa
```

---

## 🏗️ ARQUITETURA DE IA

### Stack Técnico

```
Frontend (User Dashboard)
    ↓
API Gateway (/api/ai/*)
    ↓
Claude API (análise + recomendações)
    ↓
Database (armazenar análises + histórico)
    ↓
Redis Cache (últimas análises)
```

### Fluxo de Análise

```
1. COLETA DE DADOS
   ├─ Buscar daily_metrics (últimos 30 dias)
   ├─ Buscar campanhas (status, histórico)
   ├─ Buscar ad_accounts (integração Meta)
   └─ Buscar nicho do cliente (para comparação)

2. PREPARAÇÃO
   ├─ Agregar dados por período
   ├─ Calcular métricas (ROAS, CPC, CTR, etc)
   ├─ Normalizar outliers
   └─ Preparar prompt estruturado

3. ANÁLISE COM CLAUDE
   ├─ Enviar dados + contexto
   ├─ Claude analisa e retorna JSON estruturado
   ├─ Extrair insights, problemas, oportunidades
   └─ Gerar recomendações acionáveis

4. ARMAZENAMENTO
   ├─ Salvar análise em `ai_analyses` table
   ├─ Vincular a `reports_sent` (para histórico)
   ├─ Cachear em Redis (24h)
   └─ Preparar para PDF

5. ENTREGA
   ├─ Mostrar na UI do dashboard
   ├─ Incluir em relatórios automáticos
   ├─ Enviar via WhatsApp (opcional)
   └─ Disponibilizar em portal cliente
```

---

## 📋 TABELAS NECESSÁRIAS

### Tabela: `ai_analyses`

```sql
CREATE TABLE public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  analysis_type VARCHAR(50) NOT NULL,  -- 'weekly' | 'monthly' | 'custom'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Dados da análise (JSON estruturado)
  overall_status VARCHAR(20),  -- 'healthy' | 'warning' | 'critical'
  health_score INT,  -- 0-100

  -- Componentes da análise
  summary TEXT,  -- Resumo executivo
  problems JSONB,  -- Array de problemas
  opportunities JSONB,  -- Array de oportunidades
  recommendations JSONB,  -- Array de recomendações
  comparison JSONB,  -- Dados comparativos com outros clientes
  forecast JSONB,  -- Previsões para próximos dias

  -- Métricas analisadas
  metrics_snapshot JSONB,  -- ROAS, CPC, CTR, conversões, etc

  -- Status e auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  analyzed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- Quando a análise fica "stale"

  -- Integração com Claude
  claude_model VARCHAR(50),  -- 'claude-opus-4.6', etc
  tokens_used INT,
  processing_time_ms INT
);

-- RLS
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_analyses_select_own_org" ON public.ai_analyses
  FOR SELECT USING (org_id = public.get_user_org_id());

-- Índices
CREATE INDEX idx_ai_analyses_client_id ON public.ai_analyses(client_id);
CREATE INDEX idx_ai_analyses_org_id ON public.ai_analyses(org_id);
CREATE INDEX idx_ai_analyses_period ON public.ai_analyses(period_start, period_end);
```

### Tabela: `ai_insights_history`

```sql
CREATE TABLE public.ai_insights_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES ai_analyses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  insight_type VARCHAR(50),  -- 'problem' | 'opportunity' | 'prediction'
  insight_text TEXT,
  priority VARCHAR(20),  -- 'low' | 'medium' | 'high'
  action_taken BOOLEAN DEFAULT false,
  action_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_insights_client_id ON public.ai_insights_history(client_id);
```

---

## 🚀 ROADMAP DE IA (Sprints 7+)

### Sprint 7A: IA Básica (2 semanas)

**Objetivo:** Análise automática semanal de campanhas

#### S7.1 — Estrutura de Análise

```typescript
// apps/dashboard/src/lib/ai/analysis.ts

interface CampaignAnalysisInput {
  client_id: string;
  org_id: string;
  period_days: number;  // 7, 30, 90
  campaigns: Campaign[];
  metrics: DailyMetric[];
  historical_data?: DailyMetric[];
}

interface AnalysisOutput {
  overall_status: 'healthy' | 'warning' | 'critical';
  health_score: number;
  summary: string;
  problems: Problem[];
  opportunities: Opportunity[];
  recommendations: Recommendation[];
  forecast: Forecast;
}

export async function analyzeCampaignPerformance(
  input: CampaignAnalysisInput
): Promise<AnalysisOutput> {
  // Preparar dados
  // Chamar Claude API
  // Estruturar resposta
  // Salvar em database
}
```

#### S7.2 — API de Análise

```typescript
// apps/dashboard/src/app/api/ai/analyze/route.ts

export async function POST(request: Request) {
  const { client_id, period = 'weekly' } = await request.json();

  // 1. Validar autenticação + org_id
  // 2. Buscar dados do cliente
  // 3. Chamar analyzeCampaignPerformance()
  // 4. Salvar em ai_analyses
  // 5. Retornar análise
}
```

#### S7.3 — UI: Painel de Análise

```typescript
// apps/dashboard/src/components/ai/AIAnalysisPanel.tsx

// Exibir:
// - Health score (0-100)
// - Status (healthy/warning/critical)
// - Resumo em cards
// - Problemas (lista com ícones)
// - Oportunidades (lista com ícones)
// - Recomendações (lista acionável)
// - Button: "Gerar nova análise"
```

#### S7.4 — Cron Job de Análise Automática

```typescript
// apps/dashboard/src/app/api/cron/analyze-clients/route.ts

// Executar toda semana (domingo):
// - Buscar todos clientes com status='active'
// - Para cada cliente:
//   - Buscar dados da última semana
//   - Chamar analyzeCampaignPerformance()
//   - Salvar análise
//   - Registrar em ai_insights_history
```

---

### Sprint 7B: IA Avançada (2 semanas)

**Objetivo:** Análise comparativa + previsões + relatórios inteligentes

#### S7B.1 — Análise Comparativa por Nicho

```typescript
// apps/dashboard/src/lib/ai/comparison.ts

// Quando análise é feita:
// 1. Buscar nicho do cliente
// 2. Buscar clientes no mesmo nicho
// 3. Calcular métricas médias (ROAS, CPC, CTR)
// 4. Comparar: "Seu cliente está Xh% acima/abaixo da média"
// 5. Incluir no output da análise
```

#### S7B.2 — Previsões com Tendências

```typescript
// apps/dashboard/src/lib/ai/forecast.ts

interface Forecast {
  next_7_days: {
    roas_range: [min: number, max: number];
    spend_range: [min: number, max: number];
    conversions_estimate: number;
    confidence: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  seasonal_factors: string[];
}

// Usar histórico para prever tendências
```

#### S7B.3 — Relatório em PDF com IA

```typescript
// apps/dashboard/src/lib/ai/report-generator.ts

// Gerar PDF que inclui:
// - Análise IA (insights, recomendações)
// - Gráficos de performance
// - Comparativo com histórico
// - Previsões
// - Ações recomendadas (checklist)
```

#### S7B.4 — Alertas em Tempo Real

```typescript
// apps/dashboard/src/lib/ai/alerts.ts

// Definir thresholds inteligentes:
// - ROAS cai > 30% em 1 dia → Alert "Alta"
// - CTR 40% abaixo da média → Alert "Média"
// - Campanha sem conversões há 3 dias → Alert "Média"

// Enviar via:
// - Notificação in-app
// - Email
// - WhatsApp (opcional)
```

---

### Sprint 8: IA + Portal Cliente (1 semana)

**Objetivo:** Análise disponível para cliente final

#### S8.1 — Compartilhar Análise via Link

```typescript
// Ao compartilhar dashboard:
// - Incluir última análise
// - IA insights aparecem no portal cliente
// - Cliente consegue entender recomendações
```

#### S8.2 — Relatório em PDF com IA

```typescript
// Ao gerar relatório:
// - Include: "Análise inteligente"
// - Include: "Recomendações"
// - Include: "Próximos passos"
```

---

## 📝 EXEMPLO: PROMPT ESTRUTURADO PARA CLAUDE

```markdown
Você é um analista de performance em tráfego pago especializado em [NICHO].

DADOS DO CLIENTE:
- Nome: Ecommerce XYZ
- Nicho: Ecommerce
- Período: 28 Mar - 03 Abr (últimos 7 dias)

MÉTRICAS:
- Spend total: R$ 2.500
- Impressões: 250.000
- Cliques: 7.000
- CTR: 2.8%
- Conversões: 45
- Revenue: R$ 15.750
- ROAS: 3.5x
- CPC: R$ 2.15
- CPA: R$ 55.56

CAMPANHAS:
1. "Brand Awareness"
   - Spend: R$ 800 | CTR: 2.1% | Conversões: 8
   - Status: Ativa | Performance: ⚠️ Acima do histórico

2. "Product Launch"
   - Spend: R$ 1.200 | CTR: 3.5% | Conversões: 28
   - Status: Ativa | Performance: ✨ Excelente

3. "Brand Defense"
   - Spend: R$ 300 | CTR: 1.2% | Conversões: 5
   - Status: Ativa | Performance: 🔴 Crítico

4. "Remarketing"
   - Spend: R$ 200 | CTR: 4.2% | Conversões: 4
   - Status: Pausa há 5 dias

HISTÓRICO (4 semanas anteriores):
- Média ROAS: 3.1x
- Média CPC: R$ 2.30
- Média CTR: 2.6%

COMPARATIVO (Ecommerce - nicho):
- ROAS média: 2.8x (cliente está 25% acima ✨)
- CPC médio: R$ 2.80 (cliente está 23% abaixo ✨)
- CTR médio: 2.1% (cliente está 33% acima ✨)

TAREFA:
Forneça uma análise estruturada com:
1. Status geral (healthy/warning/critical) e health_score (0-100)
2. Resumo executivo (2-3 frases)
3. Problemas identificados (max 3) com recomendações
4. Oportunidades (max 3) com recomendações
5. Previsão para próximos 7 dias
6. Comparativo com nicho

Responda em JSON estruturado.
```

---

## 💾 INTEGRATION COM CLAUDE SDK

```typescript
// apps/dashboard/src/lib/ai/client.ts

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeWithClaude(
  prompt: string
): Promise<AnalysisOutput> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extrair JSON da resposta
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

  return result;
}
```

---

## 🎯 EXEMPLO: COMO USAR NA UI

### Página: `/dashboard?client_id=xxx`

```tsx
// Adicionar componente ao dashboard do gestor

<AIAnalysisPanel
  client_id={client_id}
  period="weekly"  // ou "monthly", "custom"
  onRefresh={refetchAnalysis}
/>

// Renderiza:
// ┌─────────────────────────────────┐
// │ 🤖 ANÁLISE INTELIGENTE           │
// │                                  │
// │ Status: 🟢 Saudável              │
// │ Score: 78/100                    │
// │                                  │
// │ ⚠️  PROBLEMAS:                   │
// │ • Brand Defense: CTR 40% baixo   │
// │   → Revisar copy dos anúncios    │
// │                                  │
// │ ✅ OPORTUNIDADES:                │
// │ • Product Launch: 60% melhor     │
// │   → Aumentar orçamento em +20%   │
// │                                  │
// │ 📈 PREVISÃO: ROAS 3.4x ± 0.3    │
// │                                  │
// │ [📊 Ver análise completa]        │
// └─────────────────────────────────┘
```

---

## 🔄 INTEGRAÇÕES FUTURAS

### 1. Automação de Ações

```typescript
// Gestor clica em recomendação e IA executa:
// - Aumentar orçamento de campanha X
// - Pausar campanha Y
// - Ajustar bid adjustment
// (com confirmação)
```

### 2. IA no WhatsApp

```
Cliente recebe no WhatsApp:
"📊 Análise da semana: ROAS melhorou 15% ✨

⚠️ Atenção: Campanha Brand Defense com CTR baixo
→ Clique para detalhes: [link]"
```

### 3. Relatório Interativo

```
PDF + QR Code → Cliente escaneia
→ Abre portal `/shared/dashboard/[token]`
→ Vê análise IA completa
→ Pode clicar em "Por quê?" e receber explicações
```

### 4. Recomendações de Nicho

```
IA sugere: "Clientes no seu nicho (Ecommerce)
geralmente têm sucesso com:
- Aumentar bid em Desktop (+15%)
- Usar creative com desconto (35% melhor CTR)
- Testar novo público (lookalike+interests)"
```

---

## ✅ CHECKLIST PARA IMPLEMENTAR

### Sprint 7A (Básico)
- [ ] Criar tabelas `ai_analyses` + `ai_insights_history`
- [ ] Implementar `analyzeCampaignPerformance()`
- [ ] API `POST /api/ai/analyze`
- [ ] Componente `AIAnalysisPanel`
- [ ] Cron job automático

### Sprint 7B (Avançado)
- [ ] Análise comparativa por nicho
- [ ] Gerador de previsões
- [ ] Gerador de PDF com IA
- [ ] Sistema de alertas

### Sprint 8 (Integração)
- [ ] Compartilhar análise via link
- [ ] Relatório PDF com insights
- [ ] Notificações WhatsApp

---

## 📊 CUSTOS E PERFORMANCE

### Estimativa de Tokens

```
Análise por cliente (semanal):
- Prompt: ~800 tokens
- Response: ~500-800 tokens
- Total por análise: ~1.300 tokens
- Custo (Opus 4.6): ~$0.03/análise

Se 100 clientes ativos:
- Por semana: 100 × $0.03 = $3
- Por mês: $12 (aprox)
- Por ano: $150 (muito barato!)
```

### Caching

```typescript
// Usar Redis para cachear análises por 24h
// Se usuário pedir análise do mesmo período:
// → Retorna do cache (sem chamar Claude)
// → Economia de 95% em tokens
```

---

## 🎓 EDUCATIONAL VALUE

Seu cliente aprende:
- Por que campanhas estão falhando
- Como otimizar performance
- O que outros fazem de diferente
- Tendências do seu nicho

**Você se diferencia:**
- Gestor comum: "Olha os números"
- Você com IA: "Olha os números + aqui estão as ações"

---

## 🚀 Próximas Ações

1. **Agora:** Focar em Sprint 4 (Client Portal)
2. **Sprint 5:** Relatórios automáticos
3. **Sprint 6:** Admin panel
4. **Sprint 7:** IA de análise (este documento)

Tudo documentado e pronto para quando chegar a hora! 🎯
