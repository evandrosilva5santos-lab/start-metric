# SPRINT 5 — REPORT TEMPLATES (Criar e Salvar Templates de Relatórios)

**Duração estimada:** 1–2 semanas
**Prioridade:** 🟠 ALTO
**Dependências:** Sprint 2 concluído (dados reais disponíveis)
**Responsável sugerido:** @dev

---

## O que é este sprint?

Sistema completo de templates de relatórios reutilizáveis. O gestor cria um template com métricas selecionadas e uma mensagem com variáveis dinâmicas (`{{client_name}}`, `{{roas}}`, `{{spend}}`). O template é salvo e pode ser reutilizado para qualquer cliente. Na hora do envio, as variáveis são substituídas pelos dados reais.

---

## Contexto atual

| Item | Status |
|------|--------|
| Tabela `report_templates` | ✅ Existe no schema |
| Campo `message_template` | ❌ Não existe na tabela |
| Campo `metrics[]` | ❌ Não existe na tabela |
| Motor de render de variáveis | ❌ Não implementado |
| UI de criação de template | ❌ Não existe |
| Picker de métricas | ❌ Não existe |
| Preview com dados reais | ❌ Não existe |

---

## Etapas de execução

### S5.1 — Migration: atualizar `report_templates`
- Adicionar `message_template TEXT` (conteúdo com variáveis `{{}}`)
- Adicionar `metrics TEXT[]` (lista de métricas incluídas)
- Adicionar `is_default BOOLEAN DEFAULT false`
- Criar constraints e índices necessários

### S5.2 — Motor de render (`packages/reports/src/renderer.ts`)
- Função `renderTemplate(template, variables)`: substitui `{{var}}` por valor
- Formatação: valores monetários em BRL, ROAS com "x", percentuais com "%"
- Suporte básico a condicionais: `{{#if variavel}}...{{/if}}`
- Retornar warnings quando variável não encontrada

### S5.3 — Função `buildVariables(orgId, clientId, dateRange)`
- Buscar métricas reais do período para o cliente
- Construir objeto com todas as variáveis disponíveis
- Formatar com `Intl.NumberFormat` (pt-BR, BRL)

### S5.4 — API Routes de templates
- `GET /api/reports/templates` → listar templates da org
- `POST /api/reports/templates` → criar
- `GET /api/reports/templates/[id]` → detalhe
- `PATCH /api/reports/templates/[id]` → editar
- `DELETE /api/reports/templates/[id]` → deletar
- `POST /api/reports/templates/[id]/duplicate` → duplicar
- `POST /api/reports/templates/[id]/preview` → renderizar com dados reais de um cliente

### S5.5 — UI: página `/reports/templates`
- Grid de cards de templates
- Card: nome, descrição, nº de métricas, data de criação, ações

### S5.6 — UI: editor de template
- Layout 2 colunas: Editor (esquerda) | Preview (direita)
- Picker de métricas com checkboxes agrupados
- Textarea com toolbar de variáveis (clique insere no cursor)
- Highlight de variáveis em cyan
- Preview em tempo real com dados de um cliente selecionado

### S5.7 — Templates padrão (seed)
- Criar 2–3 templates de exemplo no banco ao fazer onboarding
- Template "Relatório Semanal": métricas principais + texto em português
- Template "Resumo de Campanha": foco em ROAS e conversões

---

## Variáveis disponíveis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{client_name}}` | Nome do cliente | João Silva |
| `{{period}}` | Período do relatório | 01/03 a 07/03/2026 |
| `{{total_spend}}` | Total investido | R$ 5.230,00 |
| `{{total_revenue}}` | Receita atribuída | R$ 24.580,00 |
| `{{roas}}` | ROAS do período | 4,7x |
| `{{cpa}}` | Custo por aquisição | R$ 43,50 |
| `{{cpm}}` | CPM médio | R$ 12,30 |
| `{{ctr}}` | CTR médio | 2,4% |
| `{{impressions}}` | Total de impressões | 425.000 |
| `{{clicks}}` | Total de cliques | 10.200 |
| `{{conversions}}` | Total de conversões | 120 |
| `{{best_campaign}}` | Campanha com melhor ROAS | Campanha Black Friday |
| `{{worst_campaign}}` | Campanha com menor ROAS | Campanha Remarketing |
| `{{roi}}` | ROI do período | 370% |
| `{{gross_profit}}` | Lucro bruto | R$ 19.350,00 |

