# SPRINT 3 — ANALYTICS ENGINE (ROAS Real, LTV, Filtros Avançados)

**Duração estimada:** 1 semana
**Prioridade:** 🟠 ALTO
**Dependências:** Sprint 2 concluído (dados reais populados)
**Responsável sugerido:** @dev + @data-engineer

---

## O que é este sprint?

Implementar o motor de analytics completo: cálculo preciso de todas as métricas de performance, filtros avançados por campanha/objetivo/status/período e exportação de dados. É a camada de inteligência que transforma dados brutos em decisões.

---

## Contexto atual

| Item | Status |
|------|--------|
| ROAS calculado no frontend | 🟡 Fórmula simples, sem filtros avançados |
| CPM, CTR, CPC, Frequência | ❌ Não existem no dashboard |
| Filtro por status de campanha | ❌ Não existe |
| Filtro por objetivo de campanha | ❌ Não existe |
| Ordenação na tabela de campanhas | 🟡 Básica |
| Export CSV | ❌ Não existe |
| LTV estimado | ❌ Não existe |

---

## Etapas de execução

### S3.1 — Atualizar `queries.ts` com métricas completas
- Calcular no servidor: ROAS, CPA, CPM, CTR, CPC, Frequência, ROI, Lucro Bruto
- Usando dados reais de `daily_metrics` agregados por período
- Adicionar comparação com período anterior (variação %)

### S3.2 — Filtros avançados no `DashboardFilters`
- Multi-select: Status da campanha (Ativa, Pausada, Arquivada)
- Multi-select: Objetivo (Conversão, Tráfego, Alcance, Engajamento, Leads)
- Date picker customizado (além dos presets existentes)
- Botão "Limpar filtros" quando há filtros ativos
- Badge contador de filtros ativos

### S3.3 — Atualizar API `/api/dashboard`
- Aceitar novos parâmetros de filtro: `campaign_status[]`, `campaign_objective[]`, `client_id`
- Filtros dinâmicos com Supabase query builder
- Retornar variação do período anterior

### S3.4 — Métricas adicionais no `KpiGrid`
- CPM (custo por mil impressões)
- CTR (taxa de clique em %)
- CPC (custo por clique)
- Frequência (impressões / alcance — se disponível)
- Cada card: valor atual + variação vs período anterior (badge ↑↓)

### S3.5 — Melhorar `CampaignsTable`
- Ordenação por qualquer coluna (click no header)
- Paginação (15 por página)
- Coluna "Cliente" (nome do cliente da ad_account)
- Highlight de ROAS: verde ≥ 3, amarelo 1–3, vermelho < 1
- Tooltip com detalhes da campanha

### S3.6 — Export CSV
- Botão "Exportar CSV" na tabela de campanhas
- Gerar CSV com todas as colunas visíveis
- Endpoint: `GET /api/analytics/export`

### S3.7 — LTV estimado (básico)
- Se dados de orders existirem: AVG(amount_total) por cliente
- Exibir como KPI opcional: "Ticket Médio"
- Se não houver dados: ocultar ou exibir "—"

---

## Critérios de aceite

- [ ] KpiGrid exibe CPM, CTR, CPC além de ROAS, CPA
- [ ] Filtros por status e objetivo de campanha funcionam
- [ ] Tabela de campanhas tem ordenação por qualquer coluna
- [ ] Export CSV funciona e gera arquivo correto
- [ ] Variação de período (%) aparece nos KPI cards
- [ ] Coluna "Cliente" aparece na tabela quando cliente está associado

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| `apps/dashboard/src/lib/dashboard/queries.ts` | MODIFICAR |
| `apps/dashboard/src/lib/dashboard/types.ts` | MODIFICAR |
| `apps/dashboard/src/app/api/dashboard/route.ts` | MODIFICAR |
| `apps/dashboard/src/app/api/analytics/export/route.ts` | CRIAR |
| `apps/dashboard/src/components/dashboard/DashboardFilters.tsx` | MODIFICAR |
| `apps/dashboard/src/components/dashboard/KpiGrid.tsx` | MODIFICAR |
| `apps/dashboard/src/components/dashboard/CampaignsTable.tsx` | MODIFICAR |

---

---

# PROMPTS

---

## PROMPT ESQUELETO — Contexto geral para qualquer IA

