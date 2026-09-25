/**
 * @start-metric/reports
 * Variables Builder — Constrói variáveis para templates baseado em métricas reais
 */
import { formatVariables, formatPeriod } from './renderer.js';
/**
 * Busca métricas reais do cliente no período e constrói variáveis para o template
 */
export async function buildVariables(supabase, { orgId, clientId, dateRange }) {
    // 1. Buscar nome do cliente
    const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .eq('org_id', orgId)
        .single();
    // 2. Buscar campanhas do cliente via ad_accounts
    const { data: adAccounts } = await supabase
        .from('ad_accounts')
        .select('id')
        .eq('org_id', orgId)
        .eq('client_id', clientId);
    const accountIds = adAccounts?.map((a) => a.id) ?? [];
    if (accountIds.length === 0) {
        // Cliente sem contas, retornar valores zerados
        return {
            client_name: client?.name ?? 'Cliente',
            period: formatPeriod(dateRange.from, dateRange.to),
            ...formatVariables({}),
            best_campaign: '—',
            worst_campaign: '—',
        };
    }
    // 3. Buscar métricas diárias das campanhas do cliente no período
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('org_id', orgId)
        .in('ad_account_id', accountIds);
    const campaignIds = campaigns?.map((c) => c.id) ?? [];
    let metrics = [];
    if (campaignIds.length > 0) {
        const { data: metricsData } = await supabase
            .from('daily_metrics')
            .select('spend, revenue_attributed, roas, cpa, impressions, clicks, conversions, campaigns!inner(name, ad_accounts!inner(client_id))')
            .eq('org_id', orgId)
            .in('campaign_id', campaignIds)
            .gte('date', dateRange.from)
            .lte('date', dateRange.to);
        metrics = (metricsData ?? []);
    }
    // 4. Calcular agregados
    const totals = {
        totalSpend: sum(metrics, 'spend'),
        totalRevenue: sum(metrics, 'revenue_attributed'),
        roas: weightedAverage(metrics, 'revenue_attributed', 'roas'),
        cpa: weightedAverage(metrics, 'conversions', 'cpa'),
        roi: totalsToRoi(sum(metrics, 'spend'), sum(metrics, 'revenue_attributed')),
        grossProfit: (sum(metrics, 'revenue_attributed') ?? 0) - (sum(metrics, 'spend') ?? 0),
        impressions: sum(metrics, 'impressions'),
        clicks: sum(metrics, 'clicks'),
        ctr: calculateCtr(sum(metrics, 'clicks'), sum(metrics, 'impressions')),
        cpm: calculateCpm(sum(metrics, 'spend'), sum(metrics, 'impressions')),
        cpc: calculateCpc(sum(metrics, 'spend'), sum(metrics, 'clicks')),
        conversions: sum(metrics, 'conversions'),
    };
    // 5. Agrupar por campanha para encontrar melhor e pior
    const campaignMap = new Map();
    for (const metric of metrics) {
        for (const campaign of metric.campaigns ?? []) {
            const campaignName = campaign.name ?? 'Unknown';
            const existing = campaignMap.get(campaignName);
            if (!existing) {
                campaignMap.set(campaignName, {
                    roas: metric.roas ?? 0,
                    name: campaignName,
                });
                continue;
            }
            // Acumular ROAS ponderado por receita
            const revenue = metric.revenue_attributed ?? 0;
            const existingRevenue = existing.roas * existing.name.length; // approx
            existing.roas = ((existing.roas * existingRevenue) + (metric.roas ?? 0) * revenue) / (existingRevenue + revenue);
        }
    }
    const sortedCampaigns = Array.from(campaignMap.values()).sort((a, b) => b.roas - a.roas);
    // 6. Retornar variáveis formatadas
    return {
        ...formatVariables(totals),
        client_name: client?.name ?? 'Cliente',
        period: formatPeriod(dateRange.from, dateRange.to),
        best_campaign: sortedCampaigns[0]?.name ?? '—',
        worst_campaign: sortedCampaigns[sortedCampaigns.length - 1]?.name ?? '—',
    };
}
// Helpers
function sum(metrics, key) {
    return metrics.reduce((acc, m) => acc + (m[key] ?? 0), 0);
}
function weightedAverage(metrics, weightKey, valueKey) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const m of metrics) {
        const weight = m[weightKey] ?? 0;
        const value = m[valueKey] ?? 0;
        if (weight > 0) {
            weightedSum += value * weight;
            totalWeight += weight;
        }
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
function totalsToRoi(spend, revenue) {
    const s = spend ?? 0;
    const r = revenue ?? 0;
    if (s === 0)
        return 0;
    const profit = r - s;
    return (profit / s) * 100;
}
function calculateCtr(clicks, impressions) {
    const c = clicks ?? 0;
    const i = impressions ?? 0;
    if (i === 0)
        return 0;
    return (c / i) * 100;
}
function calculateCpm(spend, impressions) {
    const s = spend ?? 0;
    const i = impressions ?? 0;
    if (i === 0)
        return 0;
    return (s / i) * 1000;
}
function calculateCpc(spend, clicks) {
    const s = spend ?? 0;
    const c = clicks ?? 0;
    if (c === 0)
        return 0;
    return s / c;
}
