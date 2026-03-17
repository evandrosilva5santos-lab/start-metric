# SPRINT 2 — META API DADOS REAIS + ROAS REAL

**Duração estimada:** 1–2 semanas
**Prioridade:** 🔴 CRÍTICO
**Dependências:** Sprint 0 e Sprint 1 concluídos
**Responsável sugerido:** @dev + @data-engineer

---

## O que é este sprint?

Conectar o pipeline real de dados da Meta Graph API para que o ROAS exibido no dashboard seja real, não estimado. O sync cron já existe em estrutura, mas `revenue_attributed` não é populado. Este sprint fecha esse ciclo completamente.

---

## Contexto atual

| Item | Status |
|------|--------|
| Meta OAuth (conectar conta) | ✅ Funcional |
| Token Meta salvo criptografado | ✅ Funcional |
| Cron sync às 3h | ✅ Estrutura existe |
| `daily_metrics.revenue_attributed` | ❌ Não é populado |
| ROAS no dashboard | 🟡 Estimado / mock |
| Botão "Sincronizar agora" | ❌ Não existe |
| Indicador de última sync | ❌ Não existe |

---

## Etapas de execução

### S2.1 — Verificar decriptação de tokens Meta
- Checar que `SUPABASE_ENCRYPTION_KEY` está configurado no Vercel
- Testar que `pgp_sym_decrypt(token_encrypted)` retorna token válido
- Logar erros de decriptação para diagnóstico

### S2.2 — Função `fetchMetaInsights()`
- Chamar `GET /v19.0/act_{adAccountId}/insights`
- Campos: `spend, impressions, clicks, actions, action_values, date_start, date_stop`
- Date preset: `last_30d` com `time_increment=1` (dados por dia)
- Parsear `actions` → extrair conversions (action_type: `purchase`, `lead`)
- Parsear `action_values` → extrair revenue real (action_type: `purchase`)

### S2.3 — Função `upsertDailyMetrics()`
- `INSERT INTO daily_metrics ... ON CONFLICT (campaign_id, date) DO UPDATE`
- Campos: spend, impressions, clicks, conversions, revenue_attributed, roas, cpa
- ROAS = `action_values[purchase] / spend`
- CPA = `spend / conversions`

### S2.4 — Atualizar `POST /api/meta/sync`
- Buscar todos ad_accounts da org com token válido
- Para cada account: decrypt token → fetch insights → upsert metrics por campanha
- Retornar: `{ synced_accounts, synced_campaigns, errors[] }`
- Atualizar `ad_accounts.last_synced_at`

### S2.5 — Integrar com cron existente `/api/cron/meta-sync`
- Cron chama a mesma função de sync
- Garantir que CRON_SECRET está validado no header

### S2.6 — UI: botão "Sincronizar agora"
- Canto superior direito do dashboard
- Ícone RefreshCw com animação spin durante loading
- POST /api/meta/sync → toast de resultado
- Após sync: refetch dos dados do dashboard

### S2.7 — UI: indicador de última sincronização
- Texto abaixo dos filtros: "Atualizado há X minutos"
- Usar `last_synced_at` da ad_account selecionada
- Ícone Clock

### S2.8 — Badge de qualidade dos dados
- Se `revenue_attributed = 0` em todas campanhas: badge amarelo "Dados de conversão pendentes"
- Se dados completos: badge verde "Dados em tempo real"

---

## Critérios de aceite

- [ ] `daily_metrics.revenue_attributed` é populado com dados reais da Meta
- [ ] ROAS no dashboard reflete o valor real (receita / spend)
- [ ] Botão "Sincronizar agora" funciona e atualiza o dashboard
- [ ] Indicador de última sync exibe tempo correto
- [ ] Cron às 3h popula os dados automaticamente
- [ ] Tokens são decriptados corretamente em produção

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| `packages/meta-api/src/insights.ts` | CRIAR |
| `apps/dashboard/src/app/api/meta/sync/route.ts` | MODIFICAR |
| `apps/dashboard/src/app/api/cron/meta-sync/route.ts` | MODIFICAR |
| `apps/dashboard/src/components/dashboard/DashboardClient.tsx` | MODIFICAR |
| `apps/dashboard/src/components/dashboard/DashboardFilters.tsx` | MODIFICAR |
| `apps/dashboard/src/lib/dashboard/queries.ts` | MODIFICAR |

---

---

# PROMPTS

---

## PROMPT ESQUELETO — Contexto geral para qualquer IA