---

## Critérios de aceite

- [ ] Gestor consegue criar, editar e deletar templates
- [ ] Editor de template tem picker de métricas e toolbar de variáveis
- [ ] Preview exibe o template renderizado com dados reais de um cliente
- [ ] Motor de render substitui corretamente todas as variáveis
- [ ] Templates duplicados funcionam independentemente do original
- [ ] Templates padrão aparecem no onboarding

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| Migration SQL nova | CRIAR |
| `packages/reports/src/renderer.ts` | CRIAR |
| `packages/reports/src/variables.ts` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/reports/templates/page.tsx` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/reports/templates/[id]/page.tsx` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/reports/templates/new/page.tsx` | CRIAR |
| `apps/dashboard/src/app/api/reports/templates/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/reports/templates/[id]/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/reports/templates/[id]/preview/route.ts` | CRIAR |
| `apps/dashboard/src/components/reports/TemplateEditor.tsx` | CRIAR |
| `apps/dashboard/src/components/reports/MetricsPicker.tsx` | CRIAR |
| `apps/dashboard/src/components/reports/VariablesToolbar.tsx` | CRIAR |
| `apps/dashboard/src/components/reports/TemplatePreview.tsx` | CRIAR |

---

---

# PROMPTS

---

## PROMPT ESQUELETO — Contexto geral para qualquer IA

```
Você está trabalhando em um SaaS de gestão de tráfego pago chamado Start Metric.

STACK: Next.js 16, React 19, TypeScript, Supabase PostgreSQL, Tailwind CSS v4.

BANCO RELEVANTE:
- report_templates: id, org_id, name, description, message_template TEXT, metrics TEXT[], layout JSONB, is_default BOOLEAN, created_at, updated_at
- clients: id, org_id, name
- daily_metrics: id, org_id, campaign_id, date, spend, impressions, clicks, conversions, revenue_attributed, roas, cpa
- campaigns: id, org_id, name, ad_account_id
- ad_accounts: id, org_id, client_id

VARIÁVEIS DISPONÍVEIS NO TEMPLATE:
{{client_name}}, {{period}}, {{total_spend}}, {{total_revenue}}, {{roas}}, {{cpa}},
{{cpm}}, {{ctr}}, {{impressions}}, {{clicks}}, {{conversions}},
{{best_campaign}}, {{worst_campaign}}, {{roi}}, {{gross_profit}}

EXEMPLO DE TEMPLATE:
"Olá {{client_name}}! 👋

Aqui está o seu relatório de performance de {{period}}:

💰 Investimento: {{total_spend}}
📈 Receita: {{total_revenue}}
🎯 ROAS: {{roas}}
📊 CPM: {{cpm}} | CTR: {{ctr}}
🏆 Melhor campanha: {{best_campaign}}

Qualquer dúvida, estou à disposição! 🚀"

MOTOR DE RENDER:
function renderTemplate(template: string, variables: Record<string, string>): string
- Substituir cada {{variavel}} pelo valor em variables[variavel]
- Se variável não encontrada: manter {{variavel}} e adicionar ao array de warnings

TAREFA DESTE SPRINT:
Implementar o sistema completo de templates de relatórios com editor visual, picker de métricas e preview em tempo real.
```

---

## PROMPT FRONTEND — Editor de Templates

```
Você é um engenheiro frontend sênior especialista em React. Crie o editor de templates de relatórios.

=== ARQUIVO: apps/dashboard/src/components/reports/TemplateEditor.tsx ===

"use client"

Props:
interface TemplateEditorProps {
  template?: ReportTemplate // se fornecido, modo edição; senão, criação
  onSaved: (template: ReportTemplate) => void
}