```
Você está trabalhando em um SaaS de gestão de tráfego pago chamado Start Metric.

STACK: Next.js 16, React 19, TypeScript, Supabase PostgreSQL, Tailwind CSS v4.

BANCO RELEVANTE:
- campaigns: id, org_id, ad_account_id, meta_id, name, status (ACTIVE|PAUSED|ARCHIVED), objective (OUTCOME_CONVERSIONS|OUTCOME_TRAFFIC|OUTCOME_AWARENESS|OUTCOME_ENGAGEMENT|OUTCOME_LEADS), daily_budget, spend
- daily_metrics: id, campaign_id, org_id, date, spend, impressions, clicks, conversions, revenue_attributed, roas, cpa
- ad_accounts: id, org_id, client_id FK (novo), name, platform
- clients: id, org_id, name (novo)

MÉTRICAS A CALCULAR:
- ROAS = SUM(revenue_attributed) / SUM(spend)
- CPA = SUM(spend) / SUM(conversions)
- CPM = (SUM(spend) / SUM(impressions)) * 1000
- CTR = (SUM(clicks) / SUM(impressions)) * 100
- CPC = SUM(spend) / SUM(clicks)
- ROI = ((SUM(revenue_attributed) - SUM(spend)) / SUM(spend)) * 100
- Lucro Bruto = SUM(revenue_attributed) - SUM(spend)

FILTROS DISPONÍVEIS (QueryFilters):
- date_from: string (ISO date)
- date_to: string (ISO date)
- date_preset: 'today'|'yesterday'|'last_7d'|'last_30d'|'this_month'|'custom'
- campaign_status: string[] (ACTIVE|PAUSED|ARCHIVED)
- campaign_objective: string[]
- ad_account_id: string (UUID)
- client_id: string (UUID)

TAREFA DESTE SPRINT:
Implementar Analytics Engine completo com todas as métricas, filtros avançados e exportação.
```

---

## PROMPT FRONTEND — Filtros avançados + métricas + tabela

```
Você é um engenheiro frontend sênior. Melhore o módulo de analytics do dashboard.

=== ARQUIVO: DashboardFilters.tsx ===

Adicionar aos filtros existentes:

1. MULTI-SELECT DE STATUS DE CAMPANHA:
Props: value: string[], onChange: (values: string[]) => void
Opções: [
  { value: 'ACTIVE', label: 'Ativa', color: 'emerald' },
  { value: 'PAUSED', label: 'Pausada', color: 'amber' },
  { value: 'ARCHIVED', label: 'Arquivada', color: 'slate' }
]
UI: dropdown com checkboxes. Quando 1+ selecionados, mostrar badge "Status: 2".

2. MULTI-SELECT DE OBJETIVO:
Opções: [
  { value: 'OUTCOME_CONVERSIONS', label: 'Conversão' },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfego' },
  { value: 'OUTCOME_AWARENESS', label: 'Alcance' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engajamento' },
  { value: 'OUTCOME_LEADS', label: 'Leads' }
]

3. SELECT DE CLIENTE (Sprint 1 dependency):
Buscar de GET /api/clients
Opção "Todos os clientes" padrão

4. BOTÃO "Limpar filtros":
Mostrar apenas quando há filtro ativo (status, objetivo, ou cliente selecionado)
Ícone X, texto "Limpar filtros", cor text-slate-400 hover:text-slate-200

5. BADGE CONTADOR:
Se há filtros ativos: badge cyan no botão de filtro mostrando quantidade
Ex: "Filtros (3)"

=== ARQUIVO: KpiGrid.tsx ===

Adicionar novos cards de KPI (além dos existentes):

CPM Card:
- Label: "CPM"
- Valor: formatado como "R$ X,XX"
- Tooltip: "Custo por mil impressões"
- Ícone: Eye

CTR Card:
- Label: "CTR"
- Valor: "X,XX%"
- Tooltip: "Taxa de cliques (Cliques / Impressões)"
- Verde se > 2%, amarelo se 1–2%, vermelho se < 1%

CPC Card:
- Label: "CPC"
- Valor: "R$ X,XX"
- Tooltip: "Custo por clique"

VARIAÇÃO DE PERÍODO (em todos os cards):
- Prop: comparison: { value: number; direction: 'up'|'down'|'neutral' }
- Badge: ↑ +X% verde | ↓ -X% vermelho | → neutro
- Texto: "vs período anterior"

=== ARQUIVO: CampaignsTable.tsx ===

1. ORDENAÇÃO:
- Cada header de coluna clicável
- Ícone ChevronUp/Down indicando direção
- Estado: sortColumn + sortDirection ('asc'|'desc')
- Ordenar localmente (array.sort())

2. PAGINAÇÃO:
- 15 itens por página
- Rodapé: "Mostrando X–Y de Z campanhas"
- Botões Anterior / Próximo

3. COLUNA CLIENTE:
- Adicionar coluna "Cliente" após "Conta"
- Mostrar client.name ou "—" se não vinculado

4. HIGHLIGHT ROAS:
- ROAS ≥ 3.0: text-emerald-400 bg-emerald-400/10
- ROAS 1.0–2.9: text-amber-400 bg-amber-400/10
- ROAS < 1.0: text-red-400 bg-red-400/10
- Cada valor em badge pill rounded-full px-2 py-0.5 text-xs font-semibold

5. BOTÃO EXPORT CSV:
- Canto superior direito da tabela
- Ícone Download, texto "Exportar CSV"
- onClick: fetch GET /api/analytics/export + download do arquivo

TYPESCRIPT: atualizar interface DashboardFilters, DashboardKPIs, Campaign.
Sem `any`. Framer Motion nos novos elementos.
```