```
Você está trabalhando em um SaaS de gestão de tráfego pago chamado Start Metric.

STACK:
- Frontend: Next.js 16, React 19, TypeScript
- Auth/DB: Supabase PostgreSQL com RLS
- Meta Ads: Meta Graph API v19.0 (já integrado via packages/meta-api)

BANCO RELEVANTE:
- ad_accounts: id, org_id, external_id (= Meta ad account ID), token_encrypted, token_expires_at, last_synced_at, status
- campaigns: id, org_id, ad_account_id, meta_id (= Meta campaign ID), name, status
- daily_metrics: id, org_id, campaign_id, date DATE, spend, impressions, clicks, conversions, revenue_attributed, roas, cpa, created_at

PROBLEMA ATUAL:
daily_metrics.revenue_attributed nunca é populado. O sync cron existe mas não parseia action_values da Meta API.
O ROAS exibido é calculado como spend/conversions*avg_value (estimado).

META GRAPH API — ENDPOINT DE INSIGHTS:
GET https://graph.facebook.com/v19.0/act_{ad_account_id}/insights
Params obrigatórios:
- access_token: {token}
- fields: campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,date_start,date_stop
- date_preset: last_30d
- time_increment: 1  (dados por dia)
- level: campaign  (agrupar por campanha)

RESPOSTA DA API:
{
  "data": [{
    "campaign_id": "123",
    "campaign_name": "Campanha X",
    "spend": "150.00",
    "impressions": "5000",
    "clicks": "250",
    "date_start": "2026-03-01",
    "date_stop": "2026-03-01",
    "actions": [
      { "action_type": "purchase", "value": "12" },
      { "action_type": "lead", "value": "5" }
    ],
    "action_values": [
      { "action_type": "purchase", "value": "1800.00" }
    ]
  }]
}

COMO PARSEAR:
- conversions = actions.find(a => a.action_type === "purchase")?.value ?? 0
- revenue_attributed = action_values.find(a => a.action_type === "purchase")?.value ?? 0
- roas = revenue_attributed / spend (se spend > 0)
- cpa = spend / conversions (se conversions > 0)

TAREFA: Implementar o pipeline completo de sync dos dados reais.
```

---

## PROMPT FRONTEND — Sync UI e indicadores de dados

```
Você é um engenheiro frontend sênior. Adicione ao dashboard os controles de sincronização e qualidade de dados.

ARQUIVO: apps/dashboard/src/components/dashboard/DashboardClient.tsx

=== 1. BOTÃO "Sincronizar agora" ===

Adicionar ao lado dos filtros existentes (canto superior direito):

Estado normal:
<button onClick={handleSync} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm transition-all">
  <RefreshCw size={14} />
  Sincronizar
</button>

Estado loading (isSyncing = true):
- Botão desabilitado
- RefreshCw com className "animate-spin"
- Texto: "Sincronizando..."

Handler handleSync:
async function handleSync() {
  setIsSyncing(true)
  try {
    const res = await fetch('/api/meta/sync', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    showToast(`Sincronizado: ${json.data.synced_campaigns} campanhas`, 'success')
    refetchDashboard() // invalidar query do dashboard
  } catch (err) {
    showToast('Erro ao sincronizar. Tente novamente.', 'error')
  } finally {
    setIsSyncing(false)
  }
}

=== 2. INDICADOR "Última atualização" ===

Abaixo dos filtros, alinhado à esquerda:
<p className="text-xs text-slate-500 flex items-center gap-1.5">
  <Clock size={11} />
  Atualizado {formatRelativeTime(lastSyncedAt)}
</p>

Função formatRelativeTime(date):
- Menos de 1h: "há X minutos"
- Menos de 24h: "há X horas"
- Mais de 24h: "há X dias"
- Null/undefined: "nunca sincronizado"

lastSyncedAt vem do dashboard data (máximo last_synced_at entre as contas selecionadas)

=== 3. BADGE DE QUALIDADE DOS DADOS ===

Adicionar acima do KpiGrid:

Se revenue_attributed total = 0:
<motion.div
  animate={{ opacity: [0.7, 1, 0.7] }}
  transition={{ duration: 2, repeat: Infinity }}
  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-4"
>
  <AlertTriangle size={14} />
  Dados de conversão pendentes — sincronize a conta Meta para ver o ROAS real
</motion.div>

Se revenue_attributed total > 0:
<div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
  <CheckCircle size={14} />
  Dados em tempo real — última sincronização {formatRelativeTime(lastSyncedAt)}
</div>

=== 4. TOOLTIP NO CARD ROAS (KpiGrid.tsx) ===

No card ROAS, adicionar tooltip no hover:
- Se revenue_attributed real: "ROAS = Receita Atribuída / Investimento. Fonte: Meta Ads Insights"
- Se estimado: "⚠️ Baseado em conversões estimadas. Sincronize para ver o valor real."

TYPESCRIPT: Adicionar isDataReal: boolean ao tipo DashboardKPIs.
IDIOMA: Português brasileiro.
```