LAYOUT: grid 2 colunas (lg:grid-cols-2 gap-6)

=== COLUNA ESQUERDA: EDITOR ===

1. Campo Nome:
   <input placeholder="Ex: Relatório Semanal de Performance" />

2. Campo Descrição (opcional):
   <input placeholder="Breve descrição do template..." />

3. METRICS PICKER (MetricsPicker.tsx):
   Grupos de métricas com checkboxes:

   💰 Financeiro:
   [ ] Investimento Total (total_spend)
   [ ] Receita Atribuída (total_revenue)
   [ ] ROAS (roas)
   [ ] CPA (cpa)
   [ ] ROI (roi)
   [ ] Lucro Bruto (gross_profit)

   📊 Alcance:
   [ ] Impressões (impressions)
   [ ] Cliques (clicks)
   [ ] CTR (ctr)
   [ ] CPM (cpm)
   [ ] CPC — custo por clique

   🎯 Conversões:
   [ ] Total de Conversões (conversions)

   📱 Destaque:
   [ ] Melhor Campanha (best_campaign)
   [ ] Pior Campanha (worst_campaign)

   Cada item:
   - Checkbox cyan quando selecionado
   - Nome da métrica + descrição curta
   - Badge com exemplo de valor

4. TOOLBAR DE VARIÁVEIS (VariablesToolbar.tsx):
   Título: "Inserir variável"
   Chips clicáveis (cada um insere no cursor do textarea):
   Estilo: bg-slate-800 hover:bg-cyan-400/10 border border-slate-700 hover:border-cyan-400/30 text-slate-400 hover:text-cyan-400 text-xs rounded-lg px-2 py-1 cursor-pointer transition-all

   onClick de cada chip:
   - Detectar posição do cursor no textarea (selectionStart)
   - Inserir "{{variavel}}" na posição
   - Mover cursor após a variável inserida

5. TEXTAREA DE MENSAGEM:
   placeholder="Escreva sua mensagem aqui. Clique nas variáveis acima para inserir."
   className="min-h-[200px] font-mono text-sm"
   value={messageTemplate}
   onChange={...}

   Highlight visual de variáveis:
   - Usar abordagem: exibir por cima com div contentEditable ou regex highlight
   - Variáveis {{...}} em text-cyan-400 (usando div overlay com pointerEvents:none)

6. Botão Salvar:
   "Salvar template" — bg-cyan-400 text-slate-950 font-bold
   Loading state com Loader2

=== COLUNA DIREITA: PREVIEW ===

1. Select "Simular com dados de:":
   Dropdown de clientes da org (GET /api/clients)
   Opção "Dados de exemplo" (usa valores mockados)

2. Preview renderizado:
   - Card: bg-slate-900 border border-slate-800 rounded-2xl p-6
   - Renderizar messageTemplate substituindo variáveis por valores reais/mock
   - Quebras de linha preservadas (whitespace-pre-wrap)
   - Variáveis não encontradas: highlight vermelho

3. Botão "Enviar preview por WhatsApp":
   Só ativo se: instância WhatsApp do cliente selecionado estiver conectada
   POST /api/reports/templates/[id]/preview { client_id }

=== ESTADOS ===
- isSaving: boolean
- selectedMetrics: string[] (IDs das métricas)
- messageTemplate: string
- previewClientId: string | null
- previewData: Record<string, string> | null

TYPESCRIPT: strict. Interfaces tipadas para tudo.
IDIOMA: português brasileiro.
DESIGN: dark theme, cyan accent, glassmorphism nos cards.
```

---

## PROMPT BACKEND — Migration + Renderer + API Routes

```
Você é um engenheiro backend sênior. Implemente o backend de templates de relatórios.

=== PARTE 1: MIGRATION SQL ===

ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS message_template TEXT,
  ADD COLUMN IF NOT EXISTS metrics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- RLS (se não existir)
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "templates_org_isolation" ON public.report_templates
  USING (org_id = public.get_user_org_id());

CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_report_templates_org_id ON public.report_templates(org_id);


=== PARTE 2: packages/reports/src/renderer.ts ===