---

## PROMPT BACKEND — Queries + API + Export

```
Você é um engenheiro backend sênior. Implemente o Analytics Engine completo.

=== ARQUIVO: apps/dashboard/src/lib/dashboard/queries.ts ===

Atualizar função getDashboardData(orgId, filters):

1. QUERY PRINCIPAL com todos os filtros:
const query = supabase
  .from('daily_metrics')
  .select(`
    spend, impressions, clicks, conversions, revenue_attributed, roas, cpa, date,
    campaign:campaigns!inner(
      id, name, status, objective,
      ad_account:ad_accounts!inner(id, name, client_id,
        client:clients(name)
      )
    )
  `)
  .eq('org_id', orgId)
  .gte('date', filters.date_from)
  .lte('date', filters.date_to)

// Filtros dinâmicos
if (filters.campaign_status?.length) {
  query.in('campaign.status', filters.campaign_status)
}
if (filters.ad_account_id) {
  query.eq('campaign.ad_account_id', filters.ad_account_id)
}
if (filters.client_id) {
  query.eq('campaign.ad_account.client_id', filters.client_id)
}

2. AGREGAÇÃO das métricas:
function aggregateMetrics(rows): DashboardKPIs {
  const totalSpend = rows.reduce((sum, r) => sum + r.spend, 0)
  const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0)
  const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0)
  const totalConversions = rows.reduce((sum, r) => sum + r.conversions, 0)
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue_attributed, 0)

  return {
    totalSpend,
    totalRevenue,
    totalImpressions,
    totalClicks,
    totalConversions,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
    cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    roi: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0,
    grossProfit: totalRevenue - totalSpend,
  }
}

3. COMPARAÇÃO COM PERÍODO ANTERIOR:
- Calcular duração do período atual (date_to - date_from em dias)
- Buscar mesmo número de dias anteriores
- Calcular variação % para cada KPI
- Retornar: { current: KPIs, previous: KPIs, comparison: { roas: { direction, pct } } }

=== ARQUIVO: apps/dashboard/src/app/api/analytics/export/route.ts ===

GET /api/analytics/export
Query params: (mesmo que o dashboard)

Processo:
1. Validar autenticação
2. Buscar dados agregados por campanha
3. Gerar CSV:

const headers = ['Campanha','Status','Objetivo','Cliente','Investimento','Receita','ROAS','CPA','CPM','CTR','CPC','Impressões','Cliques','Conversões']
const rows = campaigns.map(c => [
  c.name, c.status, c.objective, c.client_name ?? '',
  c.spend.toFixed(2), c.revenue.toFixed(2), c.roas.toFixed(2),
  c.cpa.toFixed(2), c.cpm.toFixed(2), `${c.ctr.toFixed(2)}%`,
  c.cpc.toFixed(2), c.impressions, c.clicks, c.conversions
])

const csv = [headers, ...rows].map(r => r.join(';')).join('\n')

return new Response(csv, {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="start-metric-${new Date().toISOString().slice(0,10)}.csv"`
  }
})

=== ATUALIZAR: types.ts ===

interface DashboardKPIs {
  totalSpend: number
  totalRevenue: number
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  roas: number
  cpa: number
  cpm: number
  ctr: number
  cpc: number
  roi: number
  grossProfit: number
  isDataReal: boolean // true se revenue_attributed > 0
}

interface KPIComparison {
  value: number
  previousValue: number
  direction: 'up' | 'down' | 'neutral'
  percentChange: number
}

interface QueryFilters {
  date_from: string
  date_to: string
  date_preset?: string
  campaign_status?: string[]
  campaign_objective?: string[]
  ad_account_id?: string
  client_id?: string
}

TypeScript strict. Sem any. Zod para validação dos query params.
```