---

## PROMPT BACKEND — Sync Pipeline Real

```
Você é um engenheiro backend sênior. Implemente o pipeline completo de sync de dados reais da Meta API.

=== ARQUIVO 1: packages/meta-api/src/insights.ts ===

import { graphFetch } from './client'

interface MetaInsightRow {
  campaign_id: string
  campaign_name: string
  spend: string
  impressions: string
  clicks: string
  date_start: string
  date_stop: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
}

interface ParsedMetric {
  campaign_id: string
  campaign_name: string
  date: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue_attributed: number
  roas: number
  cpa: number
}

export async function fetchCampaignInsights(
  adAccountId: string,
  accessToken: string,
  datePreset: string = 'last_30d'
): Promise<ParsedMetric[]>

Implementação:
1. Chamar graphFetch com os campos corretos
2. Parsear cada linha:
   - Extrair conversions de actions (action_type: "purchase" ou "omni_purchase")
   - Extrair revenue de action_values (action_type: "purchase" ou "omni_purchase")
   - Fallback: se não encontrar "purchase", tentar "lead" com value = 0 para revenue
   - Calcular roas = revenue / spend (0 se spend = 0)
   - Calcular cpa = spend / conversions (0 se conversions = 0)
3. Retornar array de ParsedMetric

Usar parseFloat() para converter strings numéricas.
Tratar arrays null/undefined com optional chaining.

=== ARQUIVO 2: apps/dashboard/src/app/api/meta/sync/route.ts ===

import { createClient } from '@/lib/supabase/server'
import { fetchCampaignInsights } from '@start-metric/meta-api'
import { decrypt } from '@/lib/crypto' // ou função existente de decriptação

export async function POST(request: Request) {
  // 1. Verificar autenticação
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Buscar org_id do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  // 3. Buscar todas ad_accounts ativas com token
  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('id, external_id, token_encrypted, platform')
    .eq('org_id', profile.org_id)
    .eq('status', 'active')
    .eq('platform', 'meta')
    .not('token_encrypted', 'is', null)

  // 4. Para cada account: decrypt token → fetch insights → upsert
  let syncedAccounts = 0
  let syncedCampaigns = 0
  const errors: string[] = []

  for (const account of accounts) {
    try {
      // Decriptar token usando SUPABASE_ENCRYPTION_KEY
      const token = await decryptToken(account.token_encrypted)

      // Buscar insights (últimos 30 dias, por dia)
      const metrics = await fetchCampaignInsights(account.external_id, token)

      // Para cada métrica: encontrar campaign_id interno + upsert
      for (const metric of metrics) {
        // Buscar campaign pelo meta_id
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('id')
          .eq('org_id', profile.org_id)
          .eq('meta_id', metric.campaign_id)
          .single()

        if (!campaign) continue

        // Upsert em daily_metrics
        await supabase.from('daily_metrics').upsert({
          org_id: profile.org_id,
          campaign_id: campaign.id,
          date: metric.date,
          spend: metric.spend,
          impressions: metric.impressions,
          clicks: metric.clicks,
          conversions: metric.conversions,
          revenue_attributed: metric.revenue_attributed,
          roas: metric.roas,
          cpa: metric.cpa,
        }, {
          onConflict: 'campaign_id,date',
          ignoreDuplicates: false
        })

        syncedCampaigns++
      }

      // Atualizar last_synced_at
      await supabase.from('ad_accounts')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', account.id)

      syncedAccounts++
    } catch (err) {
      errors.push(`Account ${account.external_id}: ${err.message}`)
    }
  }

  return Response.json({
    data: { synced_accounts: syncedAccounts, synced_campaigns: syncedCampaigns, errors }
  })
}

=== ADICIONAR EM daily_metrics ===
Se não existir, adicionar constraint única:
ALTER TABLE daily_metrics ADD CONSTRAINT unique_campaign_date UNIQUE (campaign_id, date);

TYPESCRIPT: strict, sem any. Tratamento completo de erros. Logs para diagnóstico.
```