interface RenderResult {
  rendered: string
  warnings: string[] // variáveis não encontradas
}

export function renderTemplate(
  template: string,
  variables: Record<string, string | number>
): RenderResult {
  const warnings: string[] = []

  const rendered = template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim()
    if (trimmed in variables) {
      return String(variables[trimmed])
    }
    warnings.push(trimmed)
    return match // manter original se não encontrado
  })

  return { rendered, warnings }
}

export function formatVariables(
  raw: Record<string, number>,
  locale = 'pt-BR',
  currency = 'BRL'
): Record<string, string> {
  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const pct = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1 })
  const num = new Intl.NumberFormat(locale)

  return {
    total_spend: fmt.format(raw.totalSpend ?? 0),
    total_revenue: fmt.format(raw.totalRevenue ?? 0),
    roas: `${(raw.roas ?? 0).toFixed(1)}x`,
    cpa: fmt.format(raw.cpa ?? 0),
    cpm: fmt.format(raw.cpm ?? 0),
    ctr: `${(raw.ctr ?? 0).toFixed(1)}%`,
    impressions: num.format(raw.impressions ?? 0),
    clicks: num.format(raw.clicks ?? 0),
    conversions: num.format(raw.conversions ?? 0),
    roi: `${(raw.roi ?? 0).toFixed(0)}%`,
    gross_profit: fmt.format(raw.grossProfit ?? 0),
  }
}


=== PARTE 3: packages/reports/src/variables.ts ===

export async function buildVariables(
  supabase: SupabaseClient,
  orgId: string,
  clientId: string,
  dateRange: { from: string; to: string }
): Promise<Record<string, string>> {
  // 1. Buscar nome do cliente
  const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).single()

  // 2. Agregar daily_metrics do cliente no período
  //    (via ad_accounts.client_id → campaigns → daily_metrics)
  const { data: metrics } = await supabase
    .from('daily_metrics')
    .select('spend, impressions, clicks, conversions, revenue_attributed, roas, cpa, campaign:campaigns!inner(name, ad_account:ad_accounts!inner(client_id))')
    .eq('org_id', orgId)
    .eq('campaign.ad_account.client_id', clientId)
    .gte('date', dateRange.from)
    .lte('date', dateRange.to)

  // 3. Calcular agregados
  const totals = aggregateMetrics(metrics ?? [])

  // 4. Encontrar melhor e pior campanha
  const campaignMap = groupByCampaign(metrics ?? [])
  const sorted = Object.values(campaignMap).sort((a, b) => b.roas - a.roas)

  // 5. Formatar período
  const period = formatPeriod(dateRange.from, dateRange.to)

  // 6. Retornar variáveis formatadas
  return {
    client_name: client?.name ?? 'Cliente',
    period,
    ...formatVariables(totals),
    best_campaign: sorted[0]?.name ?? '—',
    worst_campaign: sorted[sorted.length - 1]?.name ?? '—',
  }
}


=== PARTE 4: API ROUTES ===

--- /api/reports/templates/route.ts ---

GET: listar templates da org (ORDER BY created_at DESC)
POST: criar template (Zod schema: name required, description?, message_template?, metrics?)

--- /api/reports/templates/[id]/route.ts ---

GET: detalhe do template (verificar org_id)
PATCH: editar (partial update)
DELETE: deletar (verificar que nenhum scheduled_report usa este template antes)

--- /api/reports/templates/[id]/duplicate/route.ts ---

POST: duplicar template
  1. Buscar template original
  2. INSERT com name: `${original.name} (cópia)`, mesmos outros campos
  3. Retornar nova cópia

--- /api/reports/templates/[id]/preview/route.ts ---

POST /api/reports/templates/[id]/preview
Body: { client_id: string, date_from: string, date_to: string }

1. Buscar template
2. buildVariables(orgId, clientId, dateRange)
3. renderTemplate(template.message_template, variables)
4. Retornar: { data: { rendered, warnings, variables } }

TypeScript strict. Sem any. Zod validation em todos os endpoints.
```
